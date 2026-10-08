import { z } from 'zod'
import { text, optionalText, phone, email } from './common.js'

// Chỉ nhận productId, variant và quantity cho từng dòng hàng. Giá do server tra, mọi field giá
// do client gửi (unitPrice, discount, shippingFee, tax...) bị bỏ ngay ở đây.
const lineItem = z.object({
  productId: text('mã sản phẩm', 100),
  variant: optionalText('phân loại', 300),
  quantity: z
    .number('Số lượng không hợp lệ.')
    .int('Số lượng không hợp lệ.')
    .min(1, 'Số lượng không hợp lệ.')
    .max(999, 'Số lượng không hợp lệ.'),
})

export const createOrderSchema = z.object({
  customer: z.object(
    {
      name: text('họ tên', 100),
      phone: phone(),
      email: email.optional().or(z.literal('').transform(() => undefined)),
    },
    'Thiếu thông tin khách hàng.',
  ),
  items: z
    .array(lineItem, 'Đơn hàng cần ít nhất một sản phẩm.')
    .min(1, 'Đơn hàng cần ít nhất một sản phẩm.')
    .max(100, 'Đơn hàng có quá nhiều sản phẩm.'),
  paymentMethod: text('phương thức thanh toán', 50),
  recipientName: text('tên người nhận', 100),
  recipientPhone: phone('số điện thoại người nhận'),
  addressLine: text('địa chỉ', 300),
  ward: optionalText('phường/xã', 100),
  district: optionalText('quận/huyện', 100),
  province: text('tỉnh/thành phố', 100),
  utmSource: optionalText('utmSource', 100),
  utmMedium: optionalText('utmMedium', 100),
  utmCampaign: optionalText('utmCampaign', 100),
})

export const payosRelinkSchema = z.object({
  orderNumber: text('mã đơn hàng', 30),
  phone: phone(),
})
