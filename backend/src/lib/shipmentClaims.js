import { prisma } from './prisma.js'
import { toPlain } from '../utils/serialize.js'

// Đền bù từ Goship khi hàng mất / hỏng. Vòng đời: (chưa có) -> REQUESTED -> COMPENSATED | REJECTED. Gửi lại được sau khi bị từ chối.
// COMPENSATED là khoản "Thu nhập khác" trong tổng hợp kế toán (lib/shipmentReconcile.js).

export class ClaimError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`

// Thuần: vận đơn chỉ đòi đền bù được khi đã bàn giao cho hãng (không phải bản nháp / đã hủy), và chưa có yêu cầu đang chờ hay đã được đền bù.
export function assertCanOpenClaim(shipment) {
  if (shipment.status === 'NOT_CREATED') throw new ClaimError('Vận đơn chưa bàn giao cho hãng hoặc đã hủy nên không đòi đền bù được.')
  if (shipment.claimStatus === 'REQUESTED') throw new ClaimError('Vận đơn này đã có yêu cầu đền bù đang chờ Goship trả lời.', 409)
  if (shipment.claimStatus === 'COMPENSATED') throw new ClaimError('Vận đơn này đã được Goship đền bù rồi.', 409)
}

async function load(db, id) {
  const shipment = await db.shipment.findUnique({ where: { id }, include: { order: { select: { id: true } } } })
  if (!shipment) throw new ClaimError('Không tìm thấy vận đơn.', 404)
  return shipment
}

const log = (db, shipment, action, actor, note) =>
  db.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: shipment.order.id, action, actor, note } })

export async function openClaim(shipmentId, { amount, note, actor = 'admin' }, db = prisma) {
  const shipment = await load(db, shipmentId)
  assertCanOpenClaim(shipment)
  const updated = await db.shipment.update({ where: { id: shipmentId }, data: { claimStatus: 'REQUESTED', claimAmount: amount, claimCompensation: null, claimNote: note, claimAt: new Date() } })
  await log(db, shipment, 'claim_requested', actor, `Gửi yêu cầu đền bù Goship ${vnd(amount)}: ${note}`)
  return toPlain(updated)
}

export async function resolveClaim(shipmentId, { status, amount, note, actor = 'admin' }, db = prisma) {
  const shipment = await load(db, shipmentId)
  if (shipment.claimStatus !== 'REQUESTED') throw new ClaimError('Vận đơn này không có yêu cầu đền bù nào đang chờ.', 409)
  if (status === 'COMPENSATED' && !(amount > 0)) throw new ClaimError('Hãy nhập số tiền Goship đã đền bù.')
  const updated = await db.shipment.update({
    where: { id: shipmentId },
    data: { claimStatus: status, claimCompensation: status === 'COMPENSATED' ? amount : null, ...(note ? { claimNote: note } : {}) },
  })
  await log(db, shipment, status === 'COMPENSATED' ? 'claim_compensated' : 'claim_rejected', actor, status === 'COMPENSATED' ? `Goship đã đền bù ${vnd(amount)}${note ? `: ${note}` : ''}` : `Goship từ chối đền bù${note ? `: ${note}` : ''}`)
  return toPlain(updated)
}
