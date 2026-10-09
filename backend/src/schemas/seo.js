import { z } from 'zod'

export const keywordsSchema = z
  .object({
    productId: z.string('Mã sản phẩm không hợp lệ.').trim().min(1).max(100).optional(),
    topic: z.string('Chủ đề không hợp lệ.').trim().min(2, 'Chủ đề quá ngắn.').max(200, 'Chủ đề quá dài (tối đa 200 ký tự).').optional(),
  })
  .refine((v) => v.productId || v.topic, { message: 'Hãy chọn một sản phẩm hoặc nhập chủ đề.' })
