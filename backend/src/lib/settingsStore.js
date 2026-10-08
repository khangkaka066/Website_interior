import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { payosConfigured, PAYOS_PUBLIC_METHOD } from './payos.js'

// Cài đặt cửa hàng (thông tin shop, phương thức thanh toán, phí vận chuyển).
// Hiện lưu ra file backend/storage/settings.json (không đụng database). Mọi nơi chỉ gọi getSettings/saveSettings
// nên sau này chuyển sang bảng trong database chỉ cần sửa file này.
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../storage/settings.json')

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
  shipping: { fee: 25000, freeShippingOver: 0 },
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
    shipping: { ...DEFAULTS.shipping, ...(s.shipping || {}) },
    content: {
      about: { ...DEFAULTS.content.about, ...(s.content?.about || {}) },
      contact: { ...DEFAULTS.content.contact, ...(s.content?.contact || {}) },
      faq: Array.isArray(s.content?.faq) ? s.content.faq : DEFAULTS.content.faq,
    },
  }
}

export async function getSettings() {
  try {
    return merge(JSON.parse(await fs.readFile(FILE, 'utf8')))
  } catch {
    return merge(null) // chưa có file hoặc file lỗi: dùng mặc định
  }
}

export async function saveSettings(patch) {
  const next = merge({ ...(await getSettings()), ...patch })
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  const tmp = `${FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(next, null, 2))
  await fs.rename(tmp, FILE) // ghi nguyên khối, không để lại file nửa chừng
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
