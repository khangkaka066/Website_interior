import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// Kiểm thử tạo / hủy vận đơn Goship và webhook với database thật, TOÀN BỘ trong một transaction rồi rollback: không để lại dữ liệu.
// Mọi lệnh gọi Goship đều là giả lập (fetch được thay thế, gọi URL lạ sẽ lỗi): KHÔNG bao giờ tạo vận đơn thật.
// Chạy trên database trong .env nên chỉ chạy khi bật cờ:  npm run test:db
const enabled = process.env.RUN_DB_TESTS === '1'
const suite = enabled ? describe : describe.skip

class Rollback extends Error {}

suite('Goship: vận đơn và webhook với database (rollback)', () => {
  test('tạo, đồng bộ trạng thái, hủy và tạo lại vận đơn', async () => {
    await import('dotenv/config')
    const { prisma } = await import('../src/lib/prisma.js')
    const { getSettings } = await import('../src/lib/settingsStore.js')
    const { _resetGoshipCache } = await import('../src/lib/goship.js')
    const S = await import('../src/lib/goshipShipments.js')

    const realFetch = globalThis.fetch
    const realToken = process.env.GOSHIP_TOKEN
    const sent = [] // các lệnh đã "gọi Goship"
    let createdCount = 0
    let cancelFails = false
    let remote = { id: 'GSTEST001', status_code: 905, status_text: 'Giao thành công', fee: 22000 } // dữ liệu "chính thức" khi hỏi lại API
    const ok = (json) => ({ ok: true, status: 200, json: async () => json })
    globalThis.fetch = async (url, opts = {}) => {
      const path = String(url).replace('https://api.goship.io/api/v2', '')
      const method = opts.method || 'GET'
      sent.push([method, path, opts.body ? JSON.parse(opts.body) : null])
      if (path === '/cities') return ok({ data: [{ id: 700000, name: 'Hồ Chí Minh' }] })
      if (path === '/cities/700000/districts') return ok({ data: [{ id: 700700, name: 'Quận Tân Bình' }, { id: 701, name: 'Thành phố Thủ Đức' }] })
      if (path === '/districts/700700/wards') return ok({ data: [{ id: 13, name: 'Phường 13' }] })
      if (path === '/districts/701/wards') return ok({ data: [{ id: 10, name: 'Phường Linh Đông' }] })
      if (path === '/rates') return ok({ code: 200, status: 'success', data: [{ id: 'RATE-OK', carrier_name: 'Best Express', service: 'Nhanh', expected: '1 ngày', total_fee: '22000', cod_fee: '0', total_amount: '122000' }] })
      if (path === '/shipments' && method === 'POST') {
        createdCount += 1
        return ok({ code: 200, status: 'success', id: `GSTEST00${createdCount}`, shipment_status: 901, fee: '22000', tracking_number: `TRK${createdCount}`, carrier: 'Best Express', carrier_short_name: 'BEST' })
      }
      if (path.startsWith('/shipments/search')) return ok({ data: [remote] })
      if (method === 'DELETE' && path.startsWith('/shipments/')) return cancelFails ? { ok: false, status: 400, json: async () => ({ code: 400, message: 'Hãng đã lấy hàng' }) } : ok({ code: 200, status: 'success' })
      throw new Error(`Lệnh gọi Goship ngoài dự kiến trong test: ${method} ${path}`)
    }
    process.env.GOSHIP_TOKEN = 'test-token'
    _resetGoshipCache()

    const base = await getSettings()
    const settings = { ...base, shipping: { ...base.shipping, goship: { ...base.shipping.goship, enabled: true, createShipments: true, defaultWeightGrams: 4000, origin: { province: 'Hồ Chí Minh', district: 'Thành phố Thủ Đức', ward: 'Phường Linh Đông', street: '47 Linh Đông', name: 'Kho thử', phone: '0356789749' } } } }

    try {
      await prisma.$transaction(
        async (tx) => {
          const customer = await tx.customer.create({ data: { name: 'ZZ Goship', phone: '0900000091' } })
          const order = await tx.order.create({
            data: { orderNumber: `ZZ-GS-${Date.now()}`, customerId: customer.id, status: 'PROCESSING', paymentMethod: 'COD', subtotal: 100000, shippingFee: 22000, total: 122000, recipientName: 'ZZ', recipientPhone: '0900000091', addressLine: '12 Cộng Hòa', ward: 'Phường 13', district: 'Tân Bình', province: 'Hồ Chí Minh' },
          })
          const fresh = () => tx.shipment.findUnique({ where: { orderId: order.id }, include: { carrier: true, trackingEvents: { orderBy: { createdAt: 'asc' } }, order: true } })
          const wh = (payload, verified = true) => S.processGoshipWebhook({ payload: { gcode: 'GSTEST001', order_id: order.orderNumber, ...payload }, verified }, tx)

          // 1) lựa chọn cước không còn hiệu lực -> từ chối, không gọi lệnh tạo
          await assert.rejects(S.createShipmentForOrder({ orderId: order.id, rateId: 'BAD', settings }, tx), (e) => e.code === 'RATE_CHANGED')
          assert.equal(sent.some(([m, p]) => m === 'POST' && p === '/shipments'), false)

          // 2) tạo vận đơn
          const created = await S.createShipmentForOrder({ orderId: order.id, rateId: 'RATE-OK', settings }, tx)
          assert.equal(created.trackingId, 'GSTEST001')
          assert.equal(created.status, 'AWAITING_PICKUP')
          assert.equal(created.carrier.code, 'GOSHIP')
          assert.match(created.note, /Best Express/)
          assert.equal(Number(created.shippingFee), 22000)
          assert.equal((await tx.order.findUnique({ where: { id: order.id } })).status, 'AWAITING_SHIPMENT')
          const body = sent.find(([m, p]) => m === 'POST' && p === '/shipments')[2].shipment
          assert.deepEqual([body.rate, body.payer, body.order_id, body.parcel.cod, body.parcel.weight], ['RATE-OK', 1, order.orderNumber, '122000', '4000'])
          assert.deepEqual(body.address_to, { name: 'ZZ', phone: '0900000091', street: '12 Cộng Hòa', city: '700000', district: '700700', ward: '13' })

          // 3) tạo lần hai bị chặn
          await assert.rejects(S.createShipmentForOrder({ orderId: order.id, rateId: 'RATE-OK', settings }, tx), (e) => e.code === 'HAS_SHIPMENT' || e.code === 'ORDER_STATE')

          // 4) webhook: đi tới, trùng lặp bị bỏ, đến trễ bị bỏ, nhảy bước
          let r = await wh({ status: '903', status_text: 'Đã lấy hàng', message: 'Bưu tá đã nhận hàng', code: 'TRK1' })
          assert.deepEqual([r.handled, r.status, r.orderStatus], [true, 'PICKED_UP', 'SHIPPING'])
          const events = (await fresh()).trackingEvents.length
          r = await wh({ status: '903', status_text: 'Đã lấy hàng', message: 'Bưu tá đã nhận hàng', code: 'TRK1' })
          assert.equal(r.duplicate, true)
          assert.equal((await fresh()).trackingEvents.length, events)
          r = await wh({ status: '901', status_text: 'Chờ lấy hàng' }) // trễ
          assert.equal((await fresh()).status, 'PICKED_UP')
          r = await wh({ status: '904', status_text: 'Giao hàng' })
          assert.equal((await fresh()).status, 'OUT_FOR_DELIVERY')
          r = await wh({ status: '906', status_text: 'Giao thất bại', message: 'Khách không nghe máy' })
          assert.equal((await fresh()).status, 'FAILED')
          r = await wh({ status: '904', status_text: 'Giao hàng' }) // giao lại
          assert.equal((await fresh()).status, 'OUT_FOR_DELIVERY')

          // 5) webhook không đáng tin (chữ ký sai): bỏ qua nội dung "901", dùng dữ liệu chính thức từ API (905)
          r = await wh({ status: '901', status_text: 'Chờ lấy hàng' }, false)
          assert.deepEqual([r.handled, r.verified, r.status, r.orderStatus], [true, false, 'DELIVERED', 'DELIVERED'])
          assert.equal((await fresh()).order.status, 'DELIVERED')
          assert.equal(sent.some(([m, p]) => m === 'GET' && p.startsWith('/shipments/search?code=GSTEST001')), true)

          // 6) mã lạ và thiếu tham chiếu: bỏ qua, không lỗi
          assert.equal((await S.processGoshipWebhook({ payload: { gcode: 'KHONGCO', order_id: 'ZZ-KHONG-CO', status: '905' }, verified: true }, tx)).reason, 'unknown_shipment')
          assert.equal((await S.processGoshipWebhook({ payload: { status: '905' }, verified: true }, tx)).reason, 'no_reference')

          // 7) hủy: Goship từ chối thì ném lỗi; Goship đồng ý thì gọi DELETE
          const ship = await fresh()
          cancelFails = true
          await assert.rejects(S.cancelOnGoship(ship), (e) => e.code === 'GOSHIP_CANCEL_FAILED')
          cancelFails = false
          assert.deepEqual(await S.cancelOnGoship(ship), { cancelledRemote: true })
          assert.equal(sent.some(([m, p]) => m === 'DELETE' && p === '/shipments/GSTEST001'), true)
          assert.deepEqual(await S.cancelOnGoship({ ...ship, carrier: { code: 'GHN' } }), { cancelledRemote: false }) // hãng khác: không gọi Goship

          // 8) Goship báo đã hủy (914): về trạng thái "đã hủy", rồi tạo lại dùng lại cùng một bản ghi
          await tx.shipment.update({ where: { id: ship.id }, data: { status: 'AWAITING_PICKUP' } })
          await tx.order.update({ where: { id: order.id }, data: { status: 'AWAITING_SHIPMENT' } })
          r = await wh({ status: '914', status_text: 'Đơn hủy' })
          assert.equal((await fresh()).status, 'CANCELLED')
          remote = { id: 'GSTEST002', status_code: 901, status_text: 'Chờ lấy hàng' }
          const again = await S.createShipmentForOrder({ orderId: order.id, rateId: 'RATE-OK', settings }, tx)
          assert.equal(again.id, ship.id) // cùng bản ghi (mỗi đơn một vận đơn)
          assert.equal(again.trackingId, 'GSTEST002')
          assert.equal(again.status, 'AWAITING_PICKUP')

          throw new Rollback()
        },
        { timeout: 90_000, maxWait: 20_000 },
      )
    } catch (err) {
      if (!(err instanceof Rollback)) throw err
    } finally {
      globalThis.fetch = realFetch
      if (realToken === undefined) delete process.env.GOSHIP_TOKEN
      else process.env.GOSHIP_TOKEN = realToken
      _resetGoshipCache()
    }
    // đã rollback: không còn dữ liệu thử
    assert.equal(await prisma.customer.count({ where: { phone: '0900000091' } }), 0)
    assert.equal(await prisma.shipment.count({ where: { trackingId: { startsWith: 'GSTEST' } } }), 0)
  })
})
