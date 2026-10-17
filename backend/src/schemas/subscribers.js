import { z } from 'zod'
import { email } from './common.js'

const subject = z.string('Tiêu đề không hợp lệ.').trim().min(1, 'Vui lòng nhập tiêu đề.').max(150, 'Tiêu đề tối đa 150 ký tự.')
const body = z.string('Nội dung không hợp lệ.').trim().min(1, 'Vui lòng nhập nội dung.').max(10000, 'Nội dung tối đa 10.000 ký tự.')

export const blastSchema = z.object({ subject, body })
export const blastTestSchema = z.object({ subject, body, to: email })
export const unsubscribeSchema = z.object({ token: z.string('Liên kết không hợp lệ.').trim().min(8, 'Liên kết không hợp lệ.').max(100, 'Liên kết không hợp lệ.') })

export const welcomeConfigSchema = z
  .object({
    welcomeEnabled: z.boolean(),
    welcomeType: z.enum(['PERCENT', 'FIXED'], 'Loại giảm giá không hợp lệ.'),
    welcomeValue: z.number('Mức giảm không hợp lệ.').int().min(1, 'Mức giảm không hợp lệ.').max(1_000_000_000),
    welcomeMaxDiscount: z.number().int().min(0).max(1_000_000_000),
    welcomeMinOrder: z.number().int().min(0).max(1_000_000_000),
    welcomeDays: z.number('Số ngày không hợp lệ.').int().min(0).max(3650),
  })
  .superRefine((c, ctx) => {
    if (c.welcomeType === 'PERCENT' && c.welcomeValue > 100) ctx.addIssue({ code: 'custom', path: ['welcomeValue'], message: 'Phần trăm giảm tối đa 100.' })
  })
