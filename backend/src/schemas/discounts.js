import { z } from 'zod'
import { text } from './common.js'

export const discountsSchema = z.object({
  rules: z
    .array(
      z.object({
        sku: text('SKU', 100),
        percent: z
          .number('Phần trăm giảm không hợp lệ.')
          .int('Phần trăm giảm phải là số nguyên.')
          .min(1, 'Phần trăm giảm tối thiểu 1%.')
          .max(90, 'Phần trăm giảm tối đa 90%.'),
      }),
      'Danh sách giảm giá không hợp lệ.',
    )
    .max(1000, 'Quá nhiều dòng giảm giá.'),
})
