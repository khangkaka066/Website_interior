import { shopUrl } from './mailer.js'

// Gọi OpenRouter và ép mô hình trả về JSON. Khóa API (OPENROUTER_API_KEY) chỉ nằm ở backend, không bao giờ gửi xuống trình duyệt.
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
export const DEFAULT_MODEL = 'openai/gpt-4o-mini'
// Mô hình miễn phí có thể rất chậm. Công việc chạy nền (xem seoJobs.js) nên không bị thời gian chờ của trình duyệt/proxy cắt; mỗi lần gọi
// OpenRouter vẫn có trần 10 phút để không treo vô hạn khi nhà cung cấp lỗi.
const TIMEOUT_MS = 10 * 60_000

export class SeoConfigError extends Error {}
export class SeoUpstreamError extends Error {}
export class SeoCancelledError extends Error {}
// Câu trả lời của AI không đọc được / không có nội dung: khác với lỗi kết nối, loại này đáng để hỏi lại.
export class SeoFormatError extends SeoUpstreamError {}

// Đọc JSON "dễ tính" cho mô hình yếu: bỏ dấu phẩy thừa, và nếu câu trả lời bị cắt cụt (hết token giữa chừng) thì cắt về phần hoàn chỉnh cuối
// cùng rồi tự đóng ngoặc, để vẫn dùng được phần đã có thay vì bỏ cả kết quả.
export function lenientJsonParse(raw) {
  const start = raw.indexOf('{')
  if (start < 0) return null
  const body = raw.slice(start)
  const tryParse = (t) => {
    try {
      const v = JSON.parse(t.replace(/,\s*([}\]])/g, '$1'))
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }
  const whole = tryParse(body.slice(0, body.lastIndexOf('}') + 1))
  if (whole) return whole

  // Quét theo ký tự, ghi lại các vị trí có thể cắt (ngay sau một giá trị hoàn chỉnh) kèm danh sách ngoặc còn mở lúc đó.
  const cuts = []
  const stack = []
  let inStr = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === '"') { inStr = false; cuts.push([i + 1, stack.join('')]) }
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') stack.push('}')
    else if (c === '[') stack.push(']')
    else if (c === '}' || c === ']') { stack.pop(); cuts.push([i + 1, stack.join('')]) }
    else if (c === ',') cuts.push([i, stack.join('')])
  }
  for (let k = cuts.length - 1; k >= 0 && k >= cuts.length - 400; k--) {
    const [at, open] = cuts[k]
    const v = tryParse(body.slice(0, at) + open.split('').reverse().join(''))
    if (v) return v
  }
  return null
}

// Tài khoản OpenRouter chưa nạp tiền chỉ được ~50 lượt gọi mô hình miễn phí MỖI NGÀY (nạp tối thiểu 10 USD thì được 1000 lượt/ngày). Hết hạn mức
// ngày thì thử lại vô ích (khác với giới hạn tần suất tạm thời), nên nhận ra riêng để báo rõ và dừng ngay.
export const isDailyLimit = (text) => /per-day|per_day|daily/i.test(String(text || ''))

function upstreamError(status, detail) {
  console.error('OpenRouter lỗi', status, String(detail).slice(0, 300)) // chỉ ghi log máy chủ, không trả chi tiết (có thể lộ cấu hình) cho trình duyệt
  if (status === 401 || status === 403) return new SeoConfigError('OPENROUTER_API_KEY không hợp lệ hoặc đã bị thu hồi.')
  if (status === 402) return new SeoUpstreamError('Tài khoản OpenRouter đã hết tín dụng.')
  if (status === 404) return new SeoConfigError('OPENROUTER_MODEL không tồn tại hoặc hiện không có nhà cung cấp. Hãy chọn mô hình khác trên openrouter.ai/models.')
  if (status === 429 && isDailyLimit(detail)) return new SeoUpstreamError('Đã hết lượt dùng mô hình miễn phí trong ngày của tài khoản OpenRouter (khoảng 50 lượt/ngày; mỗi lần phân tích tốn nhiều lượt). Hãy chờ sang ngày mới hoặc nạp tối thiểu 10 USD credits trên openrouter.ai để có 1000 lượt/ngày, hay dùng mô hình trả phí.')
  if (status === 429) return new SeoUpstreamError('Mô hình đang bị giới hạn tần suất (mô hình miễn phí hay gặp), vui lòng thử lại sau ít phút hoặc đổi mô hình.')
  return new SeoUpstreamError('OpenRouter trả về lỗi, vui lòng thử lại.')
}

// Thời gian chờ (ms) trước mỗi lần thử lại khi bị 429; đặt về 0 trong kiểm thử.
export const RATE_LIMIT_WAITS = [4000, 9000]
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new SeoCancelledError('Đã hủy.'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new SeoCancelledError('Đã hủy.')) }, { once: true })
  })
const REMINDER = '\n\nLƯU Ý: chỉ trả về đúng một đối tượng JSON hoàn chỉnh theo cấu trúc đã cho, bắt đầu bằng { và kết thúc bằng }.'

