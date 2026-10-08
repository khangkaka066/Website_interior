import { z } from 'zod'
import { text, optionalText, phone, email } from './common.js'

// Kiểm tra dữ liệu cho các route quản trị và route công khai còn lại. Field lạ bị bỏ (zod mặc định),
// kiểu dữ liệu và độ dài được chặn ở đây thay vì để Prisma báo lỗi 500 hoặc ghi nhầm field.

const cuid = (label) => text(label, 60)
const num = (label, { min = 0, max = 1e10, int = false } = {}) => {
  let n = z.coerce.number(`${label} không hợp lệ.`).finite(`${label} không hợp lệ.`).min(min, `${label} không hợp lệ.`).max(max, `${label} quá lớn.`)
  if (int) n = n.int(`${label} phải là số nguyên.`)
  return n
}
const date = (label) => z.string(`${label} không hợp lệ.`).refine((v) => !Number.isNaN(Date.parse(v)), `${label} không hợp lệ.`)
const nullableDate = (label) =>
  z.union([date(label), z.literal('').transform(() => null), z.null()]).optional()
// Đường dẫn ảnh: chỉ http(s) hoặc đường dẫn tương đối, không nhận javascript:, data: ...
const url = (label) =>
  z
    .string(`${label} không hợp lệ.`)
    .trim()
    .max(500, `${label} quá dài.`)
    .refine((v) => v === '' || /^(https?:\/\/|\/)[^\s]*$/i.test(v), `${label} không hợp lệ.`)
    .optional()
    .transform((v) => v || undefined)

const CAMPAIGN_STATUS = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'], 'Trạng thái không hợp lệ.')
const noteField = optionalText('ghi chú', 1000)

// --- Analytics (công khai) ---------------------------------------------------
export const analyticsEventSchema = z.object({
  sessionId: text('sessionId', 100),
  type: z.enum(['PAGE_VIEW', 'ADD_TO_CART', 'CHECKOUT_START', 'PURCHASE'], 'Loại sự kiện không hợp lệ.'),
  path: optionalText('path', 300),
  productId: optionalText('productId', 100),
  orderId: optionalText('orderId', 100),
  utmSource: optionalText('utmSource', 100),
  utmMedium: optionalText('utmMedium', 100),
  utmCampaign: optionalText('utmCampaign', 100),
})

// --- Chiến dịch quảng cáo -----------------------------------------------------
export const createCampaignSchema = z.object({
  name: text('tên chiến dịch', 150),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK'], 'Nền tảng không hợp lệ.'),
  objective: text('mục tiêu', 100),
  budgetTotal: num('ngân sách', { min: 1 }),
  budgetDaily: num('ngân sách ngày').optional().or(z.literal('').transform(() => undefined)),
  startDate: date('ngày bắt đầu'),
  endDate: nullableDate('ngày kết thúc'),
  utmCode: text('mã UTM', 60).regex(/^[A-Za-z0-9_-]+$/, 'Mã UTM chỉ gồm chữ, số, gạch ngang và gạch dưới.'),
})

export const updateCampaignSchema = z.object({
  name: optionalText('tên chiến dịch', 150),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK'], 'Nền tảng không hợp lệ.').optional(),
  objective: optionalText('mục tiêu', 100),
  status: CAMPAIGN_STATUS.optional(),
  budgetTotal: num('ngân sách', { min: 1 }).optional(),
  budgetDaily: num('ngân sách ngày').optional(),
  spentAmount: num('số đã chi').optional(),
  startDate: date('ngày bắt đầu').optional(),
  endDate: nullableDate('ngày kết thúc'),
})

const adSetFields = {
  audienceAgeMin: num('tuổi tối thiểu', { min: 13, max: 100, int: true }).optional().or(z.literal('').transform(() => undefined)),
  audienceAgeMax: num('tuổi tối đa', { min: 13, max: 100, int: true }).optional().or(z.literal('').transform(() => undefined)),
  audienceGender: optionalText('giới tính', 20),
  audienceLocation: optionalText('khu vực', 200),
  interests: z.array(text('sở thích', 50)).max(30, 'Quá nhiều sở thích.').optional(),
}
export const createAdSetSchema = z.object({ name: text('tên Ad Set', 150), budget: num('ngân sách', { min: 1 }), ...adSetFields })
export const updateAdSetSchema = z.object({
  name: optionalText('tên Ad Set', 150),
  budget: num('ngân sách', { min: 1 }).optional(),
  status: CAMPAIGN_STATUS.optional(),
  ...adSetFields,
})

const adFields = {
  creativeType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL'], 'Loại quảng cáo không hợp lệ.').optional(),
  bodyCopy: optionalText('nội dung', 2000),
  ctaLabel: optionalText('nút kêu gọi', 60),
  imageUrl: url('ảnh'),
}
export const createAdSchema = z.object({ name: text('tên quảng cáo', 150), headline: text('tiêu đề', 200), ...adFields })
export const updateAdSchema = z.object({
  name: optionalText('tên quảng cáo', 150),
  headline: optionalText('tiêu đề', 200),
  status: CAMPAIGN_STATUS.optional(),
  ...adFields,
})

// --- Khách hàng ---------------------------------------------------------------
const addressFields = {
  recipientName: text('tên người nhận', 100),
  phone: phone(),
  addressLine: text('địa chỉ', 300),
  ward: optionalText('phường/xã', 100),
  district: optionalText('quận/huyện', 100),
  province: text('tỉnh/thành phố', 100),
}
const customerEmail = email.optional().or(z.literal('').transform(() => undefined))

