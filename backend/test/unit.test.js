import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

import { toStorefront } from '../src/lib/productStore.js'
import { analyzeImport } from '../src/lib/discountImport.js'
import { parseKeywordResult, lenientJsonParse, generateKeywords, SeoConfigError, SeoUpstreamError } from '../src/lib/seoKeywords.js'
import { keywordsSchema } from '../src/schemas/seo.js'
import { startJob, getJob, currentJob, cancelJob, jobView, JobLimitError } from '../src/lib/seoJobs.js'
import { verifyWebhookSignature } from '../src/lib/payos.js'
import { extractOrderNumber } from '../src/lib/paymentWebhook.js'
import { orderCreatedEmail, orderStatusEmail, passwordResetEmail } from '../src/lib/emailTemplates.js'
import { canTransitionOrder } from '../src/constants/workflow.js'
import { publishChat, openStream, customerChannel, ADMIN_CHANNEL, _stats } from '../src/lib/chatEvents.js'
import { createOrderSchema } from '../src/schemas/orders.js'
import { registerSchema, resetPasswordSchema, forgotPasswordSchema } from '../src/schemas/auth.js'
import {
  analyticsEventSchema,
  createCampaignSchema,
  createCustomerSchema,
  userRoleSchema,
  shipmentStatusSchema,
  createPostSchema,
  updatePostSchema,
  slugify,
} from '../src/schemas/admin.js'

describe('toStorefront (sản phẩm admin -> dạng website)', () => {
  const admin = {
    id: 'abc-1', shopeeId: '123', name: 'Rèm thử', categoryId: 'chong-nang', status: 'active', price: 999, description: 'Mô tả',
    images: ['a.jpg', 'b.jpg'], sold: 4, createdAt: '2026-01-01T00:00:00Z', hasVariants: true,
    variantAttributes: [{ name: 'Màu', values: ['Xám'], optionImages: { Xám: 'x.jpg' } }, { name: 'Kích thước', values: ['1m'] }],
    variants: [{ label: 'Xám / 1m', price: 200000, stock: 5 }, { label: 'Xám / 2m', price: 350000, stock: 0 }],
  }
  test('giá thấp nhất, priceMax, ảnh, phân loại', () => {
    const s = toStorefront(admin)
    assert.equal(s.id, 'sp123')
    assert.equal(s.price, 200000)
    assert.equal(s.priceMax, 350000)
    assert.equal(s.image, 'a.jpg')
    assert.deepEqual(s.variants, [{ label: 'Xám / 1m', price: 200000, stock: 5 }, { label: 'Xám / 2m', price: 350000, stock: 0 }])
    assert.deepEqual(s.options[0].images, { Xám: 'x.jpg' })
    assert.equal(s.options[1].images, undefined)
    assert.equal(s.sold, 4)
  })
  test('sản phẩm không phân loại: không có variants/priceMax', () => {
    const s = toStorefront({ ...admin, hasVariants: false, variants: [], price: 50000 })
    assert.equal(s.price, 50000)
    assert.equal('variants' in s, false)
    assert.equal('priceMax' in s, false)
  })
  test('không có Mã Shopee thì dùng id admin', () => {
    assert.equal(toStorefront({ ...admin, shopeeId: '' }).id, 'abc-1')
  })
  test('giảm giá theo SKU sản phẩm: mọi phân loại giảm, có giá gốc và % giảm', () => {
    const s = toStorefront({ ...admin, sku: 'REM-01' }, new Map([['rem-01', 10]]))
    assert.deepEqual(s.variants.map((v) => v.price), [180000, 315000])
    assert.equal(s.price, 180000)
    assert.equal(s.priceMax, 315000)
    assert.equal(s.originalPrice, 200000)
    assert.equal(s.discountPercent, 10)
    assert.equal(s.variants[0].originalPrice, 200000)
  })
  test('SKU phân loại ưu tiên hơn SKU sản phẩm; phân loại không giảm thì không có giá gốc', () => {
    const p = { ...admin, sku: 'REM-01', variants: [{ label: 'A', sku: 'V-A', price: 100000, stock: 1 }, { label: 'B', sku: 'V-B', price: 120000, stock: 1 }] }
    const s = toStorefront(p, new Map([['rem-01', 10], ['v-a', 50]]))
    assert.equal(s.variants[0].price, 50000)
    assert.equal(s.variants[1].price, 108000)
    assert.equal(s.price, 50000)
    assert.equal(s.originalPrice, 100000)
    assert.equal(s.discountPercent, 50)
    const only = toStorefront({ ...p, sku: 'X' }, new Map([['v-b', 20]]))
    assert.equal(only.price, 96000) // phân loại rẻ nhất sau giảm là B
    assert.equal(only.variants[0].originalPrice, undefined)
  })
  test('giảm theo mã phân loại / mã Shopee, không cần SKU', () => {
    const p = {
      ...admin, // không có sku, shopeeId '123'
      variants: [{ label: 'A', shopeeVariantId: '111', price: 100000, stock: 1 }, { label: 'B', shopeeVariantId: '222', price: 120000, stock: 1 }],
    }
    const only = toStorefront(p, new Map([['222', 25]]))
    assert.deepEqual(only.variants.map((v) => v.price), [100000, 90000])
    assert.equal(only.variants[0].originalPrice, undefined)
    assert.equal(only.variants[1].discountPercent, 25)
    assert.equal(only.price, 90000)
    const byShopee = toStorefront(p, new Map([['123', 10]]))
    assert.deepEqual(byShopee.variants.map((v) => v.price), [90000, 108000])
    const byWebsiteId = toStorefront(p, new Map([['sp123', 10]]))
    assert.equal(byWebsiteId.price, 90000)
    const both = toStorefront(p, new Map([['123', 10], ['222', 30]])) // mã phân loại ưu tiên hơn mã sản phẩm
    assert.deepEqual(both.variants.map((v) => v.price), [90000, 84000])
  })
  test('sản phẩm không phân loại + không có quy tắc thì giữ nguyên giá', () => {
    const plain = { ...admin, hasVariants: false, variants: [], price: 50000, sku: 'P' }
    assert.equal(toStorefront(plain, new Map([['p', 20]])).price, 40000)
    const s = toStorefront(plain)
    assert.equal(s.price, 50000)
    assert.equal('originalPrice' in s, false)
  })
})

