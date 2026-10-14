import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './prisma.js'
import { payosConfigured, PAYOS_PUBLIC_METHOD } from './payos.js'

// Cài đặt cửa hàng (thông tin shop, phương thức thanh toán, phí vận chuyển).
// Lưu trong bảng Setting (một dòng key = "shop") để không mất khi deploy lên nơi có ổ đĩa tạm như Render. Mọi nơi chỉ gọi getSettings/saveSettings.
// File backend/storage/settings.json (cách lưu cũ) chỉ còn được đọc MỘT LẦN để chuyển cài đặt hiện có vào database.
const KEY = 'shop'
const LEGACY_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../storage/settings.json')

export const BANK_METHOD_ID = 'Chuyển khoản'
export const COD_METHOD_ID = 'COD'

export const DEFAULTS = {
  store: {
    name: 'CLEVINUM',
    tagline: 'Rèm Việt Giá Sỉ',
    hotline: '0356 789 749',
    email: 'clevi.interior@gmail.com',
    address: 'Phường Hiệp Bình, TP. Hồ Chí Minh',
  },
  payment: {
    methods: [
      {
        id: COD_METHOD_ID,
        label: 'Thanh toán khi nhận hàng (COD)',
        description: 'Thanh toán tiền mặt cho nhân viên giao hàng.',
        enabled: true,
      },
      {
        id: BANK_METHOD_ID,
        label: 'Chuyển khoản ngân hàng',
        description: 'Chuyển khoản trước, shop xác nhận rồi giao hàng.',
        enabled: true,
        bank: { bankName: '', bankCode: '', accountNumber: '', accountHolder: '', transferNote: 'CLEVINUM {order}' },
      },
    ],
  },
  // goship: tính cước thật theo Goship ở trang thanh toán (mặc định tắt cho tới khi chọn kho gửi hàng và bật).
  // defaultWeightGrams: cân nặng cố định cho cả đơn khi hỏi cước, bất kể số lượng.
  // fee: phí cố định chỉ dùng khi không tính được cước Goship (mặc định 0: không thu phí cố định).
  shipping: {
    fee: 0,
    freeShippingOver: 0,
    goship: {
      enabled: false,
      // createShipments: cho phép admin tạo vận đơn THẬT qua Goship (phát sinh cước). Mặc định tắt.
      createShipments: false,
      defaultWeightGrams: 4000,
      // origin: kho gửi hàng. province/district/ward dùng để tính cước; street/name/phone là thông tin người gửi trên vận đơn.
      origin: { province: '', district: '', ward: '', street: '', name: '', phone: '' },
    },
  },
  // Quy tắc vòng đời đơn hàng (kiểu Shopee). Số 0 = tắt quy tắc đó.
  // unpaidCancelHours: tự hủy đơn chuyển khoản/PayOS chưa thanh toán sau chừng này giờ và trả lại tồn kho.
  // handleHours: hạn nhân viên xử lý đơn kể từ lúc đặt (chỉ hiển thị đếm ngược, không tự hủy).
  // autoReceiveDays: tự xác nhận "đã nhận hàng" sau chừng này ngày kể từ khi đơn Đã giao.
  // returnWindowDays: khách được gửi yêu cầu trả hàng trong chừng này ngày kể từ khi Đã giao.
  // handleHours (liên tỉnh) / intracityHandleHours / expressHandleHours: hạn xử lý theo loại đơn. cancelAutoApproveHours: tự đồng ý yêu cầu hủy của khách
  // nếu nhân viên không phản hồi sau chừng này giờ (như Shopee). expressKeywords: tên dịch vụ chứa từ khóa nào thì là đơn hỏa tốc (cách nhau bằng dấu phẩy).
  orders: {
    unpaidCancelHours: 24,
    handleHours: 48,
    intracityHandleHours: 24,
    expressHandleHours: 6,
    cancelAutoApproveHours: 24,
    autoReceiveDays: 7,
    returnWindowDays: 7,
    expressKeywords: 'hỏa tốc, hoả tốc, instant, trong ngày, siêu tốc, same day',
  },
  // Giảm giá theo SKU (Dashboard > Giảm giá): [{ sku, percent }]. SKU của sản phẩm thì giảm mọi phân loại, SKU của phân loại thì chỉ giảm phân loại đó.
  discounts: { rules: [] },
  // Nội dung các trang Về chúng tôi / Liên hệ / FAQ (sửa ở Cài đặt > Nội dung trang).
  content: {
    about: {
      heading: 'Về CLEVINUM',
      intro: 'Rèm cửa chất lượng cao, giá xưởng, giao hàng toàn quốc.',
      story:
        'CLEVINUM bắt đầu từ một xưởng may rèm nhỏ với mong muốn mang đến cho mỗi gia đình những tấm rèm đẹp, bền và giá hợp lý.\n\nChúng tôi tự chọn vải, tự may và kiểm tra từng tấm trước khi giao, nên giá luôn sát giá xưởng.',
      highlights: [
        { title: 'Giá xưởng', text: 'Làm trực tiếp tại xưởng, không qua trung gian.' },
        { title: 'May theo kích thước', text: 'Rèm may đo theo đúng cửa sổ, cửa chính nhà bạn.' },
        { title: 'Đổi trả dễ dàng', text: 'Hỗ trợ đổi trả khi sản phẩm lỗi do nhà sản xuất.' },
      ],
    },
    contact: {
      intro: 'Cần tư vấn chọn rèm hay đo kích thước? Liên hệ CLEVINUM, chúng tôi phản hồi trong giờ làm việc.',
      hours: '8:00 – 21:00 hằng ngày',
      shopeeUrl: 'https://shopee.vn/clevi.interior',
      zaloUrl: '',
      facebookUrl: '',
      showMap: true,
    },
    faq: [
      { q: 'Rèm có may theo kích thước riêng không?', a: 'Có. Bạn chọn kích thước rộng x cao khi đặt hàng, xưởng sẽ may đúng theo số đo.' },
      { q: 'Thời gian giao hàng bao lâu?', a: 'Rèm có sẵn giao trong 2–5 ngày. Rèm may đo cần thêm 2–3 ngày may.' },
      { q: 'Tôi có thể đổi trả không?', a: 'Hỗ trợ đổi trả nếu sản phẩm lỗi do nhà sản xuất. Vui lòng liên hệ hotline kèm ảnh sản phẩm.' },
    ],
  },
}

