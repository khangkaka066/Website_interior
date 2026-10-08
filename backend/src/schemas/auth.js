import { z } from 'zod'
import { text, optionalText, phone, email } from './common.js'

export const registerSchema = z.object({
  name: text('họ tên', 100),
  email,
  password: z
    .string('Mật khẩu không hợp lệ.')
    .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
    .max(128, 'Mật khẩu quá dài (tối đa 128 ký tự).'),
  phone: phone().optional().or(z.literal('').transform(() => undefined)),
})

// `email` ở đây có thể là tên đăng nhập (ví dụ tài khoản admin), nên không ép định dạng email.
export const loginSchema = z.object({
  email: text('email hoặc tên đăng nhập', 254),
  password: z.string('Vui lòng nhập mật khẩu.').min(1, 'Vui lòng nhập mật khẩu.').max(128, 'Mật khẩu quá dài.'),
})

export const forgotPasswordSchema = z.object({ email: text('email', 254) })

export const resetPasswordSchema = z.object({
  token: z.string('Liên kết không hợp lệ.').regex(/^[a-f0-9]{64}$/, 'Liên kết đặt lại mật khẩu không hợp lệ.'),
  password: z
    .string('Mật khẩu không hợp lệ.')
    .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
    .max(128, 'Mật khẩu quá dài (tối đa 128 ký tự).'),
})

export const googleLoginSchema = z.object({
  credential: z.string('Thiếu thông tin đăng nhập Google.').min(20, 'Thông tin đăng nhập Google không hợp lệ.').max(4096, 'Thông tin đăng nhập Google không hợp lệ.'),
})