describe('nhập giảm giá từ file', () => {
  const variant = (id, price, over = {}) => ({ kind: 'variant', target: `v:${id}`, productCodes: ['p1'], name: 'SP', label: `PL ${id}`, price, ...over })
  const catalog = {
    111: variant(111, 100000),
    222: variant(222, 200000),
    333: variant(333, 50000, { productCodes: ['p2'] }),
    p1: { kind: 'product', target: 'p:1', name: 'SP', price: 100000, hasVariants: true },
    p3: { kind: 'product', target: 'p:3', name: 'SP lẻ', price: 80000, hasVariants: false },
  }
  const lookup = (c) => catalog[String(c).toLowerCase()]
  const run = (rows, existing = []) => analyzeImport(rows.map((r, i) => ({ row: i + 2, ...r })), existing, lookup)

  test('tính ngược % giảm từ giá gốc và giá hiển thị, giữ nguyên giá bán trong file', () => {
    const { results, rules, summary } = run([{ productCode: 'p1', variantCode: '111', listPrice: 100000, salePrice: 79000 }])
    assert.equal(results[0].status, 'ok')
    assert.equal(results[0].percent, 21)
    assert.deepEqual(rules, [{ code: '111', percent: 21, originalPrice: 100000, salePrice: 79000 }])
    assert.equal(summary.ok, 1)
  })
  test('đọc được số dạng chuỗi/số thập phân, bỏ qua dòng không giảm', () => {
    const { results } = run([
      { variantCode: 111, listPrice: '100000', salePrice: 90000.4 },
      { variantCode: '222', listPrice: 200000, salePrice: 200000 },
    ])
    assert.equal(results[0].percent, 10)
    assert.equal(results[1].status, 'none')
  })
  test('kiểm tra lỗi: mã lạ, sai sản phẩm, thiếu mã phân loại, giá sai, giảm quá 90%, trùng dòng', () => {
    const { results } = run([
      { variantCode: '999', listPrice: 10, salePrice: 5 },
      { productCode: 'p1', variantCode: '333', listPrice: 50000, salePrice: 40000 },
      { productCode: 'p1', listPrice: 100000, salePrice: 90000 },
      { variantCode: '111', listPrice: 100000, salePrice: 120000 },
      { variantCode: '222', listPrice: 200000, salePrice: 10000 },
      { variantCode: '111', listPrice: 100000, salePrice: 90000 },
      { variantCode: '111', listPrice: 100000, salePrice: 80000 },
      { variantCode: '222', listPrice: '', salePrice: 100 },
      {},
    ])
    assert.deepEqual(results.map((r) => r.status), ['error', 'error', 'error', 'error', 'error', 'ok', 'error', 'error', 'error'])
    assert.match(results[1].message, /không thuộc sản phẩm/)
    assert.match(results[2].message, /Mã phân loại hàng/)
    assert.match(results[6].message, /Trùng với dòng 7/)
  })
  test('sản phẩm không phân loại dùng Mã sản phẩm; lệch giá kho chỉ cảnh báo', () => {
    const { results, rules } = run([{ productCode: 'p3', listPrice: 90000, salePrice: 72000 }])
    assert.equal(results[0].status, 'ok')
    assert.match(results[0].warning, /khác Giá Gốc/)
    assert.equal(rules[0].percent, 20)
  })
  test('nhập lại: thay quy tắc cũ cùng phân loại, giữ quy tắc khác, giá = giá gốc thì bỏ giảm giá cũ', () => {
    const existing = [{ code: '111', percent: 5 }, { code: '333', percent: 7 }]
    const a = run([{ variantCode: '111', listPrice: 100000, salePrice: 50000 }], existing)
    assert.deepEqual(a.rules.map((r) => [r.code, r.percent]), [['333', 7], ['111', 50]])
    const b = run([{ variantCode: '111', listPrice: 100000, salePrice: 100000 }], existing)
    assert.equal(b.results[0].status, 'clear')
    assert.deepEqual(b.rules.map((r) => r.code), ['333'])
  })
})

