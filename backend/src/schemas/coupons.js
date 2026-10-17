import { z } from 'zod'

const int = (label, { min = 0, max = 1_000_000_000 } = {}) =>
  z.number(`${label} không hợp lệ.`).int(`${label} phải là số nguyên.`).min(min, `${label} không hợp lệ.`).max(max, `${label} quá lớn.`)
const optInt = (label, opts) => int(label, opts).nullable().optional()
const optDate = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}/)]).nullable().optional()

const base = z.object({
  code: z
    .string('Mã không hợp lệ.')
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, 'Mã gồm 3-30 ký tự chữ không dấu, số, gạch ngang hoặc gạch dưới.'),
  description: z.string().trim().max(200, 'Mô tả tối đa 200 ký tự.').nullable().optional(),
  type: z.enum(['FIXED', 'PERCENT'], 'Loại giảm giá không hợp lệ.'),
  value: int('Mức giảm', { min: 1 }),
  maxDiscount: optInt('Mức giảm tối đa', { min: 1 }),
  minOrder: int('Đơn tối thiểu'),
  usageLimit: optInt('Tổng lượt dùng', { min: 1 }),
  perCustomerLimit: optInt('Lượt dùng mỗi khách', { min: 1 }),
  startsAt: optDate,
  endsAt: optDate,
  active: z.boolean(),
})

const rules = (c, ctx) => {
  if (c.type === 'PERCENT' && c.value > 100) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Phần trăm giảm tối đa 100.' })
  if (c.startsAt && c.endsAt && new Date(c.endsAt) <= new Date(c.startsAt)) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' })
}

// Mặc định chỉ áp khi tạo mới; sửa một phần thì trường nào không gửi sẽ giữ nguyên.
export const couponSchema = base.extend({ minOrder: base.shape.minOrder.default(0), active: base.shape.active.default(true) }).superRefine(rules)
export const couponPatchSchema = base.partial().superRefine(rules)
export const couponCheckSchema = z.object({
  code: z.string('Vui lòng nhập mã giảm giá.').trim().min(1, 'Vui lòng nhập mã giảm giá.').max(40, 'Mã không hợp lệ.'),
  subtotal: z.number('Tạm tính không hợp lệ.').min(0).max(1_000_000_000),
})
