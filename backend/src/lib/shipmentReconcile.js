import { prisma } from './prisma.js'
import { normCode } from './orderCode.js'
import { toPlain } from '../utils/serialize.js'
import { INACTIVE_SHIPMENT } from '../constants/workflow.js'

// Đối soát vận chuyển với Goship: nhân viên nạp file đối soát (xuất từ cổng Goship) dưới dạng các dòng { code, cod, fee, extraFee }.
// Mỗi dòng được đối chiếu với vận đơn của mình: khớp (đúng tiền COD, đúng cước, không truy thu) thì vận đơn đánh dấu "Đã đối soát";
// lệch thì ghi lại số liệu thực tế và lý do để nhân viên xử lý, KHÔNG đánh dấu đã đối soát.

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '')
const ALIASES = {
  code: ['code', 'gcode', 'trackingid', 'trackingnumber', 'mavandon', 'mavandonhang', 'mavandongoship', 'madon'],
  cod: ['cod', 'tienthuho', 'tiencod', 'codthuduoc', 'codcollected'],
  fee: ['fee', 'cuoc', 'cuocship', 'cuocthucte', 'phivanchuyen', 'cuocvanchuyen', 'actualfee'],
  extraFee: ['extrafee', 'phuphi', 'truythu', 'phulechcan', 'phatsinh', 'tienphatsinh', 'phidichvu'],
}

const money = (v) => {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : NaN
  const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/[.,](?=\d{3}(\D|$))/g, ''))
  return Number.isFinite(n) ? Math.round(n) : NaN
}

// Dòng thô (tên cột tiếng Việt hoặc tiếng Anh, có dấu hay không) -> { code, cod, fee, extraFee }. Thiếu mã thì trả null.
export function normalizeRow(raw) {
  const byKey = new Map(Object.entries(raw || {}).map(([k, v]) => [strip(k), v]))
  const pick = (names) => {
    for (const n of names) if (byKey.has(n) && byKey.get(n) !== '' && byKey.get(n) != null) return byKey.get(n)
    return undefined
  }
  const code = String(pick(ALIASES.code) ?? '').trim()
  if (!code) return null
  return { code, cod: money(pick(ALIASES.cod)), fee: money(pick(ALIASES.fee)), extraFee: money(pick(ALIASES.extraFee)) }
}