describe('giá cố định từ file trong toStorefront', () => {
  const p = { id: 'a1', shopeeId: '123', name: 'SP', status: 'active', price: 100000, hasVariants: true, variants: [{ label: 'A', shopeeVariantId: '111', price: 100000, stock: 1 }, { label: 'B', shopeeVariantId: '222', price: 100000, stock: 1 }] }
  test('giá bán đúng bằng salePrice, giá gạch ngang là originalPrice', () => {
    const s = toStorefront(p, new Map([['111', { percent: 21, originalPrice: 100000, salePrice: 79000 }]]))
    assert.deepEqual(s.variants.map((v) => v.price), [79000, 100000])
    assert.equal(s.variants[0].originalPrice, 100000)
    assert.equal(s.variants[0].discountPercent, 21)
    assert.equal(s.price, 79000)
    assert.equal(s.originalPrice, 100000)
  })
  test('sản phẩm không phân loại: quy tắc của sản phẩm mang giá cố định', () => {
    const plain = { ...p, hasVariants: false, variants: [], price: 90000 }
    const s = toStorefront(plain, new Map([['123', { percent: 20, originalPrice: 90000, salePrice: 72000 }]]))
    assert.equal(s.price, 72000)
    assert.equal(s.originalPrice, 90000)
    assert.equal(s.discountPercent, 20)
  })
})

