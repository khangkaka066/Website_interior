import { z } from 'zod'
import { text } from './common.js'

export const discountsSchema = z.object({
  rules: z
    .array(
      z.object({
        // SKU, Mã Shopee hoặc mã phân loại: server tự nhận ra là sản phẩm hay phân loại.
        code: text('mã sản phẩm / mã phân loại / SKU', 100),
        // Quy tắc nhập từ file Excel: giá bán cố định = salePrice, giá gạch ngang = originalPrice.
        originalPrice: z.number().int().min(1).max(120000000).optional(),
        salePrice: z.number().int().min(1).max(120000000).optional(),
        percent: z
          .number('Phần trăm giảm không hợp lệ.')
          .int('Phần trăm giảm phải là số nguyên.')
          .min(1, 'Phần trăm giảm tối thiểu 1%.')
          .max(90, 'Phần trăm giảm tối đa 90%.'),
      }),
      'Danh sách giảm giá không hợp lệ.',
    )
    .max(5000, 'Quá nhiều dòng giảm giá.'),
})

export const importSchema = z.object({
  apply: z.boolean().optional(), // false/bỏ trống: chỉ xem trước
  rows: z
    .array(
      z.object({
        row: z.number().int().optional(),
        productCode: z.union([z.string(), z.number()]).optional(),
        variantCode: z.union([z.string(), z.number()]).optional(),
        listPrice: z.union([z.string(), z.number()]).optional(),
        salePrice: z.union([z.string(), z.number()]).optional(),
      }),
      'Dữ liệu file không hợp lệ.',
    )
    .min(1, 'File không có dòng dữ liệu nào.')
    .max(5000, 'File có quá nhiều dòng (tối đa 5000).'),
})
