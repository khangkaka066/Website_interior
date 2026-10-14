// Phân loại đơn theo cách giao (kiểu Shopee): hỏa tốc / nội thành / liên tỉnh. Mỗi loại có hạn xử lý riêng (Cài đặt > Quy tắc đơn hàng).
//  - HỎA TỐC: phương án vận chuyển khách chọn có tên dịch vụ chứa một từ khóa hỏa tốc (Cài đặt, mặc định "hỏa tốc, instant, trong ngày..."). Tên dịch vụ do Goship/hãng đặt nên từ khóa chỉnh được.
//  - NỘI THÀNH: nhận hàng cùng tỉnh/thành với kho gửi (Cài đặt > Vận chuyển > kho gửi; chưa chọn kho thì so với địa chỉ cửa hàng).
//  - LIÊN TỈNH: còn lại.
export const DELIVERY_TYPES = ['EXPRESS', 'INTRACITY', 'INTERPROVINCE']
export const DELIVERY_LABEL = { EXPRESS: 'Hỏa tốc', INTRACITY: 'Nội thành', INTERPROVINCE: 'Liên tỉnh' }

// Bỏ dấu, hạ chữ thường, bỏ tiền tố hành chính để "TP. Hồ Chí Minh", "Thành phố Hồ Chí Minh", "ho chi minh" so khớp nhau.
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()

const provinceKey = (s) => fold(s).replace(/^(thanh pho|tinh|tp\.?)\s+/, '').replace(/\s+/g, ' ')

const keywordList = (csv) =>
  String(csv ?? '')
    .split(',')
    .map((k) => fold(k))
    .filter(Boolean)

export const isExpressService = (service, expressKeywords) => {
  const s = fold(service)
  return !!s && keywordList(expressKeywords).some((k) => s.includes(k))
}

// Tỉnh/thành của kho gửi: ưu tiên kho đã chọn ở cài đặt Goship, không có thì lấy địa chỉ cửa hàng.
export function isSameCity(province, settings) {
  const p = provinceKey(province)
  if (!p) return false
  const origin = provinceKey(settings.shipping?.goship?.origin?.province)
  if (origin) return origin === p
  return fold(settings.store?.address).includes(p)
}

export function classifyDelivery({ province, service }, settings) {
  if (isExpressService(service, settings.orders?.expressKeywords)) return 'EXPRESS'
  return isSameCity(province, settings) ? 'INTRACITY' : 'INTERPROVINCE'
}

// Loại của một đơn: dùng giá trị đã lưu lúc đặt hàng; đơn cũ chưa có thì suy ra từ địa chỉ (không biết được hỏa tốc).
export const deliveryTypeOf = (order, settings) => order.deliveryType || classifyDelivery({ province: order.province, service: order.shippingService }, settings)