describe('gợi ý từ khóa SEO (OpenRouter) — quy trình nhiều bước', () => {
  const STEP = {
    intent: { primary: [
      { keyword: 'rèm dán tường phòng ngủ', intent: 'mua hàng', note: 'a' }, { keyword: 'mua rèm dán tường', intent: 'mua hàng', note: 'b' }, { keyword: 'giá rèm dán tường', intent: 'mua hàng', note: 'c' },
      { keyword: 'rèm dán tường hay rèm ore', intent: 'so sánh', note: 'd' }, { keyword: 'cách dán rèm không khoan', intent: 'tìm hiểu', note: 'e' }, { keyword: 'rèm dán tường có bền không', intent: 'tìm hiểu', note: 'f' },
    ] },
    longtail: {
      longTail: ['rèm dán tường nhà thuê', 'rèm dán tường chống nắng', 'rèm dán tường phòng khách', 'rèm dán tường màu xám', 'rèm dán tường khổ rộng', 'rèm dán tường giá rẻ', 'rèm dán tường voan', 'rèm dán tường bếp', 'rèm dán tường ban công'],
      clusters: [{ pillar: 'Rèm không khoan', keywords: ['rèm dán tường', 'ray dán trần', 'rèm nhà thuê'] }, { pillar: 'Rèm theo phòng', keywords: ['rèm phòng ngủ', 'rèm phòng khách', 'rèm bếp'] }],
    },
    pages: { pageIdeas: [
      { keyword: 'rèm dán tường phòng ngủ', slug: 'rem-dan-tuong-phong-ngu', why: 'Hướng dẫn chọn màu và kích thước theo phòng ngủ' }, { keyword: 'rèm dán tường nhà thuê', slug: 'rem-dan-tuong-nha-thue', why: 'Nội dung riêng cho người thuê nhà không được khoan' },
      { keyword: 'rèm dán tường chống nắng', slug: 'rem-dan-tuong-chong-nang', why: 'So sánh mức cản nắng theo chất liệu vải' },
    ] },
    meta: {
      title: 'Rèm dán tường phòng ngủ giá xưởng | CLEVINUM',
      metaDescription: 'Rèm dán tường phòng ngủ lắp trong 5 phút, không cần khoan, nhiều màu và kích thước. Giá xưởng, giao toàn quốc. Xem mẫu và đặt ngay hôm nay!',
    },
    questions: { questions: ['Rèm dán tường có bền không?', 'Rèm dán tường dùng được bao lâu?', 'Rèm dán tường có tháo được không?', 'Rèm dán tường giá bao nhiêu?', 'Mua rèm dán tường ở đâu?', 'Nên chọn rèm ore hay rèm voan?'] },
    blog: { blogIdeas: [
      { title: 'Cách dán rèm không cần khoan', keyword: 'cách dán rèm không khoan', type: 'tìm kiếm' }, { title: 'So sánh rèm dán tường và rèm ore', keyword: 'rèm dán tường hay rèm ore', type: 'tìm kiếm' },
      { title: 'Ý tưởng phối rèm cho phòng ngủ nhỏ', keyword: 'phối rèm phòng ngủ nhỏ', type: 'chia sẻ' },
    ] },
  }
  const wrap = (obj, status = 200) => new Response(JSON.stringify({ model: 'test/model:free', choices: [{ message: { content: JSON.stringify(obj) } }] }), { status })
  const stepOf = (init) => /\[BƯỚC:(\w+)\]/.exec(init.body)?.[1]
  const stepFetch = (override = {}) => {
    const calls = []
    const fn = async (url, init) => {
      const id = stepOf(init)
      const n = calls.filter((c) => c.id === id).length
      calls.push({ id, init, body: JSON.parse(init.body), url })
      const o = override[id]
      return typeof o === 'function' ? o(n, init) : wrap(STEP[id])
    }
    fn.calls = calls
    return fn
  }
  const env = { OPENROUTER_API_KEY: 'sk-test' }

  test('đọc JSON kể cả khi bọc trong ```json, bỏ <think>, dấu phẩy thừa và câu bị cắt cụt', () => {
    const r = parseKeywordResult('<think>nghĩ {gì}</think>Kết quả:\n```json\n' + JSON.stringify(STEP.intent) + '\n```')
    assert.equal(r.primary.length, 6)
    assert.deepEqual(lenientJsonParse('Kết quả: {"a": [1, 2,], "b": "x",} xong'), { a: [1, 2], b: 'x' })
    const cut = '{"primary": [{"keyword": "rèm dán tường", "intent": "mua hàng"}, {"keyword": "rèm ore"}], "longTail": ["một", "hai", "ba'
    assert.equal(lenientJsonParse(cut).primary.length, 2)
    assert.equal(lenientJsonParse('không có ngoặc nào'), null)
    assert.throws(() => parseKeywordResult('xin lỗi tôi không biết'), SeoUpstreamError)
    assert.throws(() => parseKeywordResult('{"primary": [], "longTail": []}'), SeoUpstreamError)
  })
  test('làm sạch: bỏ mục lẫn chữ Hán/Nhật/Hàn, đường dẫn gợi ý chỉ còn ký tự an toàn', () => {
    const mixed = parseKeywordResult(JSON.stringify({ primary: ['rèm may theo尺寸', 'rèm voan'], longTail: ['rèm dán tường'], pageIdeas: [{ keyword: 'rèm phòng ngủ', slug: 'Rèm Phòng Ngủ!/../x', why: 'tốt' }] }))
    assert.deepEqual(mixed.primary.map((k) => k.keyword), ['rèm voan'])
    assert.equal(mixed.pageIdeas[0].slug, 'rem-phong-ngu-x')
  })
  test('thiếu OPENROUTER_API_KEY -> báo lỗi cấu hình, không gọi mạng', async () => {
    await assert.rejects(generateKeywords({ topic: 'rèm' }, { env: {}, fetchImpl: async () => assert.fail('không được gọi mạng') }), SeoConfigError)
  })
  test('chạy đủ các bước theo thứ tự, mỗi bước một yêu cầu nhỏ chỉ chứa quy tắc của bước đó, kết quả bước trước đưa vào bước sau', async () => {
    const f = stepFetch()
    const stages = []
    const snapshots = []
    const out = await generateKeywords({ topic: 'rèm dán tường' }, { env: { ...env, OPENROUTER_MODEL: 'x/y' }, fetchImpl: f, onStage: (t) => stages.push(t), onSteps: (l) => snapshots.push(l) })
    assert.deepEqual(f.calls.map((c) => c.id), ['intent', 'longtail', 'pages', 'meta', 'questions', 'blog'])
    assert.equal(f.calls[0].url, 'https://openrouter.ai/api/v1/chat/completions')
    assert.equal(f.calls[0].init.headers.Authorization, 'Bearer sk-test')
    assert.equal(f.calls[0].body.model, 'x/y')
    const sys = (i) => f.calls[i].body.messages[0].content
    assert.match(sys(0), /content-strategy|Ý định tìm kiếm|mua hàng/)
    assert.ok(!/Mẫu trang đích/.test(sys(0)), 'bước 1 không được nhận quy tắc của bước trang đích')
    assert.match(sys(2), /Mẫu trang đích/)
    assert.match(sys(3), /TUYỆT ĐỐI không quá 60/)
    assert.ok(sys(0).length < 3500, 'lời nhắc mỗi bước phải gọn cho mô hình miễn phí')
    assert.match(f.calls[1].body.messages[1].content, /rèm dán tường phòng ngủ/) // từ khóa chính của bước 1 đã được đưa vào bước 2
    assert.match(f.calls[2].body.messages[1].content, /Rèm không khoan/) // cụm chủ đề của bước 2 đưa vào bước 3
    const r = out.result
    assert.equal(r.primary.length, 6)
    assert.equal(r.longTail.length, 9)
    assert.equal(r.pageIdeas.length, 3)
    assert.equal(r.questions.length, 6)
    assert.equal(r.blogIdeas.length, 3)
    assert.equal(r.title, STEP.meta.title)
    assert.equal(r.audit.score, 100)
    assert.deepEqual(out.steps.map((s) => s.status), Array(7).fill('done'))
    assert.deepEqual(out.steps.map((s) => s.id), ['intent', 'longtail', 'pages', 'meta', 'questions', 'blog', 'audit'])
    assert.ok(out.steps.every((s) => s.summary))
    assert.ok(snapshots.length > 7)
    assert.ok(stages.some((t) => /Tìm từ khóa chính/.test(t)) && stages.some((t) => /Viết tiêu đề/.test(t)))
    assert.ok(!JSON.stringify(out).includes('sk-test'), 'không được lộ khóa trong kết quả')
    assert.equal(out.model, 'x/y')
  })
  test('bước viết tiêu đề sai quy tắc (quá dài, thiếu lời kêu gọi) -> AI được nhắc sửa đúng chỗ sai và kết quả đạt', async () => {
    const longTitle = 'Rèm dán tường phòng ngủ giá xưởng, lắp nhanh không cần khoan tường, nhiều màu, giao toàn quốc | CLEVINUM'
    const f = stepFetch({ meta: (n) => (n === 0 ? wrap({ title: longTitle, metaDescription: 'Rèm dán tường phòng ngủ đẹp.' }) : wrap(STEP.meta)) })
    const out = await generateKeywords({ topic: 'rèm' }, { env, fetchImpl: f })
    const metaCalls = f.calls.filter((c) => c.id === 'meta')
    assert.equal(metaCalls.length, 2)
    const fix = metaCalls[1].body.messages[1].content
    assert.match(fix, /CẦN SỬA/)
    assert.match(fix, new RegExp(`dài ${longTitle.length} ký tự, phải tối đa 60`))
    assert.match(fix, /lời kêu gọi/)
    assert.ok(fix.includes(longTitle), 'phải kèm kết quả lần trước để AI sửa')
    assert.equal(out.result.title, STEP.meta.title)
    assert.equal(out.steps.find((s) => s.id === 'meta').attempts, 2)
    assert.deepEqual(out.result.warnings, [])
  })
  test('sau khi nhắc sửa vẫn sai -> giữ bản tốt hơn, cắt tiêu đề về đúng 60 ký tự ở ranh giới từ và ghi cảnh báo', async () => {
    const longTitle = 'Rèm dán tường phòng ngủ giá xưởng, lắp nhanh không cần khoan tường, nhiều màu, giao toàn quốc | CLEVINUM'
    const f = stepFetch({ meta: () => wrap({ title: longTitle, metaDescription: STEP.meta.metaDescription }) })
    const out = await generateKeywords({ topic: 'rèm' }, { env, fetchImpl: f })
    assert.ok(out.result.title.length <= 60 && out.result.title.length > 40)
    assert.ok(longTitle.startsWith(out.result.title))
    assert.ok(!/\s$/.test(out.result.title))
    assert.ok(out.result.warnings.some((w) => /tiêu đề/i.test(w)))
  })
  test('bước phụ trả lời hỏng 3 lần -> bước đó báo lỗi nhưng các bước khác vẫn chạy; bước chính hỏng -> cả việc lỗi, nêu tên mô hình', async () => {
    const garbage = () => new Response(JSON.stringify({ model: 'abc/yếu:free', choices: [{ message: { content: 'vẫn không phải json' } }] }))
    const f = stepFetch({ questions: garbage })
    const out = await generateKeywords({ topic: 'rèm' }, { env, fetchImpl: f })
    assert.equal(f.calls.filter((c) => c.id === 'questions').length, 3) // lần đầu + 2 lần nhắc định dạng
    const q = out.steps.find((s) => s.id === 'questions')
    assert.equal(q.status, 'error')
    assert.equal(out.steps.find((s) => s.id === 'blog').status, 'done')
    assert.deepEqual(out.result.questions, [])
    assert.ok(out.result.warnings.some((w) => /câu hỏi/i.test(w)))
    assert.equal(out.result.audit.checks.find((c) => /câu hỏi/.test(c.label)).ok, false)

    await assert.rejects(
      generateKeywords({ topic: 'rèm' }, { env, fetchImpl: stepFetch({ intent: garbage }) }),
      (e) => e instanceof SeoUpstreamError && /abc\/yếu:free/.test(e.message) && /3 lần/.test(e.message),
    )
  })
  test('mô hình không hỗ trợ response_format (400) -> thử lại chế độ lỏng, gộp lời hệ thống vào tin nhắn người dùng', async () => {
    const f = stepFetch({ intent: (n, init) => (JSON.parse(init.body).response_format ? new Response('unsupported', { status: 400 }) : wrap(STEP.intent)) })
    const out = await generateKeywords({ topic: 'rèm' }, { env, fetchImpl: f })
    const intentCalls = f.calls.filter((c) => c.id === 'intent')
    assert.equal(intentCalls.length, 2)
    assert.equal(intentCalls[1].body.messages.length, 1)
    assert.equal(intentCalls[1].body.messages[0].role, 'user')
    assert.match(intentCalls[1].body.messages[0].content, /DỮ LIỆU:/)
    assert.equal(out.result.primary.length, 6)
  })
  test('lỗi từ OpenRouter đổi thành thông báo tiếng Việt, không lộ nội dung gốc, không hỏi lại', async () => {
    const err = (status) => ({ env, fetchImpl: async () => new Response('secret upstream detail', { status }) })
    await assert.rejects(generateKeywords({ topic: 'rèm' }, err(401)), SeoConfigError)
    await assert.rejects(generateKeywords({ topic: 'rèm' }, err(402)), /hết tín dụng/)
    await assert.rejects(generateKeywords({ topic: 'rèm' }, err(404)), /OPENROUTER_MODEL/)
    await assert.rejects(generateKeywords({ topic: 'rèm' }, err(429)), /giới hạn/)
    await assert.rejects(generateKeywords({ topic: 'rèm' }, err(500)), (e) => e instanceof SeoUpstreamError && !e.message.includes('secret'))
    let n = 0
    await assert.rejects(generateKeywords({ topic: 'rèm' }, { env, fetchImpl: async () => { n++; return new Response('x', { status: 500 }) } }))
    assert.equal(n, 1)
  })
  test('sản phẩm không tồn tại -> null; dữ liệu đầu vào phải có sản phẩm hoặc chủ đề', async () => {
    assert.equal(await generateKeywords({ productId: 'khong-co' }, { env, fetchImpl: async () => assert.fail() }), null)
    assert.equal(keywordsSchema.safeParse({}).success, false)
    assert.equal(keywordsSchema.safeParse({ topic: 'rèm' }).success, true)
  })
})

