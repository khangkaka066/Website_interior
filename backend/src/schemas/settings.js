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

const whole = (label, max) =>
  z.number(`${label} không hợp lệ.`).int(`${label} phải là số nguyên.`).min(0, `${label} không được âm.`).max(max, `${label} quá lớn (tối đa ${max}).`)
export const ordersSchema = z.object({
  unpaidCancelHours: whole('Giờ tự hủy đơn chưa thanh toán', 720),
  handleHours: whole('Hạn xử lý đơn liên tỉnh (giờ)', 720),
  intracityHandleHours: whole('Hạn xử lý đơn nội thành (giờ)', 720),
  expressHandleHours: whole('Hạn xử lý đơn hỏa tốc (giờ)', 720),
  cancelAutoApproveHours: whole('Giờ tự đồng ý yêu cầu hủy', 720),
  expressKeywords: optionalText('từ khóa hỏa tốc', 300).transform((v) => v ?? ''),
  autoConfirmEnabled: z.boolean('Giá trị bật/tắt không hợp lệ.'),
  cancelOrderOnShipmentCancel: z.boolean('Giá trị bật/tắt không hợp lệ.').optional(),
  autoConfirmCodMax: z.number('Số tiền không hợp lệ.').int('Số tiền phải là số nguyên.').min(0, 'Số tiền không được âm.').max(1_000_000_000, 'Số tiền quá lớn.'),
  autoConfirmDelayMinutes: whole('Số phút chờ trước khi tự xác nhận', 1440),
  pickupCutoff: z.string('Giờ chốt đơn không hợp lệ.').trim().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, 'Giờ chốt đơn dạng HH:MM, ví dụ 15:30 (để trống nếu không dùng).'),
  pickupAlertHours: whole('Giờ cảnh báo hãng chưa lấy hàng', 720),
  autoReceiveDays: whole('Số ngày tự xác nhận đã nhận hàng', 90),
  returnWindowDays: whole('Số ngày được trả hàng', 90),
})

const money = (label) => z.number(`${label} không hợp lệ.`).int(`${label} phải là số nguyên.`).min(0, `${label} không được âm.`).max(10_000_000, `${label} quá lớn.`)
const place = (label) => z.string(`${label} không hợp lệ.`).trim().max(100, `${label} quá dài.`)
const phoneText = z
  .string('Số điện thoại người gửi không hợp lệ.')
  .trim()
  .max(20, 'Số điện thoại người gửi quá dài.')
  .refine((v) => v === '' || /^[0-9+().\s-]{8,20}$/.test(v), 'Số điện thoại người gửi chỉ gồm chữ số (8 đến 20 ký tự).')
export const shippingSchema = z
  .object({
    fee: money('Phí vận chuyển'),
    freeShippingOver: money('Mức miễn phí vận chuyển'),
    goship: z
      .object({
        enabled: z.boolean('Trạng thái Goship không hợp lệ.'),
        createShipments: z.boolean('Trạng thái tạo vận đơn không hợp lệ.').optional().default(false),
        expressEnabled: z.boolean('Trạng thái giao hỏa tốc không hợp lệ.').optional().default(false),
        defaultWeightGrams: z.number('Cân nặng không hợp lệ.').int('Cân nặng phải là số nguyên (gram).').min(100, 'Cân nặng tối thiểu 100g.').max(100_000, 'Cân nặng tối đa 100.000g.'),
        origin: z.object({
          province: place('Tỉnh/thành kho gửi hàng'),
          district: place('Quận/huyện kho gửi hàng'),
          ward: place('Phường/xã kho gửi hàng'),
          street: z.string('Địa chỉ kho gửi hàng không hợp lệ.').trim().max(200, 'Địa chỉ kho gửi hàng quá dài.').optional().default(''),
          name: place('Tên người gửi').optional().default(''),
          phone: phoneText.optional().default(''),
          // Tọa độ kho: cần cho giao hỏa tốc (API hỏa tốc nhận tọa độ, không nhận mã phường/xã).
          lat: z.number('Vĩ độ kho không hợp lệ.').min(8, 'Vĩ độ kho phải nằm trong Việt Nam (8 đến 24,5).').max(24.5, 'Vĩ độ kho phải nằm trong Việt Nam (8 đến 24,5).').nullable().optional().default(null),
          lng: z.number('Kinh độ kho không hợp lệ.').min(102, 'Kinh độ kho phải nằm trong Việt Nam (102 đến 110).').max(110, 'Kinh độ kho phải nằm trong Việt Nam (102 đến 110).').nullable().optional().default(null),
        }),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    const g = d.goship
    const o = g?.origin
    if (g?.enabled && !(o?.province && o?.district && o?.ward)) {
      ctx.addIssue({ code: 'custom', message: 'Chọn đủ tỉnh, quận/huyện, phường/xã của kho gửi hàng trước khi bật tính cước Goship.', path: ['goship', 'origin'] })
    }
    if (g?.createShipments && !g.enabled) {
      ctx.addIssue({ code: 'custom', message: 'Cần bật tính cước Goship trước khi cho phép tạo vận đơn thật.', path: ['goship', 'createShipments'] })
    }
    if (g?.expressEnabled && !(g.enabled && g.createShipments)) {
      ctx.addIssue({ code: 'custom', message: 'Cần bật tính cước Goship và cho phép tạo vận đơn thật trước khi bán giao hỏa tốc.', path: ['goship', 'expressEnabled'] })
    }
    if (g?.expressEnabled && !(o?.lat != null && o?.lng != null)) {
      ctx.addIssue({ code: 'custom', message: 'Nhập tọa độ kho gửi hàng (vĩ độ, kinh độ) trước khi bán giao hỏa tốc. Dùng nút "Tìm tọa độ từ địa chỉ kho".', path: ['goship', 'origin'] })
    }
    if (g?.createShipments && !(o?.street && o?.name && o?.phone)) {
      ctx.addIssue({ code: 'custom', message: 'Nhập đủ địa chỉ (số nhà, đường), tên và số điện thoại người gửi trước khi cho phép tạo vận đơn thật.', path: ['goship', 'origin'] })
    }
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