export const createCustomerSchema = z.object({
  name: text('họ tên', 100),
  phone: phone(),
  email: customerEmail,
  dob: z.union([date('ngày sinh'), z.literal('')]).optional().transform((v) => v || undefined),
  gender: optionalText('giới tính', 20),
  avatarUrl: url('ảnh đại diện'),
  tags: z.array(text('nhãn', 50)).max(20, 'Quá nhiều nhãn.').optional(),
  address: z.object(addressFields).optional(),
})

export const updateCustomerSchema = z.object({
  name: optionalText('họ tên', 100),
  phone: phone().optional(),
  email: z.union([email, z.literal('').transform(() => null)]).optional(),
  dob: z.union([date('ngày sinh'), z.literal('').transform(() => null), z.null()]).optional(),
  gender: optionalText('giới tính', 20),
  avatarUrl: url('ảnh đại diện'),
  tags: z.array(text('nhãn', 50)).max(20, 'Quá nhiều nhãn.').optional(),
})

export const customerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED'], 'Trạng thái không hợp lệ.'),
})
export const addAddressSchema = z.object({ ...addressFields, isDefault: z.boolean().optional() })
export const addNoteSchema = z.object({ content: text('nội dung ghi chú', 2000) })

// --- Vận chuyển ---------------------------------------------------------------
export const createShipmentSchema = z.object({
  orderId: cuid('đơn hàng'),
  carrierId: cuid('đơn vị vận chuyển'),
  senderName: text('người gửi', 100),
  weightGrams: num('khối lượng', { min: 1, max: 1e6, int: true }),
  lengthCm: num('chiều dài', { max: 1000, int: true }).optional().or(z.literal('').transform(() => undefined)),
  widthCm: num('chiều rộng', { max: 1000, int: true }).optional().or(z.literal('').transform(() => undefined)),
  heightCm: num('chiều cao', { max: 1000, int: true }).optional().or(z.literal('').transform(() => undefined)),
  goodsType: optionalText('loại hàng', 100),
  shippingFee: num('phí vận chuyển', { min: 0 }),
  codAmount: num('tiền thu hộ').optional().default(0),
  note: noteField,
})

export const shipmentStatusSchema = z.object({
  status: z.enum(
    ['AWAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNING', 'RETURNED'],
    'Trạng thái không hợp lệ.',
  ),
  location: optionalText('vị trí', 200),
  note: noteField,
})
export const noteOnlySchema = z.object({ note: noteField })

// --- Đơn hàng -------------------------------------------------------------------
export const orderStatusSchema = z.object({
  status: z.enum(
    ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED'],
    'Trạng thái không hợp lệ.',
  ),
  note: noteField,
})

// --- Tài khoản / phân quyền ------------------------------------------------------
export const userRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'ADMIN'], 'Vai trò không hợp lệ.'),
  adminRole: z.enum(['MAIN_ADMIN', 'SUPPORT_ADMIN']).nullish(),
})
export const permissionSchema = z.object({ enabledForSupport: z.boolean('Giá trị không hợp lệ.') })

// --- Đơn vị vận chuyển -----------------------------------------------------------
const apiConfig = z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional()
export const createCarrierSchema = z.object({
  code: text('mã', 20).regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch ngang và gạch dưới.'),
  name: text('tên', 100),
  serviceTypes: z.array(text('dịch vụ', 60)).max(20, 'Quá nhiều dịch vụ.').optional(),
  apiConfig,
})
export const updateCarrierSchema = z.object({
  name: optionalText('tên', 100),
  enabled: z.boolean('Giá trị không hợp lệ.').optional(),
  apiStatus: optionalText('trạng thái kết nối', 30),
  serviceTypes: z.array(text('dịch vụ', 60)).max(20, 'Quá nhiều dịch vụ.').optional(),
  apiConfig,
})

// --- Bài viết (Tin tức) -------------------------------------------------------------------
export const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

const postFields = {
  title: text('tiêu đề', 200),
  slug: z
    .string()
    .trim()
    .max(80, 'Đường dẫn quá dài.')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$|^$/, 'Đường dẫn chỉ gồm chữ thường không dấu, số và gạch ngang.')
    .optional()
    .transform((v) => v || undefined),
  excerpt: z.string().trim().max(400, 'Mô tả ngắn quá dài (tối đa 400 ký tự).').optional().default(''),
  content: z.string().max(60000, 'Nội dung quá dài.').optional().default(''),
  coverUrl: url('ảnh bìa'),
  status: z.enum(['draft', 'published'], 'Trạng thái không hợp lệ.').optional().default('draft'),
}
export const createPostSchema = z.object(postFields)
export const updatePostSchema = z.object({
  title: postFields.title.optional(),
  slug: postFields.slug,
  excerpt: z.string().trim().max(400, 'Mô tả ngắn quá dài (tối đa 400 ký tự).').optional(),
  content: z.string().max(60000, 'Nội dung quá dài.').optional(),
  // Chuỗi rỗng/null = xóa ảnh bìa (phải xét trước `url()` vì url() biến chuỗi rỗng thành undefined, tức là "không đổi").
  coverUrl: z.union([z.literal('').transform(() => null), z.null(), url('ảnh bìa')]).optional(),
  status: z.enum(['draft', 'published'], 'Trạng thái không hợp lệ.').optional(),
})