describe('công việc nền của công cụ Từ khóa SEO', () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  test('chạy nền: trả mã ngay, báo bước đang làm, xong thì có kết quả; người khác không xem được', async () => {
    const job = startJob('u1', async ({ setStage }) => { setStage('Bước 2'); await wait(20); return { ok: 1 } })
    assert.equal(job.status, 'running')
    assert.equal(getJob(job.id, 'u2'), null)
    await wait(60)
    const v = jobView(getJob(job.id, 'u1'))
    assert.equal(v.status, 'done')
    assert.deepEqual(v.data, { ok: 1 })
    assert.ok(v.elapsedMs >= 0 && !('controller' in v) && !('userId' in v))
  })
  test('lỗi được đổi thành thông báo; mỗi người chỉ chạy một việc cùng lúc', async () => {
    const bad = startJob('u3', async () => { throw new Error('chi tiết nội bộ') }, { mapError: () => 'Thông báo gọn' })
    await wait(20)
    assert.equal(getJob(bad.id, 'u3').error, 'Thông báo gọn')
    const slow = startJob('u3', () => wait(200))
    assert.throws(() => startJob('u3', () => wait(1)), JobLimitError)
    cancelJob(slow)
    await wait(10)
  })
  test('tìm lại việc của mình từ tab khác: ưu tiên việc đang chạy, rồi tới việc vừa xong; lỗi khi bắt đầu kèm mã việc đang chạy', async () => {
    assert.equal(currentJob('u5'), null)
    const first = startJob('u5', async () => { await wait(40); return { n: 1 } })
    assert.equal(currentJob('u5').id, first.id)
    assert.equal(currentJob('khac'), null) // người khác không thấy
    try { startJob('u5', () => wait(1)) } catch (e) { assert.ok(e instanceof JobLimitError); assert.equal(e.jobId, first.id) }
    await wait(80)
    const done = currentJob('u5')
    assert.equal(done.id, first.id)
    assert.equal(jobView(done).status, 'done')
    assert.ok(jobView(done).finishedAgoMs >= 0)
    const failed = startJob('u5', async () => { throw new Error('x') })
    await wait(20)
    assert.equal(currentJob('u5').id, first.id, 'việc lỗi không được coi là kết quả gần nhất')
    assert.equal(getJob(failed.id, 'u5').status, 'error')
  })
  test('hủy giữa chừng: tín hiệu hủy tới được lời gọi mạng và việc dừng với trạng thái cancelled', async () => {
    let aborted = false
    const job = startJob('u4', ({ signal }) => generateKeywords({ topic: 'rèm' }, {
      env: { OPENROUTER_API_KEY: 'k' },
      signal,
      fetchImpl: (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')) })),
    }))
    await wait(20)
    cancelJob(job)
    await wait(20)
    assert.equal(aborted, true)
    const v = jobView(getJob(job.id, 'u4'))
    assert.equal(v.status, 'cancelled')
    assert.equal(v.error, 'Đã hủy.')
  })
})

