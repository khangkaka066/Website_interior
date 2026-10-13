import { goshipConfigured, listCities, listDistricts, listWards, requestRates, GoshipError } from './goship.js'
import { findByName } from './vnNames.js'
import { shippingFeeFor } from './settingsStore.js'

// Cước vận chuyển theo Goship cho trang thanh toán. Cân nặng cố định theo Cài đặt (mặc định 4000g cho cả đơn, bất kể số lượng).
// Chỉ báo giá, không tạo vận đơn. Mọi trường hợp không tính được (tắt, thiếu địa chỉ, Goship lỗi) đều trả status khác 'ok'
// để nơi gọi dùng phí cố định trong Cài đặt.

// Đổi { province, district, ward } (tên) sang mã Goship; thiếu một cấp hoặc không khớp thì trả null.
export async function resolveAddressIds({ province, district, ward }) {
  const city = findByName(await listCities(), province)
  if (!city) return null
  const dist = findByName(await listDistricts(city.id), district)
  if (!dist) return null
  const w = findByName(await listWards(dist.id), ward)
  if (!w) return null
  return { city: city.id, district: dist.id, ward: w.id }
}

// Một dòng cước của Goship -> lựa chọn cho khách. Khách trả total_fee + cod_fee (cước ship + phí thu hộ nếu hãng tính riêng).
// KHÔNG dùng total_amount: với đơn COD, Goship cộng cả số tiền thu hộ vào đó (đã thử thật: cước 22.000đ nhưng total_amount 435.565đ).
function toOption(row, free) {
  const fee = Number(row.total_fee) + Number(row.cod_fee || 0)
  if (!row.id || !Number.isFinite(fee) || fee < 0) return null
  return {
    id: String(row.id),
    carrier: String(row.carrier_name || ''),
    logo: row.carrier_logo ? String(row.carrier_logo) : null,
    service: String(row.service || ''),
    expected: row.expected ? String(row.expected) : '',
    fee: free ? 0 : Math.round(fee),
    ...(free ? { originalFee: Math.round(fee) } : {}),
  }
}

// cod: số tiền thu hộ (đ), 0 nếu khách chuyển khoản trước. subtotal: tiền hàng, cũng là giá trị khai giá.
export async function quoteShipping({ settings, address, subtotal, cod }) {
  const g = settings.shipping.goship
  if (!g?.enabled || !goshipConfigured()) return { status: 'disabled', options: [] }
  try {
    const from = await resolveAddressIds(g.origin)
    if (!from) return { status: 'error', options: [], reason: 'origin' } // chưa chọn kho gửi hàng hoặc tên không khớp Goship
    const to = await resolveAddressIds(address)
    if (!to) return { status: 'incomplete', options: [] } // chưa chọn đủ tỉnh/quận/phường theo danh sách Goship
    const rows = await requestRates({
      address_from: from,
      address_to: to,
      // Kích thước tối thiểu theo ví dụ của Goship; cước tính theo cân nặng cố định trong Cài đặt.
      parcel: { cod: String(Math.max(0, Math.round(cod))), amount: String(Math.max(0, Math.round(subtotal))), weight: String(g.defaultWeightGrams), width: '1', height: '1', length: '1' },
    })
    const free = settings.shipping.freeShippingOver > 0 && subtotal >= settings.shipping.freeShippingOver
    const options = rows.map((r) => toOption(r, free)).filter(Boolean).sort((a, b) => a.fee - b.fee || a.carrier.localeCompare(b.carrier, 'vi')).slice(0, 12)
    return options.length ? { status: 'ok', options } : { status: 'error', options: [], reason: 'empty' }
  } catch (err) {
    if (!(err instanceof GoshipError)) throw err
    return { status: 'error', options: [], reason: 'upstream' }
  }
}

// Phí vận chuyển của đơn. Khi báo giá Goship chạy được thì BẮT BUỘC chọn đúng một lựa chọn còn hiệu lực (khách không tự đặt giá được);
// báo giá không chạy được (tắt, địa chỉ chưa khớp, Goship lỗi) thì dùng phí cố định.
export function chooseShipping(settings, subtotal, quote, rateId) {
  if (quote.status === 'ok') {
    const picked = rateId ? quote.options.find((o) => o.id === rateId) : null
    if (!picked) return { error: 'SHIPPING_CHANGED' }
    return { fee: picked.fee, label: `${picked.carrier}${picked.service ? ` – ${picked.service}` : ''} (Goship)` }
  }
  return { fee: shippingFeeFor(settings, subtotal), label: null }
}
