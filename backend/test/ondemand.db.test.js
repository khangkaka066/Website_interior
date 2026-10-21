import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// Đơn hỏa tốc qua Goship với database thật, TOÀN BỘ trong một transaction rồi rollback. Mọi lệnh gọi Goship / tra tọa độ đều giả lập
// (gọi URL lạ sẽ lỗi): KHÔNG bao giờ điều shipper thật. Chạy khi bật cờ:  npm run test:db
const enabled = process.env.RUN_DB_TESTS === '1'
const suite = enabled ? describe : describe.skip

class Rollback extends Error {}

suite('Goship hỏa tốc: báo cước, tạo, webhook, hủy (rollback)', () => {
  test('luồng đầy đủ', async () => {
    await import('dotenv/config')
    const { prisma } = await import('../src/lib/prisma.js')
    const { getSettings } = await import('../src/lib/settingsStore.js')
    const { _clearGeocodeCache } = await import('../src/lib/geocode.js')
    const { _resetGoshipCache } = await import('../src/lib/goship.js')
    const S = await import('../src/lib/goshipShipments.js')

    const realFetch = globalThis.fetch
    const sent = []
    let created = 0
    let odRows = [{ _id: 'HAN-BIKE', description_vi_vn: 'Lấy hàng ngay, giao hỏa tốc', carrier: 1, carrier_name: 'Ahamove', total_fee: 32500, max_cod: 10000000 }]
    let remote = { id: 'ODG001', code: 'AHA-777', status: 904, status_text: 'Đã lấy hàng', total_fee: 32500 } // dữ liệu "chính thức" khi hỏi lại API
    const ok = (json) => ({ ok: true, status: 200, json: async () => json })
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url)
      const method = opts.method || 'GET'
      if (u.startsWith('https://nominatim')) {
        sent.push(['GEO', decodeURIComponent(u)])
        return ok(decodeURIComponent(u).includes('Số mờ') ? [] : [{ lat: '10.7769', lon: '106.7009' }]) // "Số mờ": chỉ tra được tới phường
      }
      const path = u.replace('https://api.goship.io/api/v2', '')
      sent.push([method, path, opts.body ? JSON.parse(opts.body) : null])
      if (path === '/ondemand-shipments/rates') return ok({ code: 200, status: 'success', data: odRows })
      if (path === '/ondemand-shipments' && method === 'POST') {
        created += 1
        return ok({ code: 200, status: 'success', data: { id: `ODG00${created}`, code: `AHA-77${created}`, order_id: JSON.parse(opts.body).order_id, status: 901, tracking_url: 'https://t/x' } })
      }
      if (method === 'GET' && path.startsWith('/ondemand-shipments/')) return ok({ code: 200, status: 'success', data: remote })
      if (method === 'DELETE' && path.startsWith('/ondemand-shipments/')) return ok({ code: 200, status: 'success' })
      throw new Error(`Lệnh gọi ngoài dự kiến trong test: ${method} ${path}`)
    }
    process.env.GOSHIP_TOKEN = 'test-token'
    process.env.NOMINATIM_GAP_MS = '0'
    _resetGoshipCache()
    _clearGeocodeCache()

    const base = await getSettings()
    const settings = {
      ...base,
      shipping: { ...base.shipping, goship: { ...base.shipping.goship, enabled: true, createShipments: true, expressEnabled: true, defaultWeightGrams: 4000, origin: { province: 'Hồ Chí Minh', district: 'Thành phố Thủ Đức', ward: 'Phường Linh Đông', street: '47 Linh Đông', name: 'Kho thử', phone: '0356789749', lat: 10.8, lng: 106.72 } } },
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          const customer = await tx.customer.create({ data: { name: 'ZZ OD', phone: '0900000093' } })
          let seq = 0
          const mk = (over = {}) =>
            tx.order.create({
              data: {
                orderNumber: `ZZ-OD-${Date.now()}-${++seq}`, customerId: customer.id, status: 'PROCESSING', paymentMethod: 'COD', deliveryType: 'EXPRESS', shippingCarrier: 'Ahamove', shippingService: 'Hỏa tốc – Lấy hàng ngay, giao hỏa tốc',
                subtotal: 100000, shippingFee: 32500, total: 132500, recipientName: 'ZZ', recipientPhone: '0900000093', addressLine: '12 Nguyễn Huệ', ward: 'Phường Bến Nghé', district: 'Quận 1', province: 'Hồ Chí Minh', ...over,
              },
            })
          const fresh = (id) => tx.shipment.findUnique({ where: { orderId: id }, include: { carrier: true, trackingEvents: { orderBy: { createdAt: 'asc' } } } })
          const wh = (payload) => S.processGoshipWebhook({ payload: { is_ondemand_shipment: true, gcode: 'ODG001', ...payload }, verified: true }, tx)

          // 1) báo cước: chỉ phương án hỏa tốc, điểm giao chính xác và được lưu vào đơn
          const o1 = await mk()
          const r = await S.ratesForOrder(o1.id, tx, settings)
          assert.equal(r.express, true)
          assert.deepEqual(r.options.map((o) => [o.id, o.carrier, o.fee, o.preferred]), [['OD|HAN-BIKE|1', 'Ahamove', 32500, true]])
          assert.equal(r.drop.level, 'address')
          assert.deepEqual([(await tx.order.findUnique({ where: { id: o1.id } })).recipientLat, (await tx.order.findUnique({ where: { id: o1.id } })).recipientLng], [10.7769, 106.7009])
          const ratesBody = sent.find(([m, p]) => m === 'POST' && p === '/ondemand-shipments/rates')[2]
          assert.deepEqual([ratesBody.paths[0].lat, ratesBody.paths[0].lng, ratesBody.paths[1].kind], [10.8, 106.72, 2])

          // 2) tạo đơn hỏa tốc: gửi đúng nội dung, lưu cờ onDemand, đơn sang Chờ giao hàng
          const s1 = await S.createShipmentForOrder({ orderId: o1.id, rateId: 'OD|HAN-BIKE|1', settings }, tx)
          assert.deepEqual([s1.trackingId, s1.carrierCode, s1.onDemand, s1.status, s1.pickupMethod], ['ODG001', 'AHA-771', true, 'AWAITING_PICKUP', 'PICKUP'])
          assert.match(s1.note, /Hỏa tốc · Ahamove/)
          assert.equal((await tx.order.findUnique({ where: { id: o1.id } })).status, 'AWAITING_SHIPMENT')
          const body = sent.find(([m, p]) => m === 'POST' && p === '/ondemand-shipments')[2]
          assert.deepEqual([body.order_id, body.carrier, body.vehicle, body.service], [o1.orderNumber, 1, 'BIKE', 'HAN-BIKE'])
          assert.equal(body.paths[1].parcel.cod_amount, 132500) // COD thu đúng tổng đơn
          assert.deepEqual([body.paths[1].lat, body.paths[1].lng], [10.7769, 106.7009])

          // 3) webhook hỏa tốc: mã trạng thái riêng (905 = đang giao, KHÔNG phải đã giao)
          let w = await wh({ status: 904, message: 'Đã lấy hàng', code: 'AHA-771' })
          assert.deepEqual([w.handled, w.status, w.orderStatus], [true, 'PICKED_UP', 'SHIPPING'])
          w = await wh({ status: 905, message: 'Đang giao' })
          assert.equal((await fresh(o1.id)).status, 'OUT_FOR_DELIVERY')
          assert.notEqual((await tx.order.findUnique({ where: { id: o1.id } })).status, 'DELIVERED')
          // webhook tự nhận là đơn thường (thiếu cờ) cho vận đơn hỏa tốc: KHÔNG tin nội dung, hỏi lại API hỏa tốc (đang báo 904)
          w = await S.processGoshipWebhook({ payload: { gcode: 'ODG001', status: 905, message: 'giả' }, verified: true }, tx)
          assert.equal((await fresh(o1.id)).status, 'OUT_FOR_DELIVERY')
          assert.ok(sent.some(([m, p]) => m === 'GET' && p === '/ondemand-shipments/ODG001'))
          w = await wh({ status: 906, message: 'Giao thành công' })
          assert.deepEqual([w.status, w.orderStatus], ['DELIVERED', 'DELIVERED'])

          // 4) vị trí chỉ tra được tới phường: chặn, trừ khi nhân viên xác nhận đã kiểm tra bản đồ
          const o2 = await mk({ addressLine: 'Số mờ 5' })
          const r2 = await S.ratesForOrder(o2.id, tx, settings)
          assert.equal(r2.drop.level, 'ward')
          await assert.rejects(S.createShipmentForOrder({ orderId: o2.id, rateId: 'OD|HAN-BIKE|1', settings }, tx), (e) => e.code === 'APPROX_LOCATION')
          const s2 = await S.createShipmentForOrder({ orderId: o2.id, rateId: 'OD|HAN-BIKE|1', settings, dropConfirmed: true }, tx)
          assert.equal(s2.onDemand, true)

          // 5) tọa độ nhân viên nhập tay: được chấp nhận không cần xác nhận thêm, và lưu vào đơn
          const o3 = await mk({ addressLine: 'Số mờ 9' })
          const s3 = await S.createShipmentForOrder({ orderId: o3.id, rateId: 'OD|HAN-BIKE|1', settings, drop: { lat: 10.77, lng: 106.69 } }, tx)
          assert.equal(s3.onDemand, true)
          assert.deepEqual([(await tx.order.findUnique({ where: { id: o3.id } })).recipientLat, (await tx.order.findUnique({ where: { id: o3.id } })).recipientLng], [10.77, 106.69])

          // 6) hủy đơn hỏa tốc: gọi đúng API hỏa tốc (DELETE /ondemand-shipments)
          const cancelled = await S.cancelShipmentById(s3.id, { actor: 'test', note: 'khách đổi ý' }, tx)
          assert.equal(cancelled.status, 'CANCELLED')
          assert.ok(sent.some(([m, p]) => m === 'DELETE' && p === `/ondemand-shipments/${s3.trackingId}`))
          assert.ok(!sent.some(([m, p]) => m === 'DELETE' && p === `/shipments/${s3.trackingId}`), 'không được gọi API vận đơn thường')

          // 7) COD vượt mức thu hộ của dịch vụ: không có phương án; thiếu tọa độ kho: báo lỗi rõ
          odRows = [{ ...odRows[0], max_cod: 50000 }]
          const o4 = await mk()
          await assert.rejects(S.ratesForOrder(o4.id, tx, settings), (e) => e.code === 'NO_RATES')
          odRows = [{ ...odRows[0], max_cod: 10000000 }]
          const noCoords = { ...settings, shipping: { ...settings.shipping, goship: { ...settings.shipping.goship, origin: { ...settings.shipping.goship.origin, lat: null, lng: null } } } }
          await assert.rejects(S.ratesForOrder(o4.id, tx, noCoords), (e) => e.code === 'ORIGIN_COORDS')

          // 8) đơn thường (không phải hỏa tốc) không bị ảnh hưởng: không gọi API hỏa tốc
          const before = sent.filter(([m, p]) => p === '/ondemand-shipments/rates').length
          const normal = await mk({ deliveryType: 'INTERPROVINCE' })
          await S.ratesForOrder(normal.id, tx, settings).catch(() => {}) // cước thường cần danh sách Goship, ở đây chỉ kiểm tra không rẽ sang hỏa tốc
          assert.equal(sent.filter(([m, p]) => p === '/ondemand-shipments/rates').length, before)

          throw new Rollback()
        },
        { timeout: 120000, maxWait: 15000 },
      )
    } catch (err) {
      if (!(err instanceof Rollback)) throw err
    } finally {
      globalThis.fetch = realFetch
      delete process.env.GOSHIP_TOKEN
      delete process.env.NOMINATIM_GAP_MS
    }
    await prisma.$disconnect()
  })
})
