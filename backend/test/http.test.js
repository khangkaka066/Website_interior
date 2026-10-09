import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'

// Kiểm tra HTTP không cần database: các lỗi 400/401/404/503 đều trả về trước khi chạm tới database.
let server
let base
const call = (path, init = {}) =>
  fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } }).then(async (r) => ({
    status: r.status,
    headers: r.headers,
    text: await r.text(),
  }))
const json = (r) => JSON.parse(r.text)
const post = (path, body, init = {}) => call(path, { method: 'POST', body: JSON.stringify(body), ...init })

before(async () => {
  server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

describe('chung', () => {
  test('health', async () => assert.deepEqual(json(await call('/api/health')), { ok: true }))
  test('đường dẫn lạ trả JSON 404, không lộ trang lỗi Express', async () => {
    const r = await call('/api/khong-co')
    assert.equal(r.status, 404)
    assert.ok(!r.text.includes('Cannot GET'))
    assert.equal(json(r).error, 'Không tìm thấy.')
  })
  test('JSON hỏng trả 400', async () => {
    const r = await call('/api/auth/login', { method: 'POST', body: '{bad' })
    assert.equal(r.status, 400)
  })
  test('header bảo mật', async () => {
    const r = await call('/api/health')
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/)
    assert.equal(r.headers.get('x-powered-by'), null)
  })
})

describe('yêu cầu đăng nhập', () => {
  for (const [method, path] of [
    ['GET', '/api/orders'], ['GET', '/api/orders/status-counts'], ['PATCH', '/api/orders/x/status'], ['GET', '/api/customers'], ['POST', '/api/customers'],
    ['GET', '/api/shipping'], ['POST', '/api/campaigns'], ['GET', '/api/chat/conversations'], ['GET', '/api/chat/stream'],
    ['GET', '/api/settings'], ['PUT', '/api/settings/store'], ['GET', '/api/users'], ['GET', '/api/admin-products'],
    ['POST', '/api/admin-products/sync'], ['GET', '/api/analytics/overview'], ['GET', '/api/payments'],
    ['GET', '/api/posts'], ['POST', '/api/posts'], ['PATCH', '/api/posts/x'], ['DELETE', '/api/posts/x'],
    ['GET', '/api/discounts'], ['GET', '/api/seo/status'], ['POST', '/api/seo/keywords'], ['GET', '/api/seo/jobs/x'], ['GET', '/api/seo/jobs/current'], ['POST', '/api/seo/jobs/x/cancel'], ['PUT', '/api/discounts'], ['POST', '/api/discounts/import'], ['GET', '/api/account/profile'], ['PATCH', '/api/account/profile'], ['POST', '/api/account/password'], ['GET', '/api/account/orders'],
    ['GET', '/api/account/orders/ORD-1'], ['POST', '/api/account/orders/claim'], ['GET', '/api/account/addresses'],
    ['POST', '/api/account/addresses'], ['PATCH', '/api/account/addresses/x'], ['DELETE', '/api/account/addresses/x'],
  ]) {
    test(`${method} ${path} -> 401`, async () => {
      const r = await call(path, { method, body: method === 'GET' ? undefined : '{}' })
      assert.equal(r.status, 401)
    })
  }
  test('token rác không được coi là đã đăng nhập', async () => {
    // authenticate thử xác minh token; token rác bị bỏ qua và route vẫn đòi đăng nhập
    const r = await call('/api/orders', { headers: { authorization: 'Bearer not.a.jwt' } })
    assert.equal(r.status, 401)
  })
})

describe('kiểm tra đầu vào (400 trước khi chạm database)', () => {
  const cases = [
    ['POST', '/api/analytics/events', { sessionId: 's', type: 'HACK' }],
    ['POST', '/api/orders', { customer: { name: 'A', phone: 'x' }, items: [] }],
    ['POST', '/api/auth/register', { name: 'A', email: 'a@b.co', password: '123' }],
    ['POST', '/api/auth/login', {}],
    ['POST', '/api/auth/forgot-password', {}],
    ['POST', '/api/auth/reset-password', { token: 'xyz', password: '12345678' }],
    ['POST', '/api/chat/conversations', {}],
    ['POST', '/api/orders/payos-link', {}],
  ]
  for (const [method, path, body] of cases) {
    test(`${method} ${path}`, async () => {
      const r = await post(path, body)
      assert.equal(r.status, 400, r.text)
      assert.ok(json(r).error)
    })
  }
})

describe('công khai', () => {
  test('tra cứu đơn thiếu thông tin -> 404 chung', async () => {
    const r = await call('/api/orders/track?orderNumber=&phone=')
    assert.equal(r.status, 404)
    assert.match(json(r).error, /Không tìm thấy đơn hàng/)
  })
  test('Google: chưa cấu hình -> 503', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const r = await post('/api/auth/google', { credential: 'a'.repeat(30) })
    assert.equal(r.status, 503)
  })
  test('webhook thanh toán: chưa cấu hình khóa -> 503; dịch vụ lạ -> 404', async () => {
    delete process.env.PAYOS_CHECKSUM_KEY
    assert.equal((await post('/api/payments/webhook/payos', {})).status, 503)
    assert.equal((await post('/api/payments/webhook/khong-co', {})).status, 404)
  })
  test('webhook PayOS: sai chữ ký -> 401', async () => {
    process.env.PAYOS_CHECKSUM_KEY = 'test'
    try {
      const r = await post('/api/payments/webhook/payos', { code: '00', success: true, data: { amount: 1, description: 'ORD-12345', code: '00' }, signature: 'f'.repeat(64) })
      assert.equal(r.status, 401)
    } finally {
      delete process.env.PAYOS_CHECKSUM_KEY
    }
  })
  test('webhook SePay: thiếu/sai khóa -> 401', async () => {
    process.env.SEPAY_WEBHOOK_API_KEY = 'secret'
    try {
      assert.equal((await post('/api/payments/webhook/sepay', {})).status, 401)
      assert.equal((await post('/api/payments/webhook/sepay', {}, { headers: { authorization: 'Apikey sai' } })).status, 401)
    } finally {
      delete process.env.SEPAY_WEBHOOK_API_KEY
    }
  })
  test('robots.txt chặn trang riêng tư, có sitemap', async () => {
    const r = await call('/robots.txt')
    assert.match(r.text, /Disallow: \/dashboard/)
    assert.match(r.text, /Disallow: \/checkout/)
    assert.match(r.text, /Sitemap: .*\/sitemap\.xml/)
  })
  test('sitemap.xml hợp lệ, có trang sản phẩm', async () => {
    const r = await call('/sitemap.xml')
    assert.match(r.headers.get('content-type'), /xml/)
    assert.match(r.text, /<urlset/)
    assert.ok((r.text.match(/<loc>/g) || []).length > 5)
    assert.ok(r.text.includes('/products/'))
  })
  test('thông tin cửa hàng, danh mục, tùy chọn thanh toán', async () => {
    assert.ok(json(await call('/api/shop/categories')).length > 0)
    const opts = json(await call('/api/shop/payment-options'))
    assert.ok(opts.methods.some((m) => m.id === 'COD'))
    assert.ok(!opts.methods.some((m) => m.id === 'PAYOS'), 'PayOS ẩn khi chưa có khóa')
  })
  test('sản phẩm: danh sách và 404 khi không có', async () => {
    const list = json(await call('/api/shop/products'))
    assert.ok(Array.isArray(list) && list.length > 0)
    assert.equal((await call('/api/shop/products/khong-co-san-pham-nay')).status, 404)
  })
  test('tính năng xem thử rèm đã gỡ: không còn API báo giá', async () => {
    assert.equal((await post('/api/shop/curtain-quote', {})).status, 404)
    assert.equal((await call('/api/shop/curtain-config')).status, 404)
  })
})
