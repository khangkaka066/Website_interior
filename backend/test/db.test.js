import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// Kiểm thử luồng thật với database (tạo đơn, trừ kho, webhook, quên mật khẩu, chat thời gian thực).
// Chạy trên database đang cấu hình trong .env (Supabase) nên CHỈ chạy khi bật cờ:  npm run test:db
// Dữ liệu thử có tiền tố "zz-" / số điện thoại 0900000099 và được xóa sạch khi kết thúc.
const enabled = process.env.RUN_DB_TESTS === '1'
const suite = enabled ? describe : describe.skip

suite('luồng với database', () => {
  let server, base, prisma, adminHeaders, signToken, hashPassword, loadProducts
  const PHONE = '0900000099'
  const PROD = { id: 'zz-test-db', shopeeId: '99999999099', sku: 'zz-db', name: 'ZZ Test DB', categoryId: 'thanh-treo', status: 'active', price: 100000, stock: 3, sold: 0, hasVariants: true,
    variantAttributes: [{ name: 'Loại', values: ['A'] }], variants: [{ id: 'v1', label: 'A', sku: 'zz-a', price: 100000, stock: 3 }], images: [], createdAt: new Date().toISOString() }
  const JSON_H = { 'content-type': 'application/json' }
  const req = async (method, path, body, headers = JSON_H) => {
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  const order = (qty) => ({ customer: { name: 'ZZ Test', phone: PHONE }, items: [{ productId: 'sp99999999099', variant: 'A', quantity: qty }], paymentMethod: 'COD', recipientName: 'ZZ', recipientPhone: PHONE, addressLine: 'x', province: 'HCM' })
  const variantStock = async () => (await prisma.product.findUnique({ where: { id: PROD.id } })).data.variants[0].stock

  before(async () => {
    await import('dotenv/config')
    ;({ prisma } = await import('../src/lib/prisma.js'))
    ;({ signToken, hashPassword } = await import('../src/lib/auth.js'))
    ;({ loadProducts } = await import('../src/lib/productStore.js'))
    const app = (await import('../src/app.js')).default
    server = app.listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${server.address().port}/api`
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', adminRole: 'MAIN_ADMIN' } })
    assert.ok(admin, 'cần có tài khoản Main Admin trong database')
    adminHeaders = { ...JSON_H, authorization: `Bearer ${signToken(admin)}` }
    assert.equal((await req('POST', '/admin-products/sync', { upserts: [PROD], deletes: [] }, adminHeaders)).status, 200)
    await loadProducts()
  })

  after(async () => {
    await prisma.activityLog.deleteMany({ where: { OR: [{ note: { contains: '[payos:ZZ' } }, { order: { recipientPhone: PHONE } }] } })
    await prisma.order.deleteMany({ where: { recipientPhone: PHONE } })
    await prisma.customer.deleteMany({ where: { phone: PHONE } })
    await prisma.product.deleteMany({ where: { id: PROD.id } })
    await prisma.user.deleteMany({ where: { email: 'zz-db-test@example.com' } })
    await prisma.conversation.deleteMany({ where: { guestName: { startsWith: 'ZZ DB' } } })
    await prisma.post.deleteMany({ where: { title: { startsWith: 'ZZ DB' } } })
    await loadProducts()
    server.close()
  })

  describe('tồn kho', () => {
    let o1, o3
    test('đặt hàng trừ kho và tăng "đã bán"', async () => {
      const r = await req('POST', '/orders', order(2))
      assert.equal(r.status, 201)
      assert.equal(r.body.stockReserved, true)
      o1 = r.body
      assert.equal(await variantStock(), 1)
      assert.equal((await prisma.product.findUnique({ where: { id: PROD.id } })).data.sold, 2)
    })
    test('đặt vượt số còn lại bị từ chối, không tạo đơn', async () => {
      const before = await prisma.order.count({ where: { recipientPhone: PHONE } })
      const r = await req('POST', '/orders', order(2))
      assert.equal(r.status, 400)
      assert.match(r.body.error, /chỉ còn 1/)
      assert.equal(await prisma.order.count({ where: { recipientPhone: PHONE } }), before)
    })
    test('bán hết, đơn tiếp theo báo hết hàng', async () => {
      const r = await req('POST', '/orders', order(1))
      assert.equal(r.status, 201)
      o3 = r.body
      assert.equal(await variantStock(), 0)
      const r2 = await req('POST', '/orders', order(1))
      assert.equal(r2.status, 400)
      assert.match(r2.body.error, /hết hàng/)
    })
    test('hủy đơn cộng lại kho đúng một lần', async () => {
      assert.equal((await req('POST', `/orders/${o1.id}/cancel`, { note: 't' }, adminHeaders)).status, 200)
      assert.equal(await variantStock(), 2)
      assert.equal((await req('POST', `/orders/${o1.id}/cancel`, { note: 't' }, adminHeaders)).status, 400)
      assert.equal(await variantStock(), 2)
      assert.equal((await req('POST', `/orders/${o3.id}/cancel`, { note: 't' }, adminHeaders)).status, 200)
      assert.equal(await variantStock(), 3)
    })
  })

  describe('tra cứu đơn của khách', () => {
    let num
    before(async () => {
      num = (await req('POST', '/orders', order(1))).body.orderNumber
    })
    test('đúng mã + số điện thoại (kể cả dạng +84) -> trả đơn, không lộ trường nội bộ', async () => {
      for (const phone of [PHONE, '+84900000099']) {
        const r = await req('GET', `/orders/track?orderNumber=${num.toLowerCase()}&phone=${encodeURIComponent(phone)}`)
        assert.equal(r.status, 200)
        assert.equal(r.body.orderNumber, num)
        for (const k of ['id', 'customer', 'activityLogs', 'stockReserved', 'transactionId']) assert.ok(!(k in r.body), `lộ ${k}`)
      }
    })
    test('sai số điện thoại hoặc sai mã -> 404 cùng thông báo', async () => {
      const a = await req('GET', `/orders/track?orderNumber=${num}&phone=0911111111`)
      const b = await req('GET', `/orders/track?orderNumber=ORD-00000&phone=${PHONE}`)
      assert.equal(a.status, 404)
      assert.equal(b.status, 404)
      assert.equal(a.body.error, b.body.error)
    })
  })

  describe('webhook PayOS', () => {
    const KEY = 'zz-test-checksum'
    let ord
    const sign = (d) => crypto.createHmac('sha256', KEY).update(Object.keys(d).sort().map((k) => `${k}=${d[k] ?? ''}`).join('&')).digest('hex')
    const hook = (data, sig = sign(data)) => req('POST', '/payments/webhook/payos', { code: '00', success: true, data, signature: sig })
    before(async () => {
      process.env.PAYOS_CHECKSUM_KEY = KEY
      ord = (await req('POST', '/orders', order(1))).body
      await prisma.order.update({ where: { id: ord.id }, data: { paymentMethod: 'PAYOS' } })
    })
    after(() => delete process.env.PAYOS_CHECKSUM_KEY)
    const pay = (extra = {}) => ({ orderCode: 1, amount: Number(ord.total), description: ord.orderNumber, accountNumber: '1', reference: 'ZZ1', paymentLinkId: 'p', code: '00', ...extra })
    const status = async () => (await prisma.order.findUnique({ where: { id: ord.id } })).paymentStatus

    test('sai chữ ký / sửa số tiền -> 401, đơn không đổi', async () => {
      assert.equal((await hook(pay(), 'f'.repeat(64))).status, 401)
      assert.equal((await hook(pay({ amount: 1 }), sign(pay()))).status, 401)
      assert.equal(await status(), 'AWAITING_PAYMENT')
    })
    test('trả thiếu không tự xác nhận', async () => {
      assert.equal((await hook(pay({ amount: Number(ord.total) - 1000, reference: 'ZZ0' }))).status, 200)
      assert.equal(await status(), 'AWAITING_PAYMENT')
    })
    test('trả đủ -> Đã thanh toán; gửi lại không ghi trùng', async () => {
      assert.equal((await hook(pay())).status, 200)
      assert.equal(await status(), 'PAID')
      assert.equal((await hook(pay())).status, 200)
      assert.equal(await prisma.activityLog.count({ where: { orderId: ord.id, action: 'auto_confirm_payment' } }), 1)
    })
    test('đơn đã trả tiền không tạo lại link thanh toán', async () => {
      const r = await req('POST', '/orders/payos-link', { orderNumber: ord.orderNumber, phone: PHONE })
      assert.equal(r.status, 400)
    })
  })

  describe('quên mật khẩu', () => {
    const email = 'zz-db-test@example.com'
    let userId
    before(async () => {
      userId = (await prisma.user.create({ data: { email, name: 'ZZ', passwordHash: await hashPassword('oldpassword1'), role: 'CUSTOMER' } })).id
    })
    test('trả lời giống nhau dù email có tồn tại hay không, và giới hạn 3 mã còn hiệu lực', async () => {
      const a = await req('POST', '/auth/forgot-password', { email })
      const b = await req('POST', '/auth/forgot-password', { email: 'zz-khong-co@example.com' })
      assert.deepEqual(a.body, b.body)
      for (let i = 0; i < 4; i++) await req('POST', '/auth/forgot-password', { email })
      assert.equal(await prisma.passwordResetToken.count({ where: { userId } }), 3)
    })
    test('đổi mật khẩu bằng mã hợp lệ, mã chỉ dùng một lần, mật khẩu cũ hết hiệu lực', async () => {
      const token = crypto.randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({ data: { userId, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) } })
      assert.equal((await req('POST', '/auth/reset-password', { token, password: 'newpassword1' })).status, 200)
      assert.equal((await req('POST', '/auth/login', { email, password: 'oldpassword1' })).status, 401)
      assert.equal((await req('POST', '/auth/login', { email, password: 'newpassword1' })).status, 200)
      assert.equal((await req('POST', '/auth/reset-password', { token, password: 'another12345' })).status, 400)
    })
    test('mã hết hạn bị từ chối', async () => {
      const token = crypto.randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({ data: { userId, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() - 1000) } })
      assert.equal((await req('POST', '/auth/reset-password', { token, password: 'newpassword2' })).status, 400)
    })
  })

  describe('chat thời gian thực (SSE)', () => {
    async function listen(path, headers, sink, ctl) {
      const r = await fetch(base + path, { headers, signal: ctl.signal })
      sink.status = r.status
      if (!r.ok) return
      const dec = new TextDecoder()
      let buf = ''
      try {
        for await (const chunk of r.body) {
          buf += dec.decode(chunk)
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: '))
            buf = buf.slice(i + 2)
            if (line) sink.events.push(JSON.parse(line.slice(6)))
          }
        }
      } catch {
        // đã hủy
      }
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    test('tin nhắn tới khách và admin ngay; cuộc trò chuyện khác không nhận', async () => {
      const conv = (await req('POST', '/chat/conversations', { name: 'ZZ DB chat' })).body
      const other = (await req('POST', '/chat/conversations', { name: 'ZZ DB other' })).body
      const sinks = { cust: { events: [] }, adm: { events: [] }, oth: { events: [] } }
      const ctl = new AbortController()
      listen(`/chat/conversations/${conv.id}/stream`, {}, sinks.cust, ctl)
      listen('/chat/stream', { authorization: adminHeaders.authorization }, sinks.adm, ctl)
      listen(`/chat/conversations/${other.id}/stream`, {}, sinks.oth, ctl)
      await wait(700)
      assert.equal(sinks.cust.status, 200)
      await req('POST', `/chat/conversations/${conv.id}/messages`, { content: 'xin chào' })
      await req('POST', `/chat/conversations/${conv.id}/admin-messages`, { content: 'chào bạn' }, adminHeaders)
      await wait(500)
      ctl.abort()
      assert.deepEqual(sinks.cust.events.map((e) => `${e.type}:${e.sender}`), ['message:CUSTOMER', 'message:ADMIN'])
      assert.equal(sinks.adm.events.filter((e) => e.conversationId === conv.id).length, 2)
      assert.equal(sinks.oth.events.length, 0)
    })
    test('luồng admin cần đăng nhập', async () => {
      assert.equal((await fetch(base + '/chat/stream')).status, 401)
    })
  })

  describe('Tin tức', () => {
    let post
    const pubList = async () => (await req('GET', '/shop/posts')).body
    test('bài nháp không lộ ra công khai, kể cả khi biết đường dẫn', async () => {
      const r = await req('POST', '/posts', { title: 'ZZ DB Mẹo chọn rèm', content: '## A\n\nnội dung' }, adminHeaders)
      assert.equal(r.status, 201)
      post = r.body
      assert.equal(post.status, 'draft')
      assert.equal(post.publishedAt, null)
      assert.ok(!(await pubList()).some((p) => p.id === post.id))
      assert.equal((await req('GET', `/shop/posts/${post.slug}`)).status, 404)
    })
    test('trùng tiêu đề thì đường dẫn thêm số, không báo lỗi', async () => {
      const r = await req('POST', '/posts', { title: 'ZZ DB Mẹo chọn rèm' }, adminHeaders)
      assert.equal(r.body.slug, `${post.slug}-2`)
    })
    test('xuất bản: hiện ở danh sách và có nội dung; gỡ xuống thì biến mất, ngày đăng giữ nguyên', async () => {
      const pub = await req('PATCH', `/posts/${post.id}`, { status: 'published' }, adminHeaders)
      assert.ok(pub.body.publishedAt)
      assert.ok((await pubList()).some((p) => p.id === post.id))
      assert.match((await req('GET', `/shop/posts/${post.slug}`)).body.content, /nội dung/)
      await req('PATCH', `/posts/${post.id}`, { status: 'draft' }, adminHeaders)
      assert.equal((await req('GET', `/shop/posts/${post.slug}`)).status, 404)
      const again = await req('PATCH', `/posts/${post.id}`, { status: 'published' }, adminHeaders)
      assert.equal(again.body.publishedAt, pub.body.publishedAt)
    })
    test('sitemap có trang Tin tức và bài đã xuất bản', async () => {
      const xml = await (await fetch(base.replace('/api', '') + '/sitemap.xml')).text()
      assert.ok(xml.includes('/news<'))
      assert.ok(xml.includes(`/news/${post.slug}`))
    })
    test('xóa bài', async () => {
      assert.equal((await req('DELETE', `/posts/${post.id}`, undefined, adminHeaders)).status, 200)
      assert.equal((await req('GET', `/posts/${post.id}`, undefined, adminHeaders)).status, 404)
    })
  })
})