const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`

// Thuần (kiểm thử được): vận đơn + dòng đối soát -> { ok, issues[] }.
export function judgeRow(shipment, row) {
  const issues = []
  if (!['DELIVERED', 'RETURNED'].includes(shipment.status)) return { ok: false, final: false, issues: ['Vận đơn chưa giao xong nên chưa đối soát được'] }
  if ([row.cod, row.fee, row.extraFee].some((n) => Number.isNaN(n))) return { ok: false, final: true, issues: ['Số tiền trong file không đọc được'] }
  const expectedCod = shipment.status === 'DELIVERED' ? Math.round(Number(shipment.codAmount)) : 0
  if (row.cod !== expectedCod) issues.push(`Tiền COD hãng thu ${vnd(row.cod)}, đơn cần thu ${vnd(expectedCod)}`)
  const expectedFee = Math.round(Number(shipment.shippingFee))
  if (Math.abs(row.fee - expectedFee) > 1) issues.push(`Cước hãng tính ${vnd(row.fee)}, dự kiến ${vnd(expectedFee)}`)
  if (row.extraFee > 0) issues.push(`Hãng truy thu thêm ${vnd(row.extraFee)} (thường do lệch cân)`)
  return { ok: issues.length === 0, final: true, issues }
}

// Đối soát nhiều dòng. Trả về từng dòng một kết quả: matched | mismatch | not_found | not_final | invalid.
export async function reconcileRows(rawRows, { actor = 'admin' } = {}, db = prisma) {
  const results = []
  for (const raw of rawRows) {
    const row = normalizeRow(raw)
    if (!row) {
      results.push({ code: '', result: 'invalid', issues: ['Dòng không có mã vận đơn'] })
      continue
    }
    const shipment = await db.shipment.findFirst({
      where: { OR: [{ trackingId: row.code }, { carrierCode: normCode(row.code) }] },
      include: { order: { select: { id: true, orderNumber: true } } },
    })
    if (!shipment) {
      results.push({ code: row.code, result: 'not_found', issues: ['Không có vận đơn này trong hệ thống'] })
      continue
    }
    const verdict = judgeRow(shipment, row)
    if (!verdict.final) {
      results.push({ code: row.code, orderNumber: shipment.order.orderNumber, result: 'not_final', issues: verdict.issues })
      continue
    }
    const note = verdict.ok ? null : verdict.issues.join('; ')
    await db.shipment.update({
      where: { id: shipment.id },
      data: { actualFee: row.fee, extraFee: row.extraFee, codCollected: row.cod, reconciledAt: verdict.ok ? new Date() : null, reconcileNote: note },
    })
    await db.activityLog.create({
      data: {
        entityType: 'shipment',
        shipmentId: shipment.id,
        orderId: shipment.order.id,
        action: verdict.ok ? 'reconcile_matched' : 'reconcile_mismatch',
        actor,
        note: verdict.ok ? `Đối soát khớp: cước ${vnd(row.fee)}, COD ${vnd(row.cod)}` : `Đối soát lệch: ${note}`,
      },
    })
    results.push({ code: row.code, orderNumber: shipment.order.orderNumber, result: verdict.ok ? 'matched' : 'mismatch', issues: verdict.issues })
  }
  const count = (r) => results.filter((x) => x.result === r).length
  return { total: results.length, matched: count('matched'), mismatch: count('mismatch'), notFound: count('not_found'), notFinal: count('not_final'), invalid: count('invalid'), results }
}

// Sổ tổng hợp dòng tiền vận chuyển cho kế toán (không phụ thuộc kỳ): cước tạm tính vs thực tế, COD chờ đối soát, chi phí hoàn hàng.
export async function accountingSummary(db = prisma) {
  const live = { status: { notIn: INACTIVE_SHIPMENT } }
  const [estimate, actual, codWaiting, codReconciled, returned, unreconciled, mismatched, compensated, claimsPending] = await Promise.all([
    db.shipment.aggregate({ where: { ...live, reconciledAt: null, status: { notIn: [...INACTIVE_SHIPMENT, 'RETURNED'] } }, _sum: { shippingFee: true } }),
    db.shipment.aggregate({ where: { actualFee: { not: null } }, _sum: { actualFee: true, extraFee: true } }),
    db.shipment.aggregate({ where: { status: 'DELIVERED', reconciledAt: null, codAmount: { gt: 0 } }, _sum: { codAmount: true }, _count: { _all: true } }),
    db.shipment.aggregate({ where: { reconciledAt: { not: null }, codCollected: { gt: 0 } }, _sum: { codCollected: true } }),
    // chi phí rủi ro: cước (cả phụ phí) của vận đơn bị hoàn về kho, và của đơn khách trả hàng (hàng đã giao nhưng quay lại)
    db.shipment.aggregate({ where: { OR: [{ status: 'RETURNED' }, { order: { status: 'RETURNED' } }] }, _sum: { shippingFee: true, extraFee: true }, _count: { _all: true } }),
    db.shipment.count({ where: { status: { in: ['DELIVERED', 'RETURNED'] }, reconciledAt: null } }),
    db.shipment.count({ where: { reconciledAt: null, reconcileNote: { not: null } } }),
    db.shipment.aggregate({ where: { claimStatus: 'COMPENSATED' }, _sum: { claimCompensation: true }, _count: { _all: true } }),
    db.shipment.aggregate({ where: { claimStatus: 'REQUESTED' }, _sum: { claimAmount: true }, _count: { _all: true } }),
  ])
  const n = (v) => Number(v || 0)
  return toPlain({
    shippingEstimate: n(estimate._sum.shippingFee), // cước tạm tính của vận đơn chưa đối soát (đang chạy)
    shippingActual: n(actual._sum.actualFee) + n(actual._sum.extraFee), // cước + phụ phí thực tế đã nạp
    extraFeeTotal: n(actual._sum.extraFee),
    codWaiting: n(codWaiting._sum.codAmount), // COD đã giao nhưng chưa đối soát với Goship
    codWaitingCount: codWaiting._count._all,
    codReconciled: n(codReconciled._sum.codCollected),
    returnedCost: n(returned._sum.shippingFee) + n(returned._sum.extraFee), // chi phí rủi ro: cước đơn hoàn về
    returnedCount: returned._count._all,
    unreconciled, // vận đơn giao xong (hoặc hoàn) nhưng chưa khớp đối soát
    mismatched,
    otherIncome: n(compensated._sum.claimCompensation), // thu nhập khác: Goship đã đền bù hàng mất / hỏng
    compensatedCount: compensated._count._all,
    claimsPending: claimsPending._count._all, // yêu cầu đền bù đang chờ Goship trả lời
    claimsPendingAmount: n(claimsPending._sum.claimAmount),
  })
}
