import { z } from 'zod'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Chuỗi bắt buộc, tự cắt khoảng trắng hai đầu.
export const text = (label, max = 200) =>
  z
    .string(`Vui lòng nhập ${label}.`)
    .trim()
    .min(1, `Vui lòng nhập ${label}.`)
    .max(max, `${cap(label)} quá dài (tối đa ${max} ký tự).`)

// Chuỗi tùy chọn: bỏ trống hoặc "" thì coi như không có.
export const optionalText = (label, max = 200) =>
  z
    .string(`${cap(label)} không hợp lệ.`)
    .trim()
    .max(max, `${cap(label)} quá dài (tối đa ${max} ký tự).`)
    .optional()
    .transform((v) => v || undefined)

export const phone = (label = 'số điện thoại') =>
  z
    .string(`Vui lòng nhập ${label}.`)
    .trim()
    .regex(/^[0-9+\s().-]{8,20}$/, `${cap(label)} không hợp lệ.`)

export const email = z
  .string('Email không hợp lệ.')
  .trim()
  .max(254, 'Email quá dài.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ.')