describe('PayOS: chữ ký webhook', () => {
  const key = 'k3y'
  const sign = (data) => crypto.createHmac('sha256', key).update(Object.keys(data).sort().map((k) => `${k}=${data[k] ?? ''}`).join('&')).digest('hex')
  const data = { orderCode: 1, amount: 100000, description: 'ORD-12345', code: '00', counterAccountBankId: null }
  test('chữ ký đúng', () => assert.equal(verifyWebhookSignature({ data, signature: sign(data) }, key), true))
  test('đổi số tiền thì sai', () => assert.equal(verifyWebhookSignature({ data: { ...data, amount: 1 }, signature: sign(data) }, key), false))
  test('sai khóa', () => assert.equal(verifyWebhookSignature({ data, signature: sign(data) }, 'other'), false))
  test('thiếu data/chữ ký', () => {
    assert.equal(verifyWebhookSignature({}, key), false)
    assert.equal(verifyWebhookSignature({ data }, key), false)
    assert.equal(verifyWebhookSignature(null, key), false)
  })
})

describe('extractOrderNumber', () => {
  for (const [input, want] of [['ORD-12345', 'ORD-12345'], ['thanh toan ord12345 cam on', 'ORD-12345'], ['ORD 12345', 'ORD-12345'], ['không có mã', null], ['ORD-123', null]]) {
    test(JSON.stringify(input), () => assert.equal(extractOrderNumber(input), want))
  }
})

