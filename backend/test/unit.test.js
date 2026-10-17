import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto, { createHmac } from 'node:crypto'
import { EventEmitter } from 'node:events'

import { toStorefront } from '../src/lib/productStore.js'
import { analyzeImport } from '../src/lib/discountImport.js'
import { parseKeywordResult, lenientJsonParse, generateKeywords, SeoConfigError, SeoUpstreamError } from '../src/lib/seoKeywords.js'
import { keywordsSchema } from '../src/schemas/seo.js'
import { RATE_LIMIT_WAITS } from '../src/lib/openrouterClient.js'
import { startJob, getJob, currentJob, cancelJob, jobView, JobLimitError } from '../src/lib/seoJobs.js'
import { discountFor, checkCoupon, CouponError, normalizeCode } from '../src/lib/coupons.js'
import { couponSchema, couponPatchSchema } from '../src/schemas/coupons.js'
import { welcomeConfigSchema, blastSchema, unsubscribeSchema } from '../src/schemas/subscribers.js'
import { blastEmail, welcomeEmail } from '../src/lib/emailTemplates.js'
import { rowsOf } from '../src/lib/goship.js'
import { cleanPhone, carrierCodeOf } from '../src/lib/goshipShipments.js'
import { verifyWebhookSignature } from '../src/lib/payos.js'
import { displayCode, normCode } from '../src/lib/orderCode.js'
import { extractOrderNumber, extractOrderNumbers } from '../src/lib/paymentWebhook.js'
import { generateOrderNumber } from '../src/utils/ids.js'
import { handleDueAt } from '../src/lib/orderFlow.js'
import { orderWeightGrams } from '../src/lib/weight.js'
import { cutoffToday } from '../src/lib/fulfillment.js'
import { geocodeAddress, _clearGeocodeCache } from '../src/lib/geocode.js'
import { toExpressOption, buildOndemandRatesBody, buildOndemandShipmentBody, mapOndemandStatus } from '../src/lib/ondemand.js'
import { classifyDelivery, isExpressService, isSameCity, deliveryTypeOf } from '../src/lib/deliveryType.js'
import { publicOrderView } from '../src/controllers/orders.js'
import { ordersSchema } from '../src/schemas/settings.js'
import { reviewMyOrderSchema, cancelMyOrderSchema } from '../src/schemas/orders.js'
import { bulkOrderStatusSchema } from '../src/schemas/admin.js'
import { orderCreatedEmail, orderStatusEmail, passwordResetEmail } from '../src/lib/emailTemplates.js'
import { canTransitionOrder } from '../src/constants/workflow.js'
import { publishChat, openStream, customerChannel, ADMIN_CHANNEL, _stats } from '../src/lib/chatEvents.js'
import { chatTokenFor, isValidChatToken, isLegacyConversation, canAccessConversation } from '../src/lib/chatToken.js'
import { startConversationSchema } from '../src/schemas/chat.js'
import { listCities, listDistricts, isGoshipId, goshipConfigured, GoshipError, checkGoship, _resetGoshipCache } from '../src/lib/goship.js'
import { forceHttps } from '../src/middleware/security.js'
import { findByName } from '../src/lib/vnNames.js'
import { quoteShipping, chooseShipping } from '../src/lib/shippingRates.js'
import { shippingSchema } from '../src/schemas/settings.js'
import { verifyGoshipSignature, phpJsonEncode } from '../src/lib/goshipSignature.js'
import { mapGoshipStatus, nextShippingStatus, buildShipmentBody, normalizeWebhook, fromApiShipment } from '../src/lib/goshipShipments.js'
import { createGoshipShipment, cancelGoshipShipment, searchGoshipShipment, isGoshipCode } from '../src/lib/goship.js'
import { shippingQuoteSchema } from '../src/schemas/orders.js'
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
  test('chạy đủ các bước: mỗi bước một yêu cầu nhỏ chỉ chứa quy tắc của bước đó, kết quả bước trước đưa vào bước sau', async () => {
    const f = stepFetch()
    const stages = []
    const snapshots = []
    const out = await generateKeywords({ topic: 'rèm dán tường' }, { env: { ...env, OPENROUTER_MODEL: 'x/y' }, fetchImpl: f, onStage: (t) => stages.push(t), onSteps: (l) => snapshots.push(l) })
    const ids = f.calls.map((c) => c.id)
    assert.equal(ids[0], 'intent') // bước 1 chạy một mình
    assert.deepEqual([...ids.slice(1, 4)].sort(), ['longtail', 'meta', 'questions']) // giai đoạn 2 gồm ba bước độc lập
    assert.deepEqual([...ids.slice(4)].sort(), ['blog', 'pages']) // giai đoạn 3 cần kết quả giai đoạn 2
    const call = (id) => f.calls.find((c) => c.id === id)
    assert.equal(call('intent').url, 'https://openrouter.ai/api/v1/chat/completions')
    assert.equal(call('intent').init.headers.Authorization, 'Bearer sk-test')
    assert.equal(call('intent').body.model, 'x/y')
    const sys = (id) => call(id).body.messages[0].content
    const usr = (id) => call(id).body.messages[1].content
    assert.match(sys('intent'), /mua hàng/)
    assert.ok(!/Mẫu trang đích/.test(sys('intent')), 'bước 1 không được nhận quy tắc của bước trang đích')
    assert.match(sys('pages'), /Mẫu trang đích/)
    assert.match(sys('meta'), /TUYỆT ĐỐI không quá 60/)
    assert.ok(sys('intent').length < 3500, 'lời nhắc mỗi bước phải gọn cho mô hình miễn phí')
    assert.match(usr('longtail'), /rèm dán tường phòng ngủ/) // từ khóa chính của bước 1 đã được đưa vào bước sau
    assert.match(usr('pages'), /Rèm không khoan/) // cụm chủ đề của bước từ khóa dài đưa vào bước trang đích
    assert.match(usr('blog'), /Rèm dán tường có bền không\?|Rèm dán tường dùng được bao lâu\?/) // câu hỏi đưa vào bước bài viết
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
    assert.ok(stages.some((t) => /Tìm từ khóa chính/.test(t)) && stages.some((t) => /song song/.test(t)))
    assert.ok(!JSON.stringify(out).includes('sk-test'), 'không được lộ khóa trong kết quả')
    assert.equal(out.model, 'x/y')
  })
  test('các bước độc lập chạy song song (cùng lúc 3 yêu cầu), không chạy lần lượt', async () => {
    let inFlight = 0
    let peak = 0
    const slow = (id) => async (n, init) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 25))
      inFlight--
      return wrap(STEP[id])
    }
    await generateKeywords({ topic: 'rèm' }, { env, fetchImpl: stepFetch({ longtail: slow('longtail'), meta: slow('meta'), questions: slow('questions') }) })
    assert.equal(peak, 3)
  })
  test('một bước gặp lỗi nặng (hết tín dụng) -> hủy các bước đang chạy song song và báo đúng lỗi đó', async () => {
    let aborted = 0
    const waitAbort = () => (n, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted++; reject(new DOMException('aborted', 'AbortError')) }))
    await assert.rejects(
      generateKeywords({ topic: 'rèm' }, { env, fetchImpl: stepFetch({ longtail: () => new Response('x', { status: 402 }), meta: waitAbort(), questions: waitAbort() }) }),
      /hết tín dụng/,
    )
    assert.equal(aborted, 2)
  })
  test('bị giới hạn tần suất (429): chờ rồi thử lại, qua được thì chạy tiếp; vẫn 429 sau 3 lần thì báo lỗi', async () => {
    const saved = [...RATE_LIMIT_WAITS]
    RATE_LIMIT_WAITS.splice(0, RATE_LIMIT_WAITS.length, 0, 0)
    try {
      const f = stepFetch({ intent: (n) => (n < 2 ? new Response('slow down', { status: 429 }) : wrap(STEP.intent)) })
      const out = await generateKeywords({ topic: 'rèm' }, { env, fetchImpl: f })
      assert.equal(f.calls.filter((c) => c.id === 'intent').length, 3)
      assert.equal(out.result.primary.length, 6)
      const g = stepFetch({ intent: () => new Response('slow down', { status: 429 }) })
      await assert.rejects(generateKeywords({ topic: 'rèm' }, { env, fetchImpl: g }), /giới hạn/)
      assert.equal(g.calls.length, 3)
    } finally {
      RATE_LIMIT_WAITS.splice(0, RATE_LIMIT_WAITS.length, ...saved)
    }
  })
  test('hết hạn mức miễn phí trong ngày (429 per-day) -> báo rõ, không chờ/thử lại, dừng cả quy trình ngay', async () => {
    const daily = () => new Response(JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day', code: 429 } }), { status: 429 })
    const f = stepFetch({ intent: daily })
    const t = Date.now()
    await assert.rejects(generateKeywords({ topic: 'rèm' }, { env, fetchImpl: f }), /hết lượt dùng mô hình miễn phí trong ngày[\s\S]*10 USD/)
    assert.equal(f.calls.length, 1) // không thử lại
    assert.ok(Date.now() - t < 1000, 'không được chờ giữa các lần thử')
  })
  test('OPENROUTER_MODEL là danh sách: câu trả lời hỏng thì lần hỏi lại dùng mô hình kế tiếp', async () => {
    const usedModels = []
    const f = stepFetch({ intent: (n, init) => { usedModels.push(JSON.parse(init.body).model); return n === 0 ? new Response(JSON.stringify({ choices: [{ message: { content: 'không phải json' } }] })) : wrap(STEP.intent) } })
    const out = await generateKeywords({ topic: 'rèm' }, { env: { ...env, OPENROUTER_MODEL: 'a/một:free, b/hai:free' }, fetchImpl: f })
    assert.deepEqual(usedModels, ['a/một:free', 'b/hai:free'])
    assert.equal(out.result.primary.length, 6)
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

describe('mã đơn mới dạng Shopee', () => {
  test('6 số ngày (giờ VN) + 8 ký tự, không có I/O', () => {
    // 2026-11-14 18:00 UTC = 01:00 ngày 15 giờ Việt Nam
    assert.match(generateOrderNumber(new Date('2026-11-14T18:00:00Z')), /^261115[0-9A-HJ-NP-Z]{8}$/)
    for (let i = 0; i < 200; i++) assert.match(generateOrderNumber(), /^\d{6}[0-9A-HJ-NP-Z]{8}$/)
  })
  test('không trùng trong 5000 mã sinh ra', () => {
    assert.equal(new Set(Array.from({ length: 5000 }, () => generateOrderNumber())).size, 5000)
  })
  test('nhận mã trong nội dung chuyển khoản (hoa/thường, kèm chữ khác)', () => {
    assert.equal(extractOrderNumber('CLEVINUM 2611148M5W6ABM'), '2611148M5W6ABM')
    assert.equal(extractOrderNumber('clevinum 2611148m5w6abm cam on'), '2611148M5W6ABM')
    assert.equal(extractOrderNumber('MBVCB.1234 chuyen tien 2611148M5W6ABM'), '2611148M5W6ABM')
  })
  test('không nhận chuỗi dài/ngắn hơn hoặc dính chữ số khác', () => {
    assert.equal(extractOrderNumber('2611148M5W6ABMX'), null)
    assert.equal(extractOrderNumber('2611148M5W6AB'), null)
    assert.equal(extractOrderNumber('X2611148M5W6ABM'), null)
  })
  test('nội dung có nhiều mã giống nhau: trả đủ theo thứ tự để chọn mã có thật', () => {
    assert.deepEqual(extractOrderNumbers('20261114123456 ck 2611148M5W6ABM ORD-12345'), ['20261114123456', '2611148M5W6ABM', 'ORD-12345'])
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
    // email được chuẩn hóa về chữ thường
    assert.equal(registerSchema.parse({ name: 'A', email: ' A@B.Co ', password: '12345678' }).email, 'a@b.co')
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

describe('token bí mật của khách trong chat', () => {
  const fresh = (id = 'c1') => ({ id, createdAt: new Date(Date.now() + 60_000) }) // tạo sau thời điểm có token
  const legacy = (id = 'c1') => ({ id, createdAt: new Date('2020-01-01T00:00:00Z') })

  test('token ổn định theo từng cuộc trò chuyện, khác nhau giữa các cuộc và đủ dài để không đoán được', () => {
    assert.equal(chatTokenFor('c1'), chatTokenFor('c1'))
    assert.notEqual(chatTokenFor('c1'), chatTokenFor('c2'))
    assert.ok(chatTokenFor('c1').length >= 40)
  })

  test('chỉ token đúng của đúng cuộc trò chuyện mới hợp lệ', () => {
    assert.equal(isValidChatToken('c1', chatTokenFor('c1')), true)
    assert.equal(isValidChatToken('c1', chatTokenFor('c2')), false) // token của cuộc khác
    assert.equal(isValidChatToken('c1', chatTokenFor('c1').slice(0, -1) + 'x'), false) // sửa một ký tự
    for (const bad of [undefined, null, '', 'abc', 123, {}]) assert.equal(isValidChatToken('c1', bad), false)
  })

  test('cuộc trò chuyện mới: biết mã mà thiếu hoặc sai token thì không vào được', () => {
    assert.equal(canAccessConversation(fresh(), undefined), false)
    assert.equal(canAccessConversation(fresh(), 'sai'), false)
    assert.equal(canAccessConversation(fresh('c1'), chatTokenFor('c2')), false)
    assert.equal(canAccessConversation(fresh(), chatTokenFor('c1')), true)
  })

  test('cuộc trò chuyện cũ (trước khi có token) vẫn vào được bằng mã, trừ khi tắt CHAT_LEGACY_ACCESS', () => {
    assert.equal(isLegacyConversation(legacy()), true)
    assert.equal(isLegacyConversation(fresh()), false)
    assert.equal(canAccessConversation(legacy(), undefined), true)
    process.env.CHAT_LEGACY_ACCESS = 'off'
    try {
      assert.equal(canAccessConversation(legacy(), undefined), false)
      assert.equal(canAccessConversation(legacy(), chatTokenFor('c1')), true) // có token thì vẫn vào
    } finally {
      delete process.env.CHAT_LEGACY_ACCESS
    }
  })

  test('không còn đường "tiếp tục cuộc trò chuyện bằng mã" khi tạo mới (tránh lộ tên và số điện thoại)', () => {
    const r = startConversationSchema.safeParse({ conversationId: 'abc' })
    assert.equal(r.success, false) // thiếu tên
    const ok = startConversationSchema.safeParse({ name: 'An', conversationId: 'abc' })
    assert.equal(ok.success, true)
    assert.equal('conversationId' in ok.data, false) // trường lạ bị bỏ
  })
})

describe('Goship: danh sách địa danh', () => {
  const realFetch = globalThis.fetch
  let calls
  const mock = (impl) => {
    calls = []
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, headers: opts.headers })
      return impl(url)
    }
  }
  const ok = (data) => ({ ok: true, status: 200, json: async () => ({ code: 200, status: 'success', data }) })
  const reset = () => {
    globalThis.fetch = realFetch
    delete process.env.GOSHIP_TOKEN
    delete process.env.GOSHIP_BASE_URL
    _resetGoshipCache()
  }

  test('gửi token và User-Agent riêng, chỉ trả id + tên (bỏ trường thừa), sắp theo tên có số tự nhiên', async () => {
    process.env.GOSHIP_TOKEN = 'tok'
    process.env.GOSHIP_BASE_URL = 'https://goship.test/api/v2/'
    mock(() => ok([{ id: 2, name: 'Quận 10', support_carriers: ['x'] }, { id: '1', name: 'Quận 2', support_carriers: [] }, { id: 3, name: 'Quận 1' }]))
    try {
      const rows = await listDistricts('700000')
      assert.deepEqual(rows, [{ id: '3', name: 'Quận 1' }, { id: '1', name: 'Quận 2' }, { id: '2', name: 'Quận 10' }])
      assert.equal(calls[0].url, 'https://goship.test/api/v2/cities/700000/districts') // bỏ dấu / cuối của URL gốc
      assert.equal(calls[0].headers.Authorization, 'Bearer tok')
      assert.match(calls[0].headers['User-Agent'], /Clevinum/)
    } finally {
      reset()
    }
  })

  test('giữ cache: gọi lại và nhiều khách cùng lúc chỉ tốn một lần gọi Goship', async () => {
    process.env.GOSHIP_TOKEN = 'tok'
    mock(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return ok([{ id: 1, name: 'Hà Nội' }])
    })
    try {
      await Promise.all([listCities(), listCities(), listCities()])
      await listCities()
      assert.equal(calls.length, 1)
    } finally {
      reset()
    }
  })

  test('Goship lỗi thì báo GoshipError 502 và không lưu lỗi vào cache', async () => {
    process.env.GOSHIP_TOKEN = 'tok'
    mock(() => ({ ok: false, status: 401, json: async () => ({ code: 401, status: 'error', data: { error: 'Unauthenticated.' } }) }))
    try {
      await assert.rejects(listCities(), (e) => e instanceof GoshipError && e.status === 502)
      mock(() => ok([{ id: 1, name: 'Hà Nội' }])) // lần sau Goship hồi lại: phải gọi lại được
      assert.equal((await listCities()).length, 1)
    } finally {
      reset()
    }
  })

  test('mất kết nối cũng thành GoshipError; mã địa danh chỉ nhận số; chưa có token thì goshipConfigured = false', async () => {
    process.env.GOSHIP_TOKEN = 'tok'
    mock(() => {
      throw new Error('ECONNRESET')
    })
    try {
      await assert.rejects(listCities(), (e) => e instanceof GoshipError)
    } finally {
      reset()
    }
    assert.equal(goshipConfigured(), false)
    assert.equal(isGoshipId('100000'), true)
    for (const bad of ['', 'abc', '1/../x', '1?x=1', '12345678901', undefined]) assert.equal(isGoshipId(bad), false)
  })
  test('checkGoship: chưa có token thì báo chưa cấu hình, không gọi mạng', async () => {
    mock(() => {
      throw new Error('không được gọi')
    })
    try {
      const r = await checkGoship()
      assert.deepEqual([r.configured, r.connected, calls.length], [false, false, 0])
    } finally {
      reset()
    }
  })

  test('checkGoship: token hợp lệ thì liệt kê hãng (gộp mã trùng tên, mã lạ giữ nguyên mã) và không lộ token', async () => {
    process.env.GOSHIP_TOKEN = 'secret-token'
    mock(() => ok([{ id: 1, name: 'Hà Nội', support_carriers: ['vtp', 'jnt', 'jnt2', 'xyz'] }, { id: 2, name: 'Đà Nẵng', support_carriers: ['vtp', 'ghnv3'] }]))
    try {
      const r = await checkGoship()
      assert.equal(r.connected, true)
      assert.equal(r.cities, 2)
      assert.deepEqual(r.carriers, [{ name: 'Giao Hàng Nhanh', codes: ['ghnv3'] }, { name: 'J&T Express', codes: ['jnt', 'jnt2'] }, { name: 'Viettel Post', codes: ['vtp'] }, { name: 'xyz', codes: ['xyz'] }])
      assert.ok(!JSON.stringify(r).includes('secret-token'))
    } finally {
      reset()
    }
  })

  test('checkGoship: Goship từ chối token (401) hoặc mất mạng thì báo không kết nối bằng lời của mình', async () => {
    process.env.GOSHIP_TOKEN = 'secret-token'
    mock(() => ({ ok: false, status: 401, json: async () => ({ code: 401, status: 'error', data: { error: 'Unauthenticated.' } }) }))
    try {
      const rejected = await checkGoship()
      assert.deepEqual([rejected.configured, rejected.connected], [true, false])
      assert.match(rejected.message, /từ chối token/)
      mock(() => {
        throw new Error('ECONNRESET secret-token')
      })
      const down = await checkGoship()
      assert.equal(down.connected, false)
      assert.ok(!down.message.includes('secret-token') && !down.message.includes('ECONNRESET'))
    } finally {
      reset()
    }
  })
})

describe('FORCE_HTTPS: chuyển http sang https', () => {
  const run = (req) => {
    const out = { next: false, redirect: null }
    forceHttps({ originalUrl: '/api/x?a=1', secure: false, ...req }, { redirect: (code, url) => (out.redirect = [code, url]) }, () => (out.next = true))
    return out
  }

  test('truy cập qua tên miền thật bằng http thì chuyển sang https (giữ đường dẫn và query)', () => {
    assert.deepEqual(run({ headers: { host: 'api.clevinium.com' } }).redirect, [308, 'https://api.clevinium.com/api/x?a=1'])
  })

  test('đã là https (qua proxy báo X-Forwarded-Proto) thì cho qua', () => {
    assert.equal(run({ headers: { host: 'api.clevinium.com' }, secure: true }).next, true)
  })

  test('truy cập localhost / 127.0.0.1 / [::1] (có hoặc không cổng) thì không chuyển', () => {
    for (const host of ['localhost:4000', 'localhost', '127.0.0.1:4000', '[::1]:4000', 'LocalHost:3000']) {
      const r = run({ headers: { host } })
      assert.equal(r.next, true, host)
      assert.equal(r.redirect, null, host)
    }
  })

  test('tên miền chỉ trông giống localhost thì vẫn bị chuyển (không lách được bằng tên miền giả)', () => {
    for (const host of ['localhost.evil.com', 'evil-localhost', 'xlocalhost:4000', 'localhost:4000.evil.com', '127.0.0.1.evil.com']) {
      assert.ok(run({ headers: { host } }).redirect, host)
    }
  })

  test('thiếu header Host thì vẫn chuyển hướng, không bỏ qua', () => {
    assert.ok(run({ headers: {} }).redirect)
  })
})

describe('vnNames.findByName', () => {
  const districts = [{ id: '1', name: 'Quận 1' }, { id: '4', name: 'Quận 10' }, { id: '2', name: 'Quận Tân Bình' }, { id: 'a', name: 'Quận Thủ Đức' }, { id: 'b', name: 'Huyện Thủ Đức' }]
  test('khớp tên không phân biệt dấu/hoa thường và bỏ tiền tố, không nhầm Quận 1 với Quận 10, không đoán khi mơ hồ', () => {
    assert.equal(findByName(districts, 'tan binh')?.id, '2')
    assert.equal(findByName(districts, 'Quận Tân Bình')?.id, '2')
    assert.equal(findByName(districts, 'Quận 1')?.id, '1')
    assert.equal(findByName(districts, '10')?.id, '4')
    assert.equal(findByName(districts, 'Thủ Đức'), undefined)
    assert.equal(findByName(districts, ''), undefined)
    assert.equal(findByName(districts, undefined), undefined)
  })
})

describe('tính cước vận chuyển qua Goship', () => {
  const realFetch = globalThis.fetch
  let rateCalls
  const RATES = [
    { id: 'Nl84XzkzOA==', carrier_name: 'Viettel Post', carrier_logo: 'https://x/vtp.png', service: 'Tiết kiệm', expected: 'Dự kiến giao trong 5 ngày', cod_fee: '22000', total_fee: '17000', total_amount: '39000' },
    { id: 'MTFfN181OTg=', carrier_name: 'Giao Hàng Tiết Kiệm', carrier_logo: 'https://x/ghtk.png', service: 'Nhanh', expected: 'Dự kiến giao trong 2 ngày', cod_fee: '0', total_fee: '18000', total_amount: '18000' },
    { id: 'bad1', carrier_name: 'Hỏng', total_amount: 'abc' },
  ]
  const lists = {
    '/cities': [{ id: 1, name: 'Hồ Chí Minh' }, { id: 2, name: 'Hà Nội' }],
    '/cities/1/districts': [{ id: 10, name: 'Quận 1' }],
    '/districts/10/wards': [{ id: 100, name: 'Phường Bến Nghé' }],
    '/cities/2/districts': [{ id: 20, name: 'Quận Hoàn Kiếm' }],
    '/districts/20/wards': [{ id: 200, name: 'Phường Hàng Bạc' }],
  }
  const install = ({ rates = RATES, ratesFail = false } = {}) => {
    rateCalls = []
    globalThis.fetch = async (url, opts = {}) => {
      const path = String(url).replace('https://api.goship.io/api/v2', '')
      if (path === '/rates') {
        rateCalls.push(JSON.parse(opts.body))
        if (ratesFail) return { ok: false, status: 500, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({ code: 200, status: 'success', data: rates }) }
      }
      return { ok: true, status: 200, json: async () => ({ data: lists[path] || [] }) }
    }
    process.env.GOSHIP_TOKEN = 't'
    _resetGoshipCache()
  }
  const done = () => {
    globalThis.fetch = realFetch
    delete process.env.GOSHIP_TOKEN
    _resetGoshipCache()
  }
  const settings = (over = {}, goship = {}) => ({
    shipping: { fee: 25000, freeShippingOver: 0, ...over, goship: { enabled: true, defaultWeightGrams: 4000, origin: { province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Bạc' }, ...goship } },
  })
  const address = { province: 'Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé' }

  test('tắt hoặc chưa có token thì không gọi Goship', async () => {
    install()
    try {
      assert.equal((await quoteShipping({ settings: settings({}, { enabled: false }), address, subtotal: 100000, cod: 0 })).status, 'disabled')
      delete process.env.GOSHIP_TOKEN
      assert.equal((await quoteShipping({ settings: settings(), address, subtotal: 100000, cod: 0 })).status, 'disabled')
      assert.equal(rateCalls.length, 0)
    } finally {
      done()
    }
  })

  test('đơn COD: Goship cộng tiền thu hộ vào total_amount, nhưng phí khách trả chỉ là total_fee + cod_fee', async () => {
    // Số liệu lấy từ lần hỏi cước thật (cod 413.565đ): total_fee 22.000, cod_fee 0, total_amount 435.565.
    install({ rates: [{ id: 'real', carrier_name: 'Best Express', service: 'Nhanh', total_fee: '22000', cod_fee: '0', total_amount: '435565' }, { id: 'withCodFee', carrier_name: 'X', service: 'Y', total_fee: '30000', cod_fee: '5000', total_amount: '448565' }] })
    try {
      const q = await quoteShipping({ settings: settings(), address, subtotal: 413565, cod: 413565 })
      assert.deepEqual(q.options.map((o) => [o.carrier, o.fee]), [['Best Express', 22000], ['X', 35000]])
    } finally {
      done()
    }
  })

  test('hỏi cước: gửi mã Goship, cân nặng 4000g cho cả đơn, COD và khai giá theo tiền hàng; trả lựa chọn rẻ trước, bỏ dòng hỏng', async () => {
    install()
    try {
      const q = await quoteShipping({ settings: settings(), address, subtotal: 413565, cod: 413565 })
      assert.equal(q.status, 'ok')
      assert.deepEqual(q.options.map((o) => [o.carrier, o.service, o.fee]), [['Giao Hàng Tiết Kiệm', 'Nhanh', 18000], ['Viettel Post', 'Tiết kiệm', 39000]]) // total_amount, rẻ trước
      assert.deepEqual(rateCalls[0].shipment.address_from, { city: '2', district: '20', ward: '200' })
      assert.deepEqual(rateCalls[0].shipment.address_to, { city: '1', district: '10', ward: '100' })
      assert.deepEqual(rateCalls[0].shipment.parcel, { cod: '413565', amount: '413565', weight: '4000', width: '1', height: '1', length: '1' })
    } finally {
      done()
    }
  })

  test('chuyển khoản trước thì không thu hộ (cod = 0); cân nặng lấy theo Cài đặt', async () => {
    install()
    try {
      await quoteShipping({ settings: settings({}, { defaultWeightGrams: 2500 }), address, subtotal: 100000, cod: 0 })
      assert.equal(rateCalls[0].shipment.parcel.cod, '0')
      assert.equal(rateCalls[0].shipment.parcel.weight, '2500')
    } finally {
      done()
    }
  })

  test('đơn đủ mức miễn phí vận chuyển thì mọi lựa chọn có phí 0 (giữ originalFee để biết cước thật)', async () => {
    install()
    try {
      const q = await quoteShipping({ settings: settings({ freeShippingOver: 300000 }), address, subtotal: 413565, cod: 0 })
      assert.deepEqual(q.options.map((o) => [o.fee, o.originalFee]), [[0, 18000], [0, 39000]])
    } finally {
      done()
    }
  })

  test('địa chỉ chưa chọn đủ hoặc không khớp Goship -> incomplete; kho gửi hàng sai -> error; Goship lỗi -> error (không ném lỗi)', async () => {
    install()
    try {
      assert.equal((await quoteShipping({ settings: settings(), address: { ...address, ward: '' }, subtotal: 1, cod: 0 })).status, 'incomplete')
      assert.equal((await quoteShipping({ settings: settings(), address: { ...address, ward: 'Phường Không Có' }, subtotal: 1, cod: 0 })).status, 'incomplete')
      assert.equal((await quoteShipping({ settings: settings({}, { origin: { province: '', district: '', ward: '' } }), address, subtotal: 1, cod: 0 })).reason, 'origin')
      install({ ratesFail: true })
      assert.equal((await quoteShipping({ settings: settings(), address, subtotal: 1, cod: 0 })).status, 'error')
      install({ rates: [{ id: 'x', carrier_name: 'A', total_amount: '-5' }] }) // toàn dòng hỏng
      assert.equal((await quoteShipping({ settings: settings(), address, subtotal: 1, cod: 0 })).status, 'error')
    } finally {
      done()
    }
  })

  test('chooseShipping: có báo giá thì bắt buộc chọn đúng lựa chọn, không thì phí cố định; client không tự đặt giá được', () => {
    const st = settings({ fee: 25000 })
    const ok = { status: 'ok', options: [{ id: 'a', carrier: 'GHTK', service: 'Nhanh', fee: 18000 }, { id: 'b', carrier: 'VTP', service: '', fee: 39000 }] }
    assert.deepEqual(chooseShipping(st, 100000, ok, 'a'), { fee: 18000, label: 'GHTK – Nhanh (Goship)', service: 'Nhanh', carrier: 'GHTK', express: undefined })
    assert.deepEqual(chooseShipping(st, 100000, ok, 'b'), { fee: 39000, label: 'VTP (Goship)', service: '', carrier: 'VTP', express: undefined })
    assert.equal(chooseShipping(st, 100000, ok, undefined).error, 'SHIPPING_CHANGED') // không chọn: không được hưởng phí cố định rẻ hơn
    assert.equal(chooseShipping(st, 100000, ok, 'zzz').error, 'SHIPPING_CHANGED') // mã không còn hiệu lực
    for (const status of ['disabled', 'incomplete', 'error']) {
      assert.deepEqual(chooseShipping(st, 100000, { status, options: [] }, 'a'), { fee: 25000, label: null, service: null, carrier: null, express: false }, status)
    }
    assert.equal(chooseShipping(settings({ fee: 25000, freeShippingOver: 50000 }), 100000, { status: 'disabled', options: [] }).fee, 0)
  })

  test('cài đặt: bật Goship phải có kho gửi hàng đủ ba cấp; cân nặng trong khoảng cho phép; client cũ chỉ gửi phí vẫn hợp lệ', () => {
    const base = { fee: 25000, freeShippingOver: 0 }
    const goship = (g) => ({ ...base, goship: { enabled: true, defaultWeightGrams: 4000, origin: { province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Bạc' }, ...g } })
    assert.equal(shippingSchema.safeParse(base).success, true)
    assert.equal(shippingSchema.safeParse(goship({})).success, true)
    assert.equal(shippingSchema.safeParse(goship({ origin: { province: 'Hà Nội', district: '', ward: '' } })).success, false)
    assert.equal(shippingSchema.safeParse(goship({ enabled: false, origin: { province: '', district: '', ward: '' } })).success, true) // tắt thì không cần kho
    for (const w of [0, 99, 100001, 40.5, '4000']) assert.equal(shippingSchema.safeParse(goship({ defaultWeightGrams: w })).success, false, String(w))
  })

  test('hỏi cước chỉ nhận giỏ hàng + địa chỉ, tiền do client gửi bị bỏ', () => {
    const r = shippingQuoteSchema.safeParse({ items: [{ productId: 'sp1', quantity: 2, unitPrice: 1 }], paymentMethod: 'COD', province: 'Hà Nội', total: 5 })
    assert.equal(r.success, true)
    assert.equal('total' in r.data, false)
    assert.equal('unitPrice' in r.data.items[0], false)
    assert.equal(shippingQuoteSchema.safeParse({ items: [], paymentMethod: 'COD', province: 'Hà Nội' }).success, false)
  })
})

describe('Goship: chữ ký webhook', () => {
  const secret = 'client-secret-test'
  const payload = { gcode: 'GS6ZE234V6', order_id: 'CLV123', status: '901', status_text: 'Chờ lấy hàng', tracking_url: 'https://donhang.ghn.vn/?order_code=GAPBLXAE' }
  const raw = JSON.stringify(payload)
  const h = (data, enc) => {
    const bin = createHmac('sha256', secret).update(data).digest()
    return enc === 'bin' ? bin.toString('base64') : enc === 'hexb64' ? Buffer.from(bin.toString('hex')).toString('base64') : bin.toString('hex')
  }

  test('nhận mọi cách ký mà tài liệu có thể ngụ ý: thân gốc / JSON dựng lại / JSON kiểu PHP, base64 nhị phân / base64(hex) / hex', () => {
    for (const [data, name] of [[raw, 'thân gốc'], [phpJsonEncode(payload), 'JSON kiểu PHP']]) {
      for (const enc of ['bin', 'hexb64', 'hex']) {
        const r = verifyGoshipSignature({ rawBody: raw, parsed: payload, header: h(data, enc), secret })
        assert.equal(r.ok, true, `${name}/${enc}`)
      }
    }
  })

  test('JSON kiểu PHP thoát dấu / và ký tự tiếng Việt như json_encode mặc định', () => {
    assert.equal(phpJsonEncode({ a: 'Chờ lấy hàng', u: 'x/y' }), '{"a":"Ch\\u1edd l\\u1ea5y h\\u00e0ng","u":"x\\/y"}')
  })

  test('sai khóa, thiếu header, thiếu khóa, thân bị sửa đều không hợp lệ', () => {
    const good = h(raw, 'bin')
    assert.equal(verifyGoshipSignature({ rawBody: raw, parsed: payload, header: good, secret: 'khoa-khac' }).ok, false)
    assert.equal(verifyGoshipSignature({ rawBody: raw, parsed: payload, header: '', secret }).ok, false)
    assert.equal(verifyGoshipSignature({ rawBody: raw, parsed: payload, header: good, secret: '' }).ok, false)
    const tampered = { ...payload, status: '905' }
    assert.equal(verifyGoshipSignature({ rawBody: JSON.stringify(tampered), parsed: tampered, header: good, secret }).ok, false)
    assert.equal(verifyGoshipSignature({ rawBody: raw, parsed: payload, header: 'abc', secret }).ok, false)
  })
})

describe('Goship: trạng thái vận đơn', () => {
  test('ánh xạ mã Goship sang trạng thái của mình', () => {
    const t = { 901: 'AWAITING_PICKUP', 902: 'AWAITING_PICKUP', 903: 'PICKED_UP', 904: 'OUT_FOR_DELIVERY', 905: 'DELIVERED', 906: 'FAILED', 907: 'RETURNING', 908: 'RETURNED', 913: 'DELIVERED', 917: 'FAILED', 919: 'IN_TRANSIT' }
    for (const [code, local] of Object.entries(t)) assert.equal(mapGoshipStatus(code).local, local, code)
    assert.equal(mapGoshipStatus('905').local, 'DELIVERED') // mã dạng chuỗi như trong webhook
    for (const code of [900, 909, 910, 911, 912, 915, 916, 918, 1000, 999]) assert.equal(mapGoshipStatus(code).local, undefined, String(code)) // chỉ ghi nhận, không đổi trạng thái
    assert.equal(mapGoshipStatus(914).cancel, true)
  })

  test('chỉ đi tới: bỏ qua webhook trễ/lặp, cho nhảy bước, vận đơn đã kết thúc hoặc đã hủy thì bỏ qua', () => {
    assert.equal(nextShippingStatus('AWAITING_PICKUP', 'PICKED_UP'), 'PICKED_UP')
    assert.equal(nextShippingStatus('PICKED_UP', 'OUT_FOR_DELIVERY'), 'OUT_FOR_DELIVERY') // bỏ qua "trung chuyển"
    assert.equal(nextShippingStatus('AWAITING_PICKUP', 'DELIVERED'), 'DELIVERED')
    assert.equal(nextShippingStatus('OUT_FOR_DELIVERY', 'PICKED_UP'), null) // đến trễ, lùi
    assert.equal(nextShippingStatus('PICKED_UP', 'PICKED_UP'), null)
    assert.equal(nextShippingStatus('DELIVERED', 'FAILED'), null)
    assert.equal(nextShippingStatus('RETURNED', 'DELIVERED'), null)
    assert.equal(nextShippingStatus('NOT_CREATED', 'PICKED_UP'), null) // vận đơn đã hủy không "sống lại"
  })

  test('giao thất bại, hoàn hàng và giao lại', () => {
    assert.equal(nextShippingStatus('OUT_FOR_DELIVERY', 'FAILED'), 'FAILED')
    assert.equal(nextShippingStatus('FAILED', 'RETURNING'), 'RETURNING')
    assert.equal(nextShippingStatus('RETURNING', 'RETURNED'), 'RETURNED')
    assert.equal(nextShippingStatus('RETURNING', 'FAILED'), null)
    assert.equal(nextShippingStatus('RETURNING', 'OUT_FOR_DELIVERY'), null) // đang hoàn thì bỏ qua mốc giao thường
    assert.equal(nextShippingStatus('FAILED', 'OUT_FOR_DELIVERY'), 'OUT_FOR_DELIVERY') // hãng giao lại
    assert.equal(nextShippingStatus('FAILED', 'PICKED_UP'), null)
  })

  test('chuẩn hóa webhook và dữ liệu API Goship về cùng một dạng', () => {
    const p = normalizeWebhook({ gcode: 'G1', code: 'C1', order_id: 'CLV1', status: 905, status_text: 'Giao thành công', fee: '35650', cod: '0' })
    assert.deepEqual([p.gcode, p.code, p.orderId, p.status, p.fee], ['G1', 'C1', 'CLV1', '905', 35650])
    assert.equal(normalizeWebhook(null).gcode, '') // thân rỗng/không phải đối tượng không gây lỗi
    const api = fromApiShipment({ id: 'G1', status_code: 904, status_text: 'Giao hàng', fee: 36000, tracking_url: 'https://x' }, p)
    assert.deepEqual([api.gcode, api.status, api.statusText, api.fee, api.trackingUrl], ['G1', '904', 'Giao hàng', 36000, 'https://x'])
  })
})

describe('Goship: thân vận đơn gửi đi', () => {
  const settings = { shipping: { goship: { defaultWeightGrams: 4000, origin: { name: 'Kho CLEVI', phone: '0356789749', street: '47 Linh Đông', province: 'Hồ Chí Minh', district: 'Thủ Đức', ward: 'Linh Đông' } } } }
  const order = (over = {}) => ({ orderNumber: 'CLV1001', recipientName: 'Nguyễn An', recipientPhone: '0900000000', addressLine: '12 Cộng Hòa', subtotal: 413565, total: 438565, paymentMethod: 'COD', ...over })
  const ids = { from: { city: '700000', district: '701', ward: '10' }, to: { city: '100000', district: '100200', ward: '79' } }

  test('đơn COD: thu hộ đúng tổng khách trả, shop trả cước (payer 1), mã đơn của mình, cân nặng cố định, kích thước tối thiểu', () => {
    const b = buildShipmentBody({ order: order(), settings, rateId: 'RATE1', ...ids })
    assert.equal(b.rate, 'RATE1')
    assert.equal(b.payer, 1)
    assert.equal(b.order_id, 'CLV1001')
    assert.deepEqual(b.address_from, { name: 'Kho CLEVI', phone: '0356789749', street: '47 Linh Đông', city: '700000', district: '701', ward: '10' })
    assert.deepEqual(b.address_to, { name: 'Nguyễn An', phone: '0900000000', street: '12 Cộng Hòa', city: '100000', district: '100200', ward: '79' })
    assert.deepEqual(b.parcel, { cod: '438565', amount: '413565', weight: '4000', width: '1', height: '1', length: '1', metadata: 'Đơn CLV1001' })
  })

  test('đơn đã chuyển khoản: không thu hộ', () => {
    assert.equal(buildShipmentBody({ order: order({ paymentMethod: 'Chuyển khoản' }), settings, rateId: 'R', ...ids }).parcel.cod, '0')
  })
})

describe('Goship: client vận đơn', () => {
  const realFetch = globalThis.fetch
  const reply = (status, json) => ({ ok: status < 400, status, json: async () => json })
  let calls
  const mock = (impl) => {
    calls = []
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null })
      return impl(url, opts)
    }
    process.env.GOSHIP_TOKEN = 't'
    process.env.GOSHIP_BASE_URL = 'https://goship.test/api/v2'
  }
  const done = () => {
    globalThis.fetch = realFetch
    delete process.env.GOSHIP_TOKEN
    delete process.env.GOSHIP_BASE_URL
  }

  test('tạo vận đơn: gửi POST /shipments bọc trong "shipment", đọc kết quả ở cấp ngoài cùng', async () => {
    mock(() => reply(200, { code: 200, status: 'success', id: 'GSOX6OQQLQ', shipment_status: 901, fee: '22000', tracking_number: 'G8SKL8SS', carrier: 'Giao Hàng Nhanh', carrier_short_name: 'GHN' }))
    try {
      const d = await createGoshipShipment({ rate: 'R1', payer: 1 })
      assert.deepEqual([calls[0].method, calls[0].url, calls[0].body], ['POST', 'https://goship.test/api/v2/shipments', { shipment: { rate: 'R1', payer: 1 } }])
      assert.deepEqual([d.id, d.shipment_status, d.tracking_number], ['GSOX6OQQLQ', 901, 'G8SKL8SS'])
    } finally {
      done()
    }
  })

  test('tạo vận đơn: Goship báo lỗi thì ném lỗi kèm lời của Goship; mất mạng thì đánh dấu network để dò lại', async () => {
    mock(() => reply(422, { code: 422, status: 'error', message: 'Rate không hợp lệ' }))
    try {
      await assert.rejects(createGoshipShipment({}), (e) => /Rate không hợp lệ/.test(e.message) && !e.network)
      globalThis.fetch = async () => {
        throw new Error('ECONNRESET')
      }
      await assert.rejects(createGoshipShipment({}), (e) => e.network === true)
    } finally {
      done()
    }
  })

  test('hủy vận đơn: DELETE /shipments/{id}; 404 giữ mã 404; mã lạ bị chặn trước khi gọi mạng', async () => {
    mock(() => reply(200, { code: 200, status: 'success' }))
    try {
      assert.equal(await cancelGoshipShipment('56GDG8F'), true)
      assert.deepEqual([calls[0].method, calls[0].url], ['DELETE', 'https://goship.test/api/v2/shipments/56GDG8F'])
      mock(() => reply(404, { code: 404, status: 'Error', data: 'Resource Not Found', message: 'Not Found' }))
      await assert.rejects(cancelGoshipShipment('NOPE123'), (e) => e.status === 404)
      mock(() => reply(200, { code: 200 }))
      await assert.rejects(cancelGoshipShipment('../x'), /không hợp lệ/)
      assert.equal(calls.length, 0)
    } finally {
      done()
    }
  })

  test('tìm vận đơn theo mã: trả phần tử đầu hoặc null; mã lạ không gọi mạng', async () => {
    mock((url) => reply(200, { data: url.includes('code=CLV1') ? [{ id: 'G1', status_code: 901 }, { id: 'G2' }] : [] }))
    try {
      assert.equal((await searchGoshipShipment('CLV1')).id, 'G1')
      assert.equal(await searchGoshipShipment('CLV2'), null)
      assert.equal(await searchGoshipShipment('a b'), null)
      assert.equal(calls.length, 2)
      assert.equal(isGoshipCode('GSOX6OQQLQ'), true)
      assert.equal(isGoshipCode('a/b'), false)
    } finally {
      done()
    }
  })
})

describe('cài đặt tạo vận đơn thật', () => {
  const origin = { province: 'Hồ Chí Minh', district: 'Thủ Đức', ward: 'Linh Đông', street: '47 Linh Đông', name: 'Kho CLEVI', phone: '0356 789 749' }
  const body = (g) => ({ fee: 0, freeShippingOver: 0, goship: { enabled: true, defaultWeightGrams: 4000, origin, ...g } })

  test('mặc định tắt; bật phải có tính cước Goship và đủ thông tin người gửi', () => {
    assert.equal(shippingSchema.safeParse(body({})).data.goship.createShipments, false)
    assert.equal(shippingSchema.safeParse(body({ createShipments: true })).success, true)
    assert.equal(shippingSchema.safeParse(body({ createShipments: true, enabled: false })).success, false)
    for (const miss of ['street', 'name', 'phone']) assert.equal(shippingSchema.safeParse(body({ createShipments: true, origin: { ...origin, [miss]: '' } })).success, false, miss)
    assert.equal(shippingSchema.safeParse(body({ createShipments: true, origin: { ...origin, phone: 'abc' } })).success, false)
  })

  test('client cũ không gửi các trường mới vẫn hợp lệ', () => {
    const old = { fee: 0, freeShippingOver: 0, goship: { enabled: true, defaultWeightGrams: 4000, origin: { province: 'A', district: 'B', ward: 'C' } } }
    const r = shippingSchema.safeParse(old)
    assert.equal(r.success, true)
    assert.equal(r.data.goship.createShipments, false)
  })
})

describe('mã đơn hiển thị: mã vận đơn của hãng thay ORD-xxxxx khi đã có', () => {
  const order = (shipment) => ({ orderNumber: 'ORD-12345', shipment })
  test('chưa có vận đơn hoặc chưa có mã hãng -> dùng mã đơn', () => {
    assert.equal(displayCode(order(null)), 'ORD-12345')
    assert.equal(displayCode(order({ status: 'AWAITING_PICKUP', carrierCode: null })), 'ORD-12345')
  })
  test('có mã hãng -> dùng mã hãng', () => {
    assert.equal(displayCode(order({ status: 'IN_TRANSIT', carrierCode: 'GHN123' })), 'GHN123')
  })
  test('vận đơn đã hủy (NOT_CREATED) -> quay lại mã đơn', () => {
    assert.equal(displayCode(order({ status: 'NOT_CREATED', carrierCode: 'GHN123' })), 'ORD-12345')
  })
  test('chuẩn hóa mã: bỏ khoảng trắng, viết hoa', () => {
    assert.equal(normCode('  ghn123 '), 'GHN123')
    assert.equal(normCode(null), '')
  })
})

describe('vòng đời đơn kiểu Shopee', () => {
  const rules = { handleHours: 48, intracityHandleHours: 24, expressHandleHours: 6, cancelAutoApproveHours: 24, unpaidCancelHours: 24, autoReceiveDays: 7, returnWindowDays: 7, expressKeywords: 'hỏa tốc, instant', autoConfirmEnabled: true, autoConfirmCodMax: 0, autoConfirmDelayMinutes: 10, pickupCutoff: '15:30', pickupAlertHours: 24 }
  test('hạn xử lý = giờ đặt + handleHours, chỉ cho đơn còn việc', () => {
    const createdAt = new Date('2026-11-14T00:00:00Z')
    assert.equal(handleDueAt({ status: 'PENDING_CONFIRMATION', createdAt }, rules).toISOString(), '2026-11-16T00:00:00.000Z')
    assert.equal(handleDueAt({ status: 'SHIPPING', createdAt }, rules), null)
    assert.equal(handleDueAt({ status: 'CANCELLED', createdAt }, rules), null)
    assert.equal(handleDueAt({ status: 'PENDING_CONFIRMATION', createdAt }, { ...rules, handleHours: 0 }), null)
  })

  const base = { orderNumber: 'X', status: 'PENDING_CONFIRMATION', items: [{ id: 'i1', productId: 'p1', review: null }], statusEvents: [], recipientName: 'A B', cancelRequestedAt: null, receivedAt: null, returnRequest: null }
  test('khách hủy ngay khi chờ xác nhận, gửi yêu cầu khi đã xác nhận, không hủy khi đang giao', () => {
    assert.equal(publicOrderView(base).actions.cancel, 'now')
    assert.equal(publicOrderView({ ...base, status: 'CONFIRMED' }).actions.cancel, 'request')
    assert.equal(publicOrderView({ ...base, status: 'PROCESSING', cancelRequestedAt: new Date() }).actions.cancel, null)
    assert.equal(publicOrderView({ ...base, status: 'SHIPPING' }).actions.cancel, null)
  })
  test('đã giao: được xác nhận nhận hàng, đánh giá; trả hàng theo canReturn', () => {
    const a = publicOrderView({ ...base, status: 'DELIVERED' }, { canReturn: true }).actions
    assert.deepEqual([a.received, a.review, a.return], [true, true, true])
    const b = publicOrderView({ ...base, status: 'DELIVERED', receivedAt: new Date(), items: [{ id: 'i1', productId: 'p1', review: { rating: 5 } }] }).actions
    assert.deepEqual([b.received, b.review, b.return], [false, false, false])
  })
  test('bản che thông tin (chỉ có mã đơn) không có thao tác nào', () => {
    assert.deepEqual(publicOrderView({ ...base, status: 'DELIVERED' }, { masked: true }).actions, {})
  })
  test('cài đặt quy tắc đơn hàng: số nguyên không âm', () => {
    assert.ok(ordersSchema.safeParse(rules).success)
    assert.ok(ordersSchema.safeParse({ ...rules, unpaidCancelHours: 0 }).success) // 0 = tắt
    assert.ok(!ordersSchema.safeParse({ ...rules, handleHours: -1 }).success)
    assert.ok(!ordersSchema.safeParse({ ...rules, autoReceiveDays: 1.5 }).success)
  })
  test('đánh giá: 1-5 sao, tối thiểu 1 đánh giá; hủy cần lý do', () => {
    const ok = { reviews: [{ orderItemId: 'a', rating: 5, comment: 'Đẹp' }] }
    assert.ok(reviewMyOrderSchema.safeParse(ok).success)
    assert.ok(!reviewMyOrderSchema.safeParse({ reviews: [{ orderItemId: 'a', rating: 0 }] }).success)
    assert.ok(!reviewMyOrderSchema.safeParse({ reviews: [] }).success)
    assert.ok(!cancelMyOrderSchema.safeParse({ orderNumber: 'X', phone: '0900000000' }).success)
  })
  test('chuyển hàng loạt chỉ sang Đã xác nhận / Đang xử lý', () => {
    assert.ok(bulkOrderStatusSchema.safeParse({ ids: ['a'], status: 'CONFIRMED' }).success)
    assert.ok(!bulkOrderStatusSchema.safeParse({ ids: ['a'], status: 'DELIVERED' }).success)
    assert.ok(!bulkOrderStatusSchema.safeParse({ ids: [], status: 'CONFIRMED' }).success)
  })
})

describe('loại đơn: hỏa tốc / nội thành / liên tỉnh', () => {
  const settings = {
    orders: { expressKeywords: 'hỏa tốc, hoả tốc, instant, trong ngày' },
    shipping: { goship: { origin: { province: 'Hồ Chí Minh' } } },
    store: { address: 'Phường Hiệp Bình, TP. Hồ Chí Minh' },
  }
  test('nhận ra dịch vụ hỏa tốc theo từ khóa, bỏ qua dấu và hoa thường, không nhầm tên hãng', () => {
    assert.equal(isExpressService('Giao Hỏa Tốc', settings.orders.expressKeywords), true)
    assert.equal(isExpressService('Giao hoa toc 2h', settings.orders.expressKeywords), true)
    assert.equal(isExpressService('Instant', settings.orders.expressKeywords), true)
    assert.equal(isExpressService('Giao tiết kiệm', settings.orders.expressKeywords), false)
    assert.equal(isExpressService('', settings.orders.expressKeywords), false)
    assert.equal(isExpressService('Hỏa tốc', ''), false) // chưa khai từ khóa thì không có hỏa tốc
  })
  test('nội thành = cùng tỉnh/thành với kho gửi, so khớp không phân biệt tiền tố và dấu', () => {
    for (const p of ['Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'ho chi minh']) assert.equal(isSameCity(p, settings), true, p)
    for (const p of ['Hà Nội', 'Tỉnh Bình Dương', '']) assert.equal(isSameCity(p, settings), false, p)
  })
  test('chưa chọn kho gửi thì so với địa chỉ cửa hàng', () => {
    const noOrigin = { ...settings, shipping: { goship: { origin: { province: '' } } } }
    assert.equal(isSameCity('Hồ Chí Minh', noOrigin), true)
    assert.equal(isSameCity('Đà Nẵng', noOrigin), false)
  })
  test('phân loại: hỏa tốc thắng nội thành; còn lại theo tỉnh', () => {
    assert.equal(classifyDelivery({ province: 'Hồ Chí Minh', service: 'Hỏa tốc' }, settings), 'EXPRESS')
    assert.equal(classifyDelivery({ province: 'Hồ Chí Minh', service: 'Giao nhanh' }, settings), 'INTRACITY')
    assert.equal(classifyDelivery({ province: 'Hà Nội', service: null }, settings), 'INTERPROVINCE')
    assert.equal(deliveryTypeOf({ deliveryType: 'EXPRESS', province: 'Hà Nội' }, settings), 'EXPRESS') // đã lưu thì dùng giá trị đã lưu
    assert.equal(deliveryTypeOf({ deliveryType: null, province: 'Hồ Chí Minh' }, settings), 'INTRACITY') // đơn cũ: suy ra từ địa chỉ
  })
  test('hạn xử lý theo loại đơn', () => {
    const rules = { handleHours: 48, intracityHandleHours: 24, expressHandleHours: 6 }
    const createdAt = new Date('2026-11-14T00:00:00Z')
    const due = (type) => handleDueAt({ status: 'CONFIRMED', createdAt }, rules, type).toISOString()
    assert.equal(due('EXPRESS'), '2026-11-14T06:00:00.000Z')
    assert.equal(due('INTRACITY'), '2026-11-15T00:00:00.000Z')
    assert.equal(due('INTERPROVINCE'), '2026-11-16T00:00:00.000Z')
    assert.equal(handleDueAt({ status: 'CONFIRMED', createdAt }, { ...rules, expressHandleHours: 0 }, 'EXPRESS'), null) // 0 = không đếm loại này
  })
})

describe('khối lượng tính cước và giờ chốt đơn', () => {
  const w = { a: 500, b: 1200 }
  const weightOf = (id) => w[id] || 0
  test('đủ khối lượng thật thì cộng theo số lượng', () => {
    assert.equal(orderWeightGrams([{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }], 4000, weightOf), 2200)
  })
  test('thiếu khối lượng của một món thì dùng cân nặng cố định (không báo cước thấp hơn thực tế)', () => {
    assert.equal(orderWeightGrams([{ productId: 'a', quantity: 1 }, { productId: 'x', quantity: 1 }], 4000, weightOf), 4000)
    assert.equal(orderWeightGrams([], 4000, weightOf), 4000)
  })
  test('giới hạn trong khoảng Goship nhận', () => {
    assert.equal(orderWeightGrams([{ productId: 'a', quantity: 1000 }], 4000, weightOf), 100000)
    assert.equal(orderWeightGrams([{ productId: 'a', quantity: 1 }], 4000, () => 10), 100)
  })
  test('giờ chốt đơn tính theo giờ Việt Nam', () => {
    // 2026-11-14 05:00 UTC = 12:00 giờ VN -> mốc 15:30 VN = 08:30 UTC cùng ngày
    assert.equal(cutoffToday('15:30', new Date('2026-11-14T05:00:00Z')).toISOString(), '2026-11-14T08:30:00.000Z')
    // 2026-11-14 20:00 UTC = 03:00 ngày 15 giờ VN -> mốc của ngày 15
    assert.equal(cutoffToday('15:30', new Date('2026-11-14T20:00:00Z')).toISOString(), '2026-11-15T08:30:00.000Z')
    assert.equal(cutoffToday('', new Date()), null)
    assert.equal(cutoffToday('25:99', new Date()), null)
  })
})

describe('giao hỏa tốc qua Goship (Ahamove, Grab)', () => {
  const realFetch = globalThis.fetch
  const row = (over = {}) => ({ _id: 'HAN-BIKE', description_vi_vn: 'Lấy hàng ngay, giao hỏa tốc', carrier: 1, carrier_name: 'Ahamove', total_fee: 32500, max_cod: 10000000, estimated_time: { pickup: '2026-11-14 10:00:00', dropoff: '2026-11-14 10:35:00' }, ...over })

  test('phương án hỏa tốc: mã, giá, thời gian dự kiến, bỏ dòng hỏng và dòng vượt mức thu hộ', () => {
    const o = toExpressOption(row())
    assert.deepEqual([o.id, o.carrier, o.fee, o.express, o.onDemand, o.serviceId, o.carrierId], ['OD|HAN-BIKE|1', 'Ahamove', 32500, true, true, 'HAN-BIKE', 1])
    assert.match(o.service, /^Hỏa tốc/)
    assert.match(o.expected, /35 phút/)
    assert.equal(toExpressOption(row({ _id: undefined })), null)
    assert.equal(toExpressOption(row({ total_fee: 'x' })), null)
    assert.equal(toExpressOption(row({ max_cod: 1000000 }), { cod: 2000000 }), null) // vượt mức thu hộ tối đa của dịch vụ
    assert.ok(toExpressOption(row({ max_cod: 1000000 }), { cod: 500000 }))
  })

  test('nội dung gửi Goship: điểm lấy kind 1, điểm giao kind 2 kèm kiện hàng, thu hộ và khối lượng', () => {
    const rates = buildOndemandRatesBody({ from: { lat: 10.8, lng: 106.7 }, to: { lat: 10.78, lng: 106.69 }, weightGrams: 1500, name: 'Đơn A' })
    assert.deepEqual(rates.paths.map((p) => p.kind), [1, 2])
    assert.equal(rates.paths[1].parcel.weight, 1500)
    const settings = { shipping: { goship: { origin: { street: '47 Linh Đông', ward: 'Linh Đông', district: 'Thủ Đức', province: 'Hồ Chí Minh', name: 'Kho', phone: '0900000000' } } } }
    const order = { orderNumber: 'N1', recipientName: 'A', recipientPhone: '0911111111', addressLine: '1 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'Hồ Chí Minh', subtotal: 100000 }
    const b = buildOndemandShipmentBody({ order, settings, option: toExpressOption(row()), from: { lat: 10.8, lng: 106.7 }, to: { lat: 10.78, lng: 106.69 }, weightGrams: 1500, cod: 130000 })
    assert.deepEqual([b.order_id, b.carrier, b.vehicle, b.service], ['N1', 1, 'BIKE', 'HAN-BIKE'])
    assert.equal(b.paths[0].address, '47 Linh Đông, Linh Đông, Thủ Đức, Hồ Chí Minh')
    assert.deepEqual([b.paths[1].parcel.cod_amount, b.paths[1].parcel.weight, b.paths[1].parcel.amount], [130000, 1500, 100000])
  })

  test('mã trạng thái hỏa tốc KHÁC đơn thường: 905 đang giao (hỏa tốc) nhưng đã giao (thường)', () => {
    assert.equal(mapOndemandStatus(905).local, 'OUT_FOR_DELIVERY')
    assert.equal(mapGoshipStatus(905).local, 'DELIVERED')
    assert.equal(mapOndemandStatus(906).local, 'DELIVERED')
    assert.equal(mapOndemandStatus(904).local, 'PICKED_UP')
    assert.equal(mapOndemandStatus(911).cancel, true)
    assert.equal(mapOndemandStatus(907).local, 'FAILED')
    assert.deepEqual(mapOndemandStatus(12345), {})
  })

  test('webhook nhận biết đơn hỏa tốc qua cờ is_ondemand_shipment', () => {
    assert.equal(normalizeWebhook({ gcode: 'G1', status: 905, is_ondemand_shipment: true }).onDemand, true)
    assert.equal(normalizeWebhook({ gcode: 'G1', status: 905 }).onDemand, false)
  })

  describe('tìm tọa độ từ địa chỉ', () => {
    let calls
    const install = (handler) => {
      calls = []
      process.env.NOMINATIM_GAP_MS = '0'
      _clearGeocodeCache()
      globalThis.fetch = async (url) => {
        calls.push(String(url))
        return { ok: true, status: 200, json: async () => handler(String(url)) }
      }
    }
    const restore = () => {
      globalThis.fetch = realFetch
      delete process.env.NOMINATIM_GAP_MS
      delete process.env.GEOCODE_PROVIDER
      _clearGeocodeCache()
    }
    const hcm = (lat = '10.7769', lon = '106.7009') => [{ lat, lon }]

    test('có số nhà thì cấp "address"; chỉ tra được phường thì tụt xuống "ward"', async () => {
      install((u) => (u.includes('S%E1%BB%91+') || u.includes('%C4%90%C6%B0%E1%BB%9Dng+Test') ? [] : hcm()))
      try {
        const full = await geocodeAddress({ addressLine: '10 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'Hồ Chí Minh' })
        assert.deepEqual([full.level, full.lat, full.lng, full.source], ['address', 10.7769, 106.7009, 'nominatim'])
        _clearGeocodeCache()
        install((u) => (decodeURIComponent(u).includes('Đường Test') ? [] : hcm()))
        const coarse = await geocodeAddress({ addressLine: 'Đường Test 5', ward: 'Bến Nghé', district: 'Quận 1', province: 'Hồ Chí Minh' })
        assert.equal(coarse.level, 'ward')
      } finally {
        restore()
      }
    })

    test('maxLevel=ward bỏ qua bước số nhà (báo cước cho khách); kết quả được nhớ, không tra lại', async () => {
      install(() => hcm())
      try {
        const addr = { addressLine: '99 ABC', ward: 'Phường Z', district: 'Quận Y', province: 'Hồ Chí Minh' }
        const a = await geocodeAddress(addr, { maxLevel: 'ward' })
        const b = await geocodeAddress(addr, { maxLevel: 'ward' })
        assert.equal(a.level, 'ward')
        assert.equal(calls.length, 1)
        assert.deepEqual([b.lat, b.lng], [a.lat, a.lng])
        assert.ok(!decodeURIComponent(calls[0]).includes('99 ABC'))
      } finally {
        restore()
      }
    })

    test('loại kết quả ngoài Việt Nam, không tìm thấy, hoặc lỗi mạng', async () => {
      try {
        install(() => hcm('51.5', '-0.12')) // Luân Đôn
        assert.equal(await geocodeAddress({ ward: 'P1', district: 'Q1', province: 'Hồ Chí Minh' }), null)
        install(() => [])
        assert.equal(await geocodeAddress({ ward: 'P2', district: 'Q2', province: 'Hồ Chí Minh' }), null)
        globalThis.fetch = async () => { throw new Error('offline') }
        _clearGeocodeCache()
        assert.equal(await geocodeAddress({ ward: 'P3', district: 'Q3', province: 'Hồ Chí Minh' }), null)
      } finally {
        restore()
      }
    })

    test('chọn nguồn Goong khi có khóa', async () => {
      install((u) => (u.includes('rsapi.goong.io') ? { results: [{ geometry: { location: { lat: 10.7, lng: 106.6 } } }] } : []))
      process.env.GEOCODE_PROVIDER = 'goong'
      process.env.GOONG_API_KEY = 'k'
      try {
        const r = await geocodeAddress({ ward: 'P9', district: 'Q9', province: 'Hồ Chí Minh' })
        assert.deepEqual([r.source, r.lat, r.lng], ['goong', 10.7, 106.6])
        assert.ok(calls[0].includes('api_key=k'))
      } finally {
        delete process.env.GOONG_API_KEY
        restore()
      }
    })
  })

  describe('báo cước ở trang thanh toán', () => {
    let odCalls
    const lists = { '/cities': [{ id: 1, name: 'Hồ Chí Minh' }, { id: 2, name: 'Hà Nội' }], '/cities/1/districts': [{ id: 10, name: 'Quận 1' }], '/districts/10/wards': [{ id: 100, name: 'Phường Bến Nghé' }], '/cities/2/districts': [{ id: 20, name: 'Quận Hoàn Kiếm' }], '/districts/20/wards': [{ id: 200, name: 'Phường Hàng Bạc' }] }
    const install = ({ odRows = [row()], odFail = false, geoRows = [{ lat: '10.77', lon: '106.70' }] } = {}) => {
      odCalls = []
      process.env.NOMINATIM_GAP_MS = '0'
      process.env.GOSHIP_TOKEN = 't'
      _resetGoshipCache()
      _clearGeocodeCache()
      globalThis.fetch = async (url, opts = {}) => {
        const u = String(url)
        if (u.startsWith('https://nominatim')) return { ok: true, status: 200, json: async () => geoRows }
        const path = u.replace('https://api.goship.io/api/v2', '')
        if (path === '/rates') return { ok: true, status: 200, json: async () => ({ code: 200, status: 'success', data: [{ id: 'n1', carrier_name: 'GHTK', service: 'Nhanh', total_fee: '18000', cod_fee: '0' }] }) }
        if (path === '/ondemand-shipments/rates') {
          odCalls.push(JSON.parse(opts.body))
          return odFail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ code: 200, status: 'success', data: odRows }) }
        }
        return { ok: true, status: 200, json: async () => ({ data: lists[path] || [] }) }
      }
    }
    const done = () => {
      globalThis.fetch = realFetch
      delete process.env.GOSHIP_TOKEN
      delete process.env.NOMINATIM_GAP_MS
      _resetGoshipCache()
      _clearGeocodeCache()
    }
    const cfg = (g = {}) => ({
      store: { address: '' },
      shipping: { fee: 25000, freeShippingOver: 0, goship: { enabled: true, defaultWeightGrams: 4000, expressEnabled: true, origin: { province: 'Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', lat: 10.78, lng: 106.69 }, ...g } },
      orders: { expressKeywords: 'hỏa tốc' },
    })
    const hcmAddr = { province: 'Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé' }

    test('khách cùng thành phố với kho thấy thêm phương án hỏa tốc, xếp chung theo giá', async () => {
      install()
      try {
        const q = await quoteShipping({ settings: cfg(), address: hcmAddr, subtotal: 100000, cod: 0, weightGrams: 1200 })
        assert.equal(q.status, 'ok')
        assert.deepEqual(q.options.map((o) => [o.carrier, o.fee, !!o.express]), [['GHTK', 18000, false], ['Ahamove', 32500, true]])
        const body = odCalls[0]
        assert.deepEqual(body.paths.map((p) => p.kind), [1, 2])
        assert.deepEqual([body.paths[0].lat, body.paths[0].lng], [10.78, 106.69])
        assert.equal(body.paths[1].parcel.weight, 1200)
      } finally {
        done()
      }
    })

    test('khác thành phố, tắt hỏa tốc, thiếu tọa độ kho: không gọi API hỏa tốc', async () => {
      install()
      try {
        const hn = { province: 'Hà Nội', district: 'Quận Hoàn Kiếm', ward: 'Phường Hàng Bạc' }
        assert.ok((await quoteShipping({ settings: cfg(), address: hn, subtotal: 1, cod: 0 })).options.every((o) => !o.express))
        assert.ok((await quoteShipping({ settings: cfg({ expressEnabled: false }), address: hcmAddr, subtotal: 1, cod: 0 })).options.every((o) => !o.express))
        assert.ok((await quoteShipping({ settings: cfg({ origin: { province: 'Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', lat: null, lng: null } }), address: hcmAddr, subtotal: 1, cod: 0 })).options.every((o) => !o.express))
        assert.equal(odCalls.length, 0)
      } finally {
        done()
      }
    })

    test('lỗi tra tọa độ / Goship hỏa tốc lỗi / COD vượt mức: chỉ mất phương án hỏa tốc, phương án thường vẫn còn', async () => {
      for (const [label, opts, cod] of [['không tra được địa chỉ', { geoRows: [] }, 0], ['API hỏa tốc lỗi', { odFail: true }, 0], ['COD vượt mức', { odRows: [row({ max_cod: 1000000 })] }, 5000000]]) {
        install(opts)
        try {
          const q = await quoteShipping({ settings: cfg(), address: hcmAddr, subtotal: 100000, cod })
          assert.equal(q.status, 'ok', label)
          assert.deepEqual(q.options.map((o) => o.carrier), ['GHTK'], label)
        } finally {
          done()
        }
      }
    })

    test('chooseShipping nhận phương án hỏa tốc và báo express để đơn thành EXPRESS', async () => {
      install()
      try {
        const st = cfg()
        const q = await quoteShipping({ settings: st, address: hcmAddr, subtotal: 100000, cod: 0 })
        const pick = q.options.find((o) => o.express)
        const c = chooseShipping(st, 100000, q, pick.id)
        assert.deepEqual([c.fee, c.express, c.carrier], [32500, true, 'Ahamove'])
      } finally {
        done()
      }
    })
  })
})

describe('mã giảm giá', () => {
  const base = { id: 'c1', code: 'GIAM', type: 'FIXED', value: 50000, maxDiscount: null, minOrder: 0, usageLimit: null, perCustomerLimit: null, usedCount: 0, startsAt: null, endsAt: null, active: true }
  const db = (coupon, used = 0) => ({ coupon: { findUnique: async () => coupon }, couponRedemption: { count: async () => used } })
  const fails = (p, msg) => assert.rejects(p, (e) => e instanceof CouponError && msg.test(e.message))

  test('giảm cố định, không vượt tạm tính', () => {
    assert.equal(discountFor(base, 300000), 50000)
    assert.equal(discountFor(base, 30000), 30000)
  })
  test('giảm phần trăm có mức tối đa', () => {
    const pc = { ...base, type: 'PERCENT', value: 10, maxDiscount: 30000 }
    assert.equal(discountFor(pc, 200000), 20000)
    assert.equal(discountFor(pc, 1000000), 30000)
    assert.equal(discountFor({ ...pc, maxDiscount: null }, 1000000), 100000)
  })
  test('chuẩn hóa mã', () => assert.equal(normalizeCode(' giam 10 '), 'GIAM10'))
  test('mã hợp lệ', async () => assert.equal((await checkCoupon('giam', 200000, {}, db(base))).discount, 50000))
  test('không có / đã tắt', async () => {
    await fails(checkCoupon('x', 1000, {}, db(null)), /không hợp lệ/)
    await fails(checkCoupon('x', 1000, {}, db({ ...base, active: false })), /không hợp lệ/)
  })
  test('chưa tới / hết hạn', async () => {
    const now = new Date('2026-06-15')
    await fails(checkCoupon('x', 1000, { now }, db({ ...base, startsAt: new Date('2026-07-01') })), /chưa đến/)
    await fails(checkCoupon('x', 1000, { now }, db({ ...base, endsAt: new Date('2026-06-01') })), /hết hạn/)
  })
  test('đơn tối thiểu', async () => {
    await fails(checkCoupon('x', 99000, {}, db({ ...base, minOrder: 100000 })), /từ 100\.000đ/)
    assert.ok(await checkCoupon('x', 100000, {}, db({ ...base, minOrder: 100000 })))
  })
  test('hết tổng lượt / hết lượt của khách', async () => {
    await fails(checkCoupon('x', 1000, {}, db({ ...base, usageLimit: 5, usedCount: 5 })), /hết lượt/)
    await fails(checkCoupon('x', 1000, { customerId: 'k' }, db({ ...base, perCustomerLimit: 1 }, 1)), /dùng hết số lượt/)
    assert.ok(await checkCoupon('x', 1000, { customerId: 'k' }, db({ ...base, perCustomerLimit: 2 }, 1)))
  })
  test('schema: tạo mới có mặc định, sửa một phần không ghi đè', () => {
    assert.deepEqual(couponPatchSchema.parse({ active: false }), { active: false })
    const c = couponSchema.parse({ code: 'abc', type: 'FIXED', value: 5000 })
    assert.equal(c.code, 'ABC')
    assert.equal(c.minOrder, 0)
    assert.equal(c.active, true)
    assert.equal(couponSchema.safeParse({ code: 'abc', type: 'PERCENT', value: 120 }).success, false)
    assert.equal(couponSchema.safeParse({ code: 'ab', type: 'FIXED', value: 1 }).success, false)
  })
})

describe('email marketing', () => {
  const cfg = { welcomeEnabled: true, welcomeType: 'PERCENT', welcomeValue: 10, welcomeMaxDiscount: 30000, welcomeMinOrder: 0, welcomeDays: 30 }
  test('cấu hình quà chào mừng', () => {
    assert.equal(welcomeConfigSchema.safeParse(cfg).success, true)
    assert.equal(welcomeConfigSchema.safeParse({ ...cfg, welcomeValue: 150 }).success, false)
    assert.equal(welcomeConfigSchema.safeParse({ ...cfg, welcomeType: 'FIXED', welcomeValue: 50000 }).success, true)
  })
  test('chiến dịch và hủy đăng ký', () => {
    assert.equal(blastSchema.safeParse({ subject: '', body: 'x' }).success, false)
    assert.equal(blastSchema.safeParse({ subject: 'Rèm mới', body: 'Nội dung' }).success, true)
    assert.equal(unsubscribeSchema.safeParse({ token: 'ab' }).success, false)
  })
  test('email chiến dịch: escape HTML, có link hủy đăng ký và header List-Unsubscribe', async () => {
    const m = await blastEmail('Giảm <b>giá</b>', 'Chào <script>x</script>\n\nĐoạn hai', { unsubToken: 'tok123456' })
    assert.ok(!m.html.includes('<script>'))
    assert.match(m.html, /&lt;script&gt;/)
    assert.match(m.html, /unsubscribe\?token=tok123456/)
    assert.match(m.text, /unsubscribe\?token=tok123456/)
    assert.match(m.headers['List-Unsubscribe'], /tok123456/)
    assert.equal((m.html.match(/<p style="margin:0 0 14px/g) || []).length, 2) // hai đoạn
  })
  test('email chào mừng có mã giảm giá', async () => {
    const m = await welcomeEmail({ unsubToken: 'tok123456' }, { code: 'HELLO-ABC123', type: 'PERCENT', value: 10, maxDiscount: 30000, minOrder: 0, endsAt: new Date('2026-12-01') })
    assert.match(m.subject, /10%/)
    assert.match(m.html, /HELLO-ABC123/)
    assert.match(m.text, /HELLO-ABC123/)
  })
})

describe('số điện thoại gửi Goship', () => {
  test('chỉ giữ chữ số, +84 đổi thành 0', () => {
    assert.equal(cleanPhone('0356 789 749'), '0356789749')
    assert.equal(cleanPhone('0356.789.749'), '0356789749')
    assert.equal(cleanPhone('+84 356 789 749'), '0356789749')
    assert.equal(cleanPhone('84356789749'), '0356789749')
    assert.equal(cleanPhone('0963603157'), '0963603157')
    assert.equal(cleanPhone(null), '')
  })
})

describe('mã vận đơn của hãng', () => {
  test('mã Goship (GS...) không phải mã hãng', () => {
    assert.equal(carrierCodeOf('GS6VJB3936', 'GS6VJB3936'), '')
    assert.equal(carrierCodeOf('GS6VJB3936', 'OTHER'), '')
    assert.equal(carrierCodeOf(null, 'GS1'), '')
    assert.equal(carrierCodeOf('', 'GS1'), '')
  })
  test('mã do hãng cấp được giữ', () => {
    assert.equal(carrierCodeOf('BEST123456789', 'GS6VJB3936'), 'BEST123456789')
    assert.equal(carrierCodeOf(' 85012345678 ', 'GS6VJB3936'), '85012345678')
  })
})

describe('Goship trả danh sách dạng mảng hoặc từ điển', () => {
  test('mảng giữ nguyên, từ điển (khóa không liền) thành mảng', () => {
    assert.deepEqual(rowsOf([{ id: 'a' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }])
    assert.deepEqual(rowsOf({ 1: { id: 'a' }, 3: { id: 'b' } }), [{ id: 'a' }, { id: 'b' }])
    assert.deepEqual(rowsOf([]), [])
  })
  test('lỗi (chuỗi, có khóa error/errors, rỗng) không phải danh sách', () => {
    assert.equal(rowsOf('lỗi'), null)
    assert.equal(rowsOf({ error: 'x' }), null)
    assert.equal(rowsOf({ errors: { a: ['x'] } }), null)
    assert.equal(rowsOf(null), null)
    assert.equal(rowsOf(undefined), null)
  })
})
