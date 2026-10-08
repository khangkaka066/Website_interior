import { z } from 'zod'
import { text, optionalText } from './common.js'
import { BANK_METHOD_ID, COD_METHOD_ID } from '../lib/settingsStore.js'

export const storeSchema = z.object({
  name: text('tên cửa hàng', 80),
  tagline: optionalText('khẩu hiệu', 120),
  hotline: text('số hotline', 30),
  email: optionalText('email', 120),
  address: text('địa chỉ', 200),
})

const methodBase = {
  label: text('tên phương thức', 80),
  description: optionalText('mô tả', 200),
  enabled: z.boolean('Trạng thái bật/tắt không hợp lệ.'),
}

export const paymentSchema = z
  .object({
    methods: z.tuple([
      z.object({ id: z.literal(COD_METHOD_ID), ...methodBase }),
      z.object({
        id: z.literal(BANK_METHOD_ID),
        ...methodBase,
        bank: z.object({
          bankName: optionalText('tên ngân hàng', 80),
          bankCode: z.string('Mã ngân hàng không hợp lệ.').regex(/^(\d{6})?$/, 'Mã ngân hàng không hợp lệ.').optional().transform((v) => v || undefined),
          accountNumber: optionalText('số tài khoản', 30),
          accountHolder: optionalText('chủ tài khoản', 80),
          transferNote: optionalText('nội dung chuyển khoản', 120),
        }),
      }),
    ]),
  })
  .superRefine((v, ctx) => {
    const [cod, bank] = v.methods
    if (!cod.enabled && !bank.enabled) {
      ctx.addIssue({ code: 'custom', message: 'Cần bật ít nhất một phương thức thanh toán.', path: ['methods'] })
    }
    if (bank.enabled) {
      for (const [k, label] of [['bankName', 'ngân hàng'], ['bankCode', 'ngân hàng'], ['accountNumber', 'số tài khoản'], ['accountHolder', 'chủ tài khoản']]) {
        if (!bank.bank[k]) ctx.addIssue({ code: 'custom', message: `Bật chuyển khoản thì cần chọn/nhập ${label}.`, path: ['methods', 1, 'bank', k] })
      }
      if (bank.bank.accountNumber && !/^\d{6,19}$/.test(bank.bank.accountNumber)) {
        ctx.addIssue({ code: 'custom', message: 'Số tài khoản chỉ gồm 6 đến 19 chữ số (không dấu cách) để tạo được mã QR.', path: ['methods', 1, 'bank', 'accountNumber'] })
      }
    }
  })

const money = (label) => z.number(`${label} không hợp lệ.`).int(`${label} phải là số nguyên.`).min(0, `${label} không được âm.`).max(10_000_000, `${label} quá lớn.`)
export const shippingSchema = z.object({
  fee: money('Phí vận chuyển'),
  freeShippingOver: money('Mức miễn phí vận chuyển'),
})

// Link mạng xã hội/Shopee: bỏ trống được, nếu có phải là http(s).
const url = (label) =>
  z
    .string(`${label} không hợp lệ.`)
    .trim()
    .max(300, `${label} quá dài.`)
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), `${label} phải bắt đầu bằng http:// hoặc https://.`)

// Như optionalText nhưng giữ chuỗi rỗng, để admin xóa trắng một ô thì không bị quay về nội dung mặc định.
const freeText = (label, max) =>
  z.string(`${label[0].toUpperCase()}${label.slice(1)} không hợp lệ.`).trim().max(max, `${label[0].toUpperCase()}${label.slice(1)} quá dài (tối đa ${max} ký tự).`)

export const contentSchema = z.object({
  about: z.object({
    heading: text('tiêu đề trang Về chúng tôi', 120),
    intro: freeText('đoạn giới thiệu', 300),
    story: freeText('câu chuyện thương hiệu', 4000),
    highlights: z
      .array(z.object({ title: text('tiêu đề điểm nổi bật', 80), text: text('mô tả điểm nổi bật', 300) }))
      .max(8, 'Tối đa 8 điểm nổi bật.'),
  }),
  contact: z.object({
    intro: freeText('lời giới thiệu trang Liên hệ', 400),
    hours: freeText('giờ làm việc', 120),
    shopeeUrl: url('Link Shopee'),
    zaloUrl: url('Link Zalo'),
    facebookUrl: url('Link Facebook'),
    showMap: z.boolean('Cài đặt bản đồ không hợp lệ.'),
  }),
  faq: z
    .array(z.object({ q: text('câu hỏi', 200), a: text('câu trả lời', 2000) }))
    .max(50, 'Tối đa 50 câu hỏi.'),
})
