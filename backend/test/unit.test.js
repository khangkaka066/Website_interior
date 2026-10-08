import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

import { toStorefront } from '../src/lib/productStore.js'
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
