import { z } from 'zod'
import { text, optionalText, phone } from './common.js'

const password = z
  .string('Mật khẩu không hợp lệ.')
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
  .max(128, 'Mật khẩu quá dài (tối đa 128 ký tự).')

const dob = z
  .string('Ngày sinh không hợp lệ.')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh không hợp lệ.')
  .refine((v) => {
    const d = new Date(v)
    return !Number.isNaN(d.getTime()) && d <= new Date() && d.getFullYear() >= 1900
  }, 'Ngày sinh không hợp lệ.')

export const updateProfileSchema = z.object({
  name: text('họ tên', 100),
  phone: phone().optional().or(z.literal('').transform(() => undefined)),
  dob: dob.optional().or(z.literal('').transform(() => null)),
  gender: z.enum(['male', 'female', 'other'], 'Giới tính không hợp lệ.').optional().or(z.literal('').transform(() => null)),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string('Vui lòng nhập mật khẩu hiện tại.').min(1, 'Vui lòng nhập mật khẩu hiện tại.').max(128),
  newPassword: password,
})

export const addressSchema = z.object({
  recipientName: text('tên người nhận', 100),
  phone: phone('số điện thoại người nhận'),
  addressLine: text('địa chỉ', 300),
  ward: optionalText('phường/xã', 100),
  district: optionalText('quận/huyện', 100),
  province: text('tỉnh/thành phố', 100),
  isDefault: z.boolean().optional(),
})

export const claimOrderSchema = z.object({
  orderNumber: text('mã đơn hàng', 30),
  phone: phone(),
})
