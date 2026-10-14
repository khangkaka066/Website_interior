import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// Vòng đời đơn hàng kiểu Shopee với database thật, TOÀN BỘ trong một transaction rồi rollback: không để lại dữ liệu.
// Tác vụ nền chỉ chạm các đơn thử (tiền tố ZZ-OF-), khách thử không có email nên không gửi thư.
// Chạy trên database trong .env nên chỉ chạy khi bật cờ:  npm run test:db
const enabled = process.env.RUN_DB_TESTS === '1'
const suite = enabled ? describe : describe.skip

class Rollback extends Error {}
const HOUR = 3600 * 1000
const DAY = 24 * HOUR

suite('vòng đời đơn hàng với database (rollback)', () => {
  test('khách hủy, yêu cầu hủy, tự hủy quá hạn, nhận hàng, trả hàng, đánh giá', async () => {
    await import('dotenv/config')
    const { prisma } = await import('../src/lib/prisma.js')
    const F = await import('../src/lib/orderFlow.js')
    const rules = { unpaidCancelHours: 24, handleHours: 48, intracityHandleHours: 24, expressHandleHours: 6, cancelAutoApproveHours: 24, autoReceiveDays: 7, returnWindowDays: 7, expressKeywords: 'hỏa tốc' }
    const only = { orderNumber: { startsWith: 'ZZ-OF-' } }
    let seq = 0

    try {
      await prisma.$transaction(
        async (tx) => {
          const customer = await tx.customer.create({ data: { name: 'ZZ Flow', phone: '0900000092' } })
          // Tạo đơn thử với 1 sản phẩm; createdAt/ngày giao chỉnh được để thử các mốc thời gian.
          const mk = async (over = {}, { deliveredAgo } = {}) => {
            const order = await tx.order.create({
              data: {
                orderNumber: `ZZ-OF-${Date.now()}-${++seq}`, customerId: customer.id, status: 'PENDING_CONFIRMATION', paymentMethod: 'Chuyển khoản',
                subtotal: 100000, shippingFee: 0, total: 100000, recipientName: 'Nguyen Van A', recipientPhone: '0900000092', addressLine: '1 Test', province: 'HCM',
                items: { create: [{ productId: 'sp-test-1', name: 'Rèm thử', variant: 'Xanh', quantity: 1, unitPrice: 100000, lineTotal: 100000 }] },
                ...over,
              },
            })
            if (deliveredAgo !== undefined) {
              await tx.orderStatusEvent.create({ data: { orderId: order.id, status: 'DELIVERED', note: 'test', createdAt: new Date(Date.now() - deliveredAgo) } })
            }
            return order
          }
          const load = (id) => tx.order.findUnique({ where: { id }, include: F.ORDER_INCLUDE })
          const rejectsFlow = (p, re) => assert.rejects(p, (e) => e instanceof F.FlowError && re.test(e.message))

          // --- 1) Khách hủy khi còn "Chờ xác nhận": hủy ngay ---
          let o = await mk()
          let r = await F.customerCancel(await load(o.id), 'Đặt nhầm', tx)
          assert.equal(r.result, 'cancelled')
          let after = await load(o.id)
          assert.equal(after.status, 'CANCELLED')
          assert.ok(after.activityLogs.some((l) => l.action === 'status_cancelled' && l.actor === 'customer'))
          await rejectsFlow(F.customerCancel(after, 'Lại hủy', tx), /không thể hủy/) // đã hủy rồi

          // --- 2) Đã xác nhận: chỉ gửi yêu cầu, nhân viên duyệt / từ chối ---
          o = await mk({ status: 'CONFIRMED' })
          r = await F.customerCancel(await load(o.id), 'Đổi ý', tx)
          assert.equal(r.result, 'requested')
          after = await load(o.id)
          assert.equal(after.status, 'CONFIRMED') // chưa hủy
          assert.ok(after.cancelRequestedAt)
          await rejectsFlow(F.customerCancel(after, 'Lần nữa', tx), /đã gửi yêu cầu hủy/)
          after = await F.rejectCancel(after, { note: 'Hàng đã đóng gói' }, tx)
          assert.equal(after.cancelRequestedAt, null)
          assert.equal(after.cancelRejectedNote, 'Hàng đã đóng gói')
          assert.equal(after.status, 'CONFIRMED')
          // gửi lại rồi đồng ý
          await F.customerCancel(await load(o.id), 'Vẫn muốn hủy', tx)
          after = await F.approveCancel(await load(o.id), { note: 'OK' }, tx)
          assert.equal(after.status, 'CANCELLED')
          assert.equal(after.cancelRequestedAt, null)

          // --- 3) Đã có vận đơn thì không duyệt hủy; đang giao thì không hủy ---
          const carrier = await tx.shippingCarrier.upsert({ where: { code: 'ZZOF' }, update: {}, create: { code: 'ZZOF', name: 'ZZ Test', enabled: true, apiStatus: 'connected', serviceTypes: [] } })
          o = await mk({ status: 'AWAITING_SHIPMENT', cancelRequestedAt: new Date(), cancelRequestReason: 'x' })
          await tx.shipment.create({ data: { trackingId: `ZZOF${Date.now()}`, orderId: o.id, carrierId: carrier.id, status: 'AWAITING_PICKUP', senderName: 's', recipientName: 'r', recipientPhone: '0900000092', addressLine: 'a', province: 'p', weightGrams: 500, shippingFee: 0 } })
          await rejectsFlow(F.approveCancel(await load(o.id), {}, tx), /hủy vận đơn trước/)
          o = await mk({ status: 'SHIPPING' })
          await rejectsFlow(F.customerCancel(await load(o.id), 'x', tx), /đang được giao/)

          // --- 4) Tự hủy đơn chưa thanh toán quá hạn ---
          const old = new Date(Date.now() - 30 * HOUR)
          const dueBank = await mk({ createdAt: old })
          const dueFailed = await mk({ createdAt: old, paymentStatus: 'FAILED', status: 'CONFIRMED' })
          const fresh = await mk({ createdAt: new Date(Date.now() - 2 * HOUR) })
          const cod = await mk({ createdAt: old, paymentMethod: 'COD' })
          const paid = await mk({ createdAt: old, paymentStatus: 'PAID' })
          const shipped = await mk({ createdAt: old, status: 'AWAITING_SHIPMENT' })
          await tx.shipment.create({ data: { trackingId: `ZZOF${Date.now()}b`, orderId: shipped.id, carrierId: carrier.id, status: 'AWAITING_PICKUP', senderName: 's', recipientName: 'r', recipientPhone: '0900000092', addressLine: 'a', province: 'p', weightGrams: 500, shippingFee: 0 } })
          const n = await F.autoCancelUnpaid(tx, new Date(), { rules, where: only })
          assert.equal(n, 2)
          const st = async (x) => (await load(x.id)).status
          assert.deepEqual([await st(dueBank), await st(dueFailed)], ['CANCELLED', 'CANCELLED'])
          assert.deepEqual([await st(fresh), await st(cod), await st(paid), await st(shipped)], ['PENDING_CONFIRMATION', 'PENDING_CONFIRMATION', 'PENDING_CONFIRMATION', 'AWAITING_SHIPMENT'])
          const sys = (await load(dueBank.id)).activityLogs.find((l) => l.action === 'status_cancelled')
          assert.equal(sys.actor, 'system')
          assert.match(sys.note, /quá 24 giờ chưa thanh toán/)
          assert.equal(await F.autoCancelUnpaid(tx, new Date(), { rules: { ...rules, unpaidCancelHours: 0 }, where: only }), 0) // quy tắc tắt

          // --- 5) Nhận hàng: khách bấm, hoặc hệ thống tự xác nhận sau N ngày ---
          o = await mk({ status: 'DELIVERED' }, { deliveredAgo: 1 * DAY })
          assert.deepEqual(await F.markReceived(await load(o.id), {}, tx), { already: false })
          assert.deepEqual(await F.markReceived(await load(o.id), {}, tx), { already: true }) // bấm lại không lỗi, không ghi trùng
          await rejectsFlow(F.markReceived(await load((await mk()).id), {}, tx), /đã được giao/)
          const oldDelivered = await mk({ status: 'DELIVERED' }, { deliveredAgo: 8 * DAY })
          const newDelivered = await mk({ status: 'DELIVERED' }, { deliveredAgo: 2 * DAY })
          assert.equal(await F.autoReceive(tx, new Date(), { rules, where: only }), 1)
          assert.ok((await load(oldDelivered.id)).receivedAt)
          assert.equal((await load(newDelivered.id)).receivedAt, null)
          assert.equal((await load(oldDelivered.id)).activityLogs.find((l) => l.action === 'auto_received').actor, 'system')

          // --- 6) Trả hàng ---
          o = await mk({ status: 'DELIVERED' }, { deliveredAgo: 2 * DAY })
          assert.equal(await F.canRequestReturn(await load(o.id), rules, tx), true)
          await F.createReturnRequest(await load(o.id), { reason: 'Hàng lỗi', note: 'Rách' }, rules, tx)
          await rejectsFlow(F.createReturnRequest(await load(o.id), { reason: 'Lại' }, rules, tx), /đã có yêu cầu/)
          after = await F.approveReturn(await load(o.id), { note: 'Gửi về kho' }, tx)
          assert.equal(after.status, 'RETURNED')
          assert.equal(after.returnRequest.status, 'APPROVED')
          o = await mk({ status: 'DELIVERED' }, { deliveredAgo: 1 * DAY })
          await F.createReturnRequest(await load(o.id), { reason: 'Đổi ý' }, rules, tx)
          after = await F.rejectReturn(await load(o.id), { note: 'Hàng đã sử dụng' }, tx)
          assert.equal(after.status, 'DELIVERED')
          assert.equal(after.returnRequest.status, 'REJECTED')
          const lateOrder = await mk({ status: 'DELIVERED' }, { deliveredAgo: 9 * DAY })
          await rejectsFlow(F.createReturnRequest(await load(lateOrder.id), { reason: 'Muộn' }, rules, tx), /quá 7 ngày/)
          const pendingOrder = await mk({ status: 'CONFIRMED' })
          await rejectsFlow(F.createReturnRequest(await load(pendingOrder.id), { reason: 'x' }, rules, tx), /đã được giao/)
          await rejectsFlow(F.createReturnRequest(await load(lateOrder.id), { reason: 'x' }, { ...rules, returnWindowDays: 0 }, tx), /không nhận yêu cầu trả hàng/)

          // --- 7) Đánh giá ---
          o = await mk({ status: 'DELIVERED' }, { deliveredAgo: 1 * DAY })
          const item = (await load(o.id)).items[0]
          await rejectsFlow(F.createReviews(await load((await mk()).id), [{ orderItemId: 'x', rating: 5 }], tx), /đã nhận hàng/) // chưa giao
          await rejectsFlow(F.createReviews(await load(o.id), [{ orderItemId: 'khong-co', rating: 5 }], tx), /không thuộc đơn/)
          assert.equal(await F.createReviews(await load(o.id), [{ orderItemId: item.id, rating: 4, comment: 'Đẹp, đúng mô tả' }], tx), 1)
          await rejectsFlow(F.createReviews(await load(o.id), [{ orderItemId: item.id, rating: 5 }], tx), /đã đánh giá/)
          const o2 = await mk({ status: 'DELIVERED' }, { deliveredAgo: 1 * DAY })
          await F.createReviews(await load(o2.id), [{ orderItemId: (await load(o2.id)).items[0].id, rating: 2 }], tx)
          const sum = await F.productReviews('sp-test-1', {}, tx)
          assert.equal(sum.count, 2)
          assert.equal(sum.average, 3)
          assert.deepEqual([sum.distribution[4], sum.distribution[2]], [1, 1])
          assert.equal(sum.items[0].authorName, 'N*** V*** A***') // tên đã che
          await tx.review.updateMany({ where: { orderItemId: item.id }, data: { hidden: true } })
          assert.equal((await F.productReviews('sp-test-1', {}, tx)).count, 1) // đánh giá bị ẩn không hiện công khai

          // --- 8) Tự đồng ý yêu cầu hủy sau 24 giờ không phản hồi ---
          const ask = (hoursAgo) => ({ status: 'CONFIRMED', cancelRequestedAt: new Date(Date.now() - hoursAgo * HOUR), cancelRequestReason: 'Đổi ý' })
          const stale = await mk(ask(30))
          const recent = await mk(ask(2))
          const staleShip = await mk({ ...ask(30), status: 'AWAITING_SHIPMENT' })
          const sh = await tx.shipment.create({ data: { trackingId: `ZZOF${Date.now()}c`, orderId: staleShip.id, carrierId: carrier.id, status: 'AWAITING_PICKUP', senderName: 's', recipientName: 'r', recipientPhone: '0900000092', addressLine: 'a', province: 'p', weightGrams: 500, shippingFee: 0 } })
          assert.equal(await F.autoApproveCancels(tx, new Date(), { rules: { ...rules, cancelAutoApproveHours: 0 }, where: only }), 0) // tắt
          assert.equal(await F.autoApproveCancels(tx, new Date(), { rules, where: only }), 2)
          assert.equal(await st(stale), 'CANCELLED')
          assert.equal(await st(recent), 'CONFIRMED') // chưa đủ 24 giờ
          assert.equal(await st(staleShip), 'CANCELLED')
          assert.equal((await tx.shipment.findUnique({ where: { id: sh.id } })).status, 'NOT_CREATED') // vận đơn được hủy cùng
          const auto = (await load(stale.id)).activityLogs.find((l) => l.action === 'status_cancelled')
          assert.equal(auto.actor, 'system')
          assert.match(auto.note, /Tự động đồng ý/)

          // --- 9) Điền loại giao hàng cho đơn cũ ---
          const legacy = await mk({ province: 'Hồ Chí Minh' })
          const legacyFar = await mk({ province: 'Hà Nội' })
          const cfg = { orders: rules, shipping: { goship: { origin: { province: 'Hồ Chí Minh' } } }, store: { address: '' } }
          assert.ok((await F.backfillDeliveryTypes(tx, { settings: cfg, where: only })) >= 2)
          assert.equal((await load(legacy.id)).deliveryType, 'INTRACITY')
          assert.equal((await load(legacyFar.id)).deliveryType, 'INTERPROVINCE')

          throw new Rollback() // hoàn tác toàn bộ dữ liệu thử
        },
        { timeout: 60000, maxWait: 15000 },
      )
    } catch (err) {
      if (!(err instanceof Rollback)) throw err
    }
    await prisma.$disconnect()
  })
})