// Tạo hàm ask({ system, user }) -> đối tượng JSON. Mỗi lần ask:
//  1. Gọi ở chế độ chặt (vai trò system + response_format JSON). Mô hình không hỗ trợ (400/422) thì gọi lại chế độ lỏng (gộp system vào tin nhắn người dùng).
//  2. Câu trả lời không đọc được thì nhắc lại tối đa `retries` lần (với openrouter/free mỗi lần có thể rơi vào một mô hình khác).
// Lỗi kết nối / khóa / hết tín dụng thì dừng ngay, không hỏi lại. signal: hủy giữa chừng. onNote(text): báo việc phụ (thử lại...).
export function createAsk({ env = process.env, fetchImpl = fetch, signal, onNote = () => {}, retries = 2 } = {}) {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) throw new SeoConfigError('Chưa cấu hình OPENROUTER_API_KEY trong backend/.env.')
  // OPENROUTER_MODEL có thể là một danh sách cách nhau bằng dấu phẩy: mỗi lần phải hỏi lại vì câu trả lời hỏng thì chuyển sang mô hình kế tiếp
  // (hữu ích với mô hình miễn phí chất lượng không đều). Chỉ một mô hình thì luôn dùng mô hình đó.
  const models = String(env.OPENROUTER_MODEL || DEFAULT_MODEL).split(',').map((m) => m.trim()).filter(Boolean)
  const model = models.join(',')
  let lastModel = '' // mô hình thực sự đã trả lời lần gần nhất, đưa vào thông báo lỗi để biết mô hình nào kém

  const request = async ({ system, user, strict, extra = '', attempt = 0 }) => {
    const messages = strict
      ? [{ role: 'system', content: system }, { role: 'user', content: user + extra }]
      : [{ role: 'user', content: `${system}\n\n${user}${extra}` }]
    try {
      return await fetchImpl(ENDPOINT, {
        method: 'POST',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': shopUrl(), 'X-Title': 'CLEVINUM SEO' },
        body: JSON.stringify({
          model: models[attempt % models.length],
          temperature: 0.4,
          // Mô hình miễn phí thường là mô hình "suy luận": phần nghĩ cũng tính vào max_tokens và có thể ngốn hết trước khi viết ra JSON.
          // Hạ mức suy luận xuống thấp; mỗi bước của quy trình chỉ cần câu trả lời ngắn nên 3500 là đủ, đồng thời mô hình nào cứ "nghĩ" mãi
          // sẽ bị cắt sớm (không phải chờ hết 6-8 nghìn token rồi mới biết là hỏng).
          max_tokens: 3500,
          reasoning: { effort: 'low' },
          ...(strict && { response_format: { type: 'json_object' } }),
          messages,
        }),
      })
    } catch (err) {
      if (signal?.aborted) throw new SeoCancelledError('Đã hủy.')
      throw new SeoUpstreamError(err?.name === 'TimeoutError' ? 'OpenRouter phản hồi quá lâu (quá 10 phút), vui lòng thử lại hoặc đổi mô hình.' : 'Không kết nối được tới OpenRouter.')
    }
  }

  const read = async (res) => {
    const body = await res.json().catch(() => null)
    const choice = body?.choices?.[0]
    const content = String(choice?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '') // bỏ phần "nghĩ" của mô hình suy luận
    lastModel = body?.model || lastModel
    const data = lenientJsonParse(content)
    if (!data) {
      console.warn('OpenRouter: không đọc được JSON từ câu trả lời', {
        model: body?.model,
        finish: choice?.finish_reason,
        chars: content.length,
        reasoningTokens: body?.usage?.completion_tokens_details?.reasoning_tokens,
        completionTokens: body?.usage?.completion_tokens,
        head: content.slice(0, 160),
        tail: content.slice(-160),
      })
    }
    return data
  }

  // Mô hình miễn phí hay trả 429 tạm thời (giới hạn tần suất của nhà cung cấp): chờ rồi thử lại tối đa 2 lần trước khi báo lỗi.
  async function send(args) {
    let res = await request(args)
    for (let i = 0; i < RATE_LIMIT_WAITS.length && res.status === 429; i++) {
      if (isDailyLimit(await res.clone().text().catch(() => ''))) break // hết hạn mức trong ngày: chờ vài giây cũng không hết
      await sleep(RATE_LIMIT_WAITS[i], signal)
      res = await request(args)
    }
    return res
  }

  async function ask({ system, user, onNote: perCall }) {
    const note = perCall || onNote
    let res = await send({ system, user, strict: true })
    if (res.status === 400 || res.status === 422) res = await send({ system, user, strict: false })
    for (let attempt = 0; ; attempt++) {
      if (!res.ok) throw upstreamError(res.status, await res.text().catch(() => ''))
      const data = await read(res)
      if (data) return data
      if (attempt >= retries) break
      note(`AI trả lời chưa đúng định dạng, đang yêu cầu lại (lần ${attempt + 1}/${retries})${models.length > 1 ? ' bằng mô hình khác' : ''}…`)
      res = await send({ system, user, strict: false, extra: REMINDER, attempt: attempt + 1 })
    }
    throw new SeoFormatError(
      `AI (${lastModel || 'mô hình miễn phí'}) trả về dữ liệu không đọc được sau ${retries + 1} lần thử. Hãy thử lại — với openrouter/free mỗi lần có thể rơi vào một mô hình khác — hoặc đặt OPENROUTER_MODEL cụ thể.`,
    )
  }

  return { ask, model }
}