describe('luồng trạng thái đơn hàng', () => {
  test('hợp lệ', () => {
    assert.equal(canTransitionOrder('PENDING_CONFIRMATION', 'CONFIRMED'), true)
    assert.equal(canTransitionOrder('PENDING_CONFIRMATION', 'CANCELLED'), true)
  })
  test('không hợp lệ', () => {
    assert.equal(canTransitionOrder('CANCELLED', 'CONFIRMED'), false)
    assert.equal(canTransitionOrder('CANCELLED', 'CANCELLED'), false)
    assert.equal(canTransitionOrder('DELIVERED', 'PENDING_CONFIRMATION'), false)
  })
})

describe('email', () => {
  const order = {
    orderNumber: 'ORD-1', recipientName: '<script>alert(1)</script>', paymentMethod: 'COD', shippingFee: 25000, total: 125000,
    addressLine: '"><b>x</b>', province: 'HCM',
    items: [{ name: '<img src=x onerror=alert(1)>', variant: 'A&B', quantity: 2, lineTotal: 100000 }],
  }
  test('xác nhận đơn: escape dữ liệu khách nhập', async () => {
    const m = await orderCreatedEmail(order)
    assert.ok(!/<script|<img|<b>x/.test(m.html))
    assert.ok(m.html.includes('&lt;script&gt;'))
    assert.ok(m.subject.includes('ORD-1'))
    assert.ok(m.text.includes('ORD-1'))
  })
  test('trạng thái: chỉ gửi cho trạng thái có nội dung', async () => {
    assert.ok(await orderStatusEmail(order, 'SHIPPING'))
    assert.equal(await orderStatusEmail(order, 'PROCESSING'), null)
  })
  test('quên mật khẩu: link chứa mã, không lộ HTML thô', async () => {
    const m = await passwordResetEmail('<b>An</b>', 'a'.repeat(64))
    assert.ok(m.html.includes('reset-password?token=' + 'a'.repeat(64)))
    assert.ok(!m.html.includes('<b>An</b>'))
  })
})

describe('chatEvents (SSE)', () => {
  const fakeRes = () => {
    const res = new EventEmitter()
    res.written = []
    res.status = () => res
    res.set = () => res
    res.flushHeaders = () => {}
    res.write = (c) => res.written.push(c)
    return res
  }
  test('khách chỉ nhận cuộc trò chuyện của mình, admin nhận tất cả', () => {
    const [reqA, reqB, reqAdmin] = [new EventEmitter(), new EventEmitter(), new EventEmitter()]
    const [a, b, admin] = [fakeRes(), fakeRes(), fakeRes()]
    assert.ok(openStream(reqA, a, customerChannel('A')))
    assert.ok(openStream(reqB, b, customerChannel('B')))
    assert.ok(openStream(reqAdmin, admin, ADMIN_CHANNEL))
    publishChat('A', { type: 'message', sender: 'CUSTOMER' })
    const got = (r) => r.written.filter((w) => w.startsWith('event: chat')).length
    assert.equal(got(a), 1)
    assert.equal(got(b), 0)
    assert.equal(got(admin), 1)
    assert.ok(a.written.join('').includes('"conversationId":"A"'))
    for (const r of [reqA, reqB, reqAdmin]) r.emit('close')
    assert.equal(_stats().open, 0, 'đóng kết nối thì giải phóng')
  })
  test('giới hạn 5 kết nối cho một cuộc trò chuyện', () => {
    const reqs = Array.from({ length: 6 }, () => new EventEmitter())
    const results = reqs.map((r) => openStream(r, fakeRes(), customerChannel('LIMIT')))
    assert.deepEqual(results, [true, true, true, true, true, false])
    reqs.forEach((r) => r.emit('close'))
  })
})

