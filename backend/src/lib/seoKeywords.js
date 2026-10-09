import { getStorefrontProduct } from './productStore.js'
import { createAsk, lenientJsonParse, SeoConfigError, SeoUpstreamError, SeoCancelledError, SeoFormatError } from './openrouterClient.js'
import { plain, normalizeResult } from './seoNormalize.js'
import { runPipeline } from './seoPipeline.js'

// Gợi ý từ khóa SEO bằng AI qua OpenRouter, chạy theo quy trình nhiều bước (xem seoPipeline.js).
// Lưu ý: AI gợi ý dựa trên hiểu biết về cách người Việt tìm kiếm, KHÔNG phải số liệu lượt tìm thật. Muốn biết lượt tìm hãy kiểm tra thêm
// bằng Google Keyword Planner / Search Console.
export { SeoConfigError, SeoUpstreamError, SeoCancelledError, SeoFormatError, lenientJsonParse }

// input: { productId } hoặc { topic }. Trả về mô tả nguồn để đưa vào lời nhắc.
export function describeSource({ productId, topic }) {
  if (productId) {
    const p = getStorefrontProduct(productId)
    if (!p) return null
    const price = p.originalPrice ? `${p.price}đ (giảm ${p.discountPercent}% từ ${p.originalPrice}đ)` : `${p.price}đ${p.priceMax ? ` – ${p.priceMax}đ` : ''}`
    return {
      type: 'product',
      name: p.name,
      prompt: [`Loại: sản phẩm`, `Tên: ${plain(p.name, 200)}`, `Nhóm: ${plain(p.type, 80)}`, `Giá: ${price}`, `Mô tả: ${plain(p.description, 700)}`].join('\n'),
    }
  }
  const t = plain(topic, 200)
  if (!t) return null
  return { type: 'topic', name: t, prompt: `Loại: chủ đề / danh mục\nChủ đề: ${t}` }
}

// Đọc một câu trả lời JSON đơn lẻ thành kết quả chuẩn hóa (dùng cho kiểm thử và công cụ khác).
export function parseKeywordResult(text, { allowEmpty = false } = {}) {
  const data = lenientJsonParse(String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, ''))
  if (!data) throw new SeoFormatError('AI không trả về dữ liệu đúng định dạng.')
  const result = normalizeResult(data)
  if (!allowEmpty && !result.primary.length && !result.longTail.length) throw new SeoFormatError('AI không gợi ý được từ khóa nào, hãy thử lại.')
  return result
}

// signal: hủy giữa chừng (nút Hủy). onStage(text): tên bước đang làm. onSteps(danh sách bước): tiến độ chi tiết từng bước cho màn hình chờ.
export async function generateKeywords(input, { fetchImpl = fetch, env = process.env, signal, onStage = () => {}, onSteps = () => {} } = {}) {
  if (!env.OPENROUTER_API_KEY) throw new SeoConfigError('Chưa cấu hình OPENROUTER_API_KEY trong backend/.env.')
  const source = describeSource(input)
  if (!source) return null

  const { ask, model } = createAsk({ env, fetchImpl, signal })
  const { result, steps } = await runPipeline({
    source,
    ask,
    signal,
    onSteps: (list) => {
      onSteps(list)
      const running = list.find((s) => s.status === 'running')
      if (running) onStage(`${running.title}…`)
    },
  })
  return { source: { type: source.type, name: source.name }, model, result, steps }
}