function merge(saved) {
  const s = saved || {}
  const methods = DEFAULTS.payment.methods.map((def) => {
    const got = (s.payment?.methods || []).find((m) => m.id === def.id) || {}
    return { ...def, ...got, id: def.id, ...(def.bank ? { bank: { ...def.bank, ...(got.bank || {}) } } : {}) }
  })
  return {
    store: { ...DEFAULTS.store, ...(s.store || {}) },
    payment: { methods },
    shipping: {
      ...DEFAULTS.shipping,
      ...(s.shipping || {}),
      goship: {
        ...DEFAULTS.shipping.goship,
        ...(s.shipping?.goship || {}),
        origin: { ...DEFAULTS.shipping.goship.origin, ...(s.shipping?.goship?.origin || {}) },
      },
    },
    orders: { ...DEFAULTS.orders, ...(s.orders || {}) },
    discounts: { rules: Array.isArray(s.discounts?.rules) ? s.discounts.rules : [] },
    content: {
      about: { ...DEFAULTS.content.about, ...(s.content?.about || {}) },
      contact: { ...DEFAULTS.content.contact, ...(s.content?.contact || {}) },
      faq: Array.isArray(s.content?.faq) ? s.content.faq : DEFAULTS.content.faq,
    },
  }
}

async function readLegacyFile() {
  try {
    return JSON.parse(await fs.readFile(LEGACY_FILE, 'utf8'))
  } catch {
    return null
  }
}

export async function getSettings() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } })
    return merge(row ? row.value : await readLegacyFile()) // chưa có dòng nào: lấy file cũ (nếu có), không thì mặc định
  } catch (err) {
    console.warn('Không đọc được cài đặt từ database (đã chạy migration chưa?), dùng mặc định:', err.message)
    return merge(null)
  }
}

export async function saveSettings(patch) {
  const next = merge({ ...(await getSettings()), ...patch })
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: next }, create: { key: KEY, value: next } })
  return next
}

// Phần công khai cho trang thanh toán của khách (không lộ cấu hình nội bộ).
export async function getPublicPaymentOptions() {
  const s = await getSettings()
  return {
    methods: [
      ...s.payment.methods
        .filter((m) => m.enabled)
        .map(({ id, label, description, bank }) => ({ id, label, description, ...(bank ? { bank } : {}) })),
      ...(payosConfigured() ? [PAYOS_PUBLIC_METHOD] : []), // PayOS bật/tắt bằng biến môi trường, không nằm trong Cài đặt
    ],
    shipping: { fee: s.shipping.fee, freeShippingOver: s.shipping.freeShippingOver },
  }
}

export function shippingFeeFor(settings, subtotal) {
  const { fee, freeShippingOver } = settings.shipping
  return freeShippingOver > 0 && subtotal >= freeShippingOver ? 0 : fee
}

// Phần công khai cho các trang Về chúng tôi / Liên hệ / FAQ (không có thông tin nội bộ).
export async function getPublicContent() {
  const { store, content } = await getSettings()
  return { store, content }
}
