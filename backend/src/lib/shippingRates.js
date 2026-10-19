import { goshipConfigured, listCities, listDistricts, listWards, requestRates, GoshipError } from './goship.js'
import { findByName } from './vnNames.js'
import { shippingFeeFor } from './settingsStore.js'
import { isExpressService, isSameCity } from './deliveryType.js'
import { geocodeAddress } from './geocode.js'
import { requestOndemandRates } from './goship.js'
import { toExpressOption, buildOndemandRatesBody } from './ondemand.js'

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
function toOption(row, free, expressKeywords) {
  const fee = Number(row.total_fee) + Number(row.cod_fee || 0)
  if (!row.id || !Number.isFinite(fee) || fee < 0) return null
  return {
    id: String(row.id),
    carrier: String(row.carrier_name || ''),
    carrierCode: String(row.carrier_short_name || '').toLowerCase(), // mã hãng ổn định của Goship (best, ghnv3, jnt...), không phụ thuộc cách đặt tên hiển thị
    ownAccount: row.own_account === 1 || row.own_account === true, // dòng cước theo hợp đồng riêng của shop với hãng (khác dòng của tài khoản Goship)
    logo: row.carrier_logo ? String(row.carrier_logo) : null,
    service: String(row.service || ''),
    express: isExpressService(row.service, expressKeywords), // dịch vụ hỏa tốc (theo từ khóa trong Cài đặt)
    expected: row.expected ? String(row.expected) : '',
    fee: free ? 0 : Math.round(fee),
    ...(free ? { originalFee: Math.round(fee) } : {}),
  }
}

// Phương án HỎA TỐC (API hỏa tốc của Goship) cho khách cùng tỉnh/thành với kho. Giá phụ thuộc khoảng cách nên tính theo tọa độ PHƯỜNG/XÃ của khách
// (không theo số nhà) để phí hiển thị ở trang thanh toán và phí chốt đơn luôn cùng một con số. Bất kỳ lỗi nào (chưa bật, thiếu tọa độ, không tra được
// địa chỉ, Goship lỗi) đều chỉ làm mất phương án hỏa tốc, không ảnh hưởng các phương án thường.
async function expressOptions({ settings, address, weightGrams, cod }) {
  const g = settings.shipping.goship
  const o = g.origin
  if (!g.expressEnabled || o?.lat == null || o?.lng == null) return []
  if (!isSameCity(address.province, settings) || !address.ward) return []
  try {
    const to = await geocodeAddress(address, { maxLevel: 'ward' })
    if (!to) return []
    const rows = await requestOndemandRates(buildOndemandRatesBody({ from: { lat: o.lat, lng: o.lng }, to, weightGrams: weightGrams || g.defaultWeightGrams }))
    return rows.map((r) => toExpressOption(r, { cod })).filter(Boolean)
  } catch {
    return []
  }
}

// Cộng thêm một khoản cố định (mặc định 1.000đ, bù phí nền tảng Goship trên mỗi đơn giao thành công) vào cước báo cho khách. Phương án miễn phí (fee 0) giữ 0.
export function applySurcharge(options, surcharge, { free = false } = {}) {
  const s = Math.max(0, Math.round(Number(surcharge) || 0))
  if (!s) return options
  return options.map((o) => ({
    ...o,
    fee: free && o.fee === 0 ? 0 : o.fee + s,
    ...(o.originalFee != null ? { originalFee: o.originalFee + s } : {}),
  }))
}

// cod: số tiền thu hộ (đ), 0 nếu khách chuyển khoản trước. subtotal: tiền hàng, cũng là giá trị khai giá.
export async function quoteShipping({ settings, address, subtotal, cod, weightGrams, withSurcharge = true }) {
  const g = settings.shipping.goship
  if (!g?.enabled || !goshipConfigured()) return { status: 'disabled', options: [] }
  try {
    const from = await resolveAddressIds(g.origin)
    if (!from) return { status: 'error', options: [], reason: 'origin' } // chưa chọn kho gửi hàng hoặc tên không khớp Goship
    const to = await resolveAddressIds(address)
    if (!to) return { status: 'incomplete', options: [] } // chưa chọn đủ tỉnh/quận/phường theo danh sách Goship
    const express = expressOptions({ settings, address, weightGrams, cod })
    const rows = await requestRates({
      address_from: from,
      address_to: to,
      // Kích thước tối thiểu theo ví dụ của Goship; cước tính theo cân nặng cố định trong Cài đặt.
      parcel: { cod: String(Math.max(0, Math.round(cod))), amount: String(Math.max(0, Math.round(subtotal))), weight: String(weightGrams || g.defaultWeightGrams), width: '1', height: '1', length: '1' },
    })
    const free = settings.shipping.freeShippingOver > 0 && subtotal >= settings.shipping.freeShippingOver
    const base = [...rows.map((r) => toOption(r, free, settings.orders?.expressKeywords)).filter(Boolean), ...(await express)]
    const options = (withSurcharge ? applySurcharge(base, g.feeSurcharge, { free }) : base)
      .sort((a, b) => a.fee - b.fee || a.carrier.localeCompare(b.carrier, 'vi'))
      .slice(0, 12)
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
    return { fee: picked.fee, label: `${picked.carrier}${picked.service ? ` – ${picked.service}` : ''} (Goship)`, service: picked.service, carrier: picked.carrier, express: picked.express }
  }
  return { fee: shippingFeeFor(settings, subtotal), label: null, service: null, carrier: null, express: false }
}