describe('schema kiểm tra đầu vào', () => {
  const validOrder = {
    customer: { name: 'An', phone: '0901234567' },
    items: [{ productId: 'sp1', quantity: 1 }],
    paymentMethod: 'COD', recipientName: 'An', recipientPhone: '0901234567', addressLine: '1 Lê Lợi', province: 'HCM',
  }
  test('đơn hàng: bỏ field giá do client gửi', () => {
    const r = createOrderSchema.safeParse({ ...validOrder, items: [{ productId: 'sp1', quantity: 1, unitPrice: 1, discount: 99 }], shippingFee: 0 })
    assert.equal(r.success, true)
    assert.equal('unitPrice' in r.data.items[0], false)
    assert.equal('shippingFee' in r.data, false)
  })
  test('đơn hàng: sai số lượng/số điện thoại/không có sản phẩm', () => {
    assert.equal(createOrderSchema.safeParse({ ...validOrder, items: [{ productId: 'sp1', quantity: 0 }] }).success, false)
    assert.equal(createOrderSchema.safeParse({ ...validOrder, items: [{ productId: 'sp1', quantity: 1.5 }] }).success, false)
    assert.equal(createOrderSchema.safeParse({ ...validOrder, recipientPhone: 'abc' }).success, false)
    assert.equal(createOrderSchema.safeParse({ ...validOrder, items: [] }).success, false)
  })
  test('đăng ký / đặt lại mật khẩu', () => {
    assert.equal(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: '1234567' }).success, false)
    assert.equal(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: '12345678' }).success, true)
    assert.equal(resetPasswordSchema.safeParse({ token: 'xyz', password: '12345678' }).success, false)
    assert.equal(resetPasswordSchema.safeParse({ token: 'a'.repeat(64), password: '12345678' }).success, true)
    assert.equal(forgotPasswordSchema.safeParse({}).success, false)
  })
  test('analytics: loại sự kiện và độ dài', () => {
    assert.equal(analyticsEventSchema.safeParse({ sessionId: 's', type: 'HACK' }).success, false)
    assert.equal(analyticsEventSchema.safeParse({ sessionId: 's', type: 'PAGE_VIEW', path: 'a'.repeat(301) }).success, false)
    assert.equal(analyticsEventSchema.safeParse({ sessionId: 's', type: 'PAGE_VIEW', path: '/x' }).success, true)
  })
  test('chiến dịch, khách hàng, vai trò, vận đơn', () => {
    const camp = { name: 'C', platform: 'META', objective: 'o', budgetTotal: '1000', startDate: '2026-10-01', utmCode: 'abc_1' }
    assert.equal(createCampaignSchema.safeParse(camp).success, true)
    assert.equal(createCampaignSchema.safeParse({ ...camp, platform: 'EVIL' }).success, false)
    assert.equal(createCampaignSchema.safeParse({ ...camp, utmCode: 'a b' }).success, false)
    assert.equal(createCampaignSchema.safeParse({ ...camp, budgetTotal: 'abc' }).success, false)
    assert.equal(createCustomerSchema.safeParse({ name: 'A', phone: '0901234567', avatarUrl: 'javascript:alert(1)' }).success, false)
    assert.equal(createCustomerSchema.safeParse({ name: 'A', phone: '0901234567', avatarUrl: 'https://x.com/a.png' }).success, true)
    assert.equal(userRoleSchema.safeParse({ role: 'ROOT' }).success, false)
    assert.equal(shipmentStatusSchema.safeParse({ status: 'NOT_CREATED' }).success, false)
  })
})

describe('bài viết Tin tức', () => {
  test('slugify: bỏ dấu tiếng Việt, gạch ngang, giới hạn độ dài', () => {
    assert.equal(slugify('Mẹo chọn rèm cho phòng ngủ!'), 'meo-chon-rem-cho-phong-ngu')
    assert.equal(slugify('  Đèn LED -- trang trí  '), 'den-led-trang-tri')
    assert.equal(slugify('???'), '')
    assert.ok(slugify('a'.repeat(300)).length <= 80)
  })
  test('tạo bài: cần tiêu đề, mặc định là bản nháp, từ chối đường dẫn/ảnh bìa xấu', () => {
    assert.equal(createPostSchema.safeParse({ content: 'x' }).success, false)
    const ok = createPostSchema.safeParse({ title: 'Tiêu đề' })
    assert.equal(ok.success, true)
    assert.equal(ok.data.status, 'draft')
    assert.equal(createPostSchema.safeParse({ title: 'a', slug: 'Sai Slug!' }).success, false)
    assert.equal(createPostSchema.safeParse({ title: 'a', slug: 'dung-slug-1' }).success, true)
    assert.equal(createPostSchema.safeParse({ title: 'a', coverUrl: 'javascript:alert(1)' }).success, false)
    assert.equal(createPostSchema.safeParse({ title: 'a', coverUrl: 'https://x.com/a.jpg' }).success, true)
    assert.equal(createPostSchema.safeParse({ title: 'a', status: 'secret' }).success, false)
  })
  test('sửa bài: chỉ gửi phần đổi, ảnh bìa rỗng nghĩa là xóa ảnh', () => {
    const r = updatePostSchema.safeParse({ coverUrl: '' })
    assert.equal(r.success, true)
    assert.equal(r.data.coverUrl, null)
    assert.equal(updatePostSchema.safeParse({ status: 'published' }).success, true)
    assert.equal(updatePostSchema.safeParse({ status: 'x' }).success, false)
  })
})
