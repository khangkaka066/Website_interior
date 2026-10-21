import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

// Báo giá vận chuyển (Goship) cho trang thanh toán. status:
//  'idle'    chưa chọn đủ tỉnh/quận/phường (hoặc giỏ trống)
//  'loading' đang hỏi cước
//  'ok'      có lựa chọn của Goship: options = [{ id, carrier, service, expected, fee, originalFee? }] (rẻ trước)
//  'fixed'   không dùng Goship (tắt, địa chỉ chưa khớp, Goship lỗi): dùng phí cố định trong Cài đặt
// Máy chủ tự tính tiền hàng từ giỏ và kiểm tra lại cước lúc đặt hàng, nên số này chỉ để hiển thị.
// Hãng được chọn sẵn khi khách chưa tự chọn: Best Inc (BEST Express). Hãng không báo giá cho địa chỉ này thì lấy lựa chọn rẻ nhất (options đã xếp rẻ trước).
// Nhận hãng theo mã ổn định của Goship (carrierCode = 'best'); báo giá cũ chưa có mã thì mới đoán theo tên. Hãng này có thể có nhiều dòng:
// ưu tiên dòng của tài khoản riêng của shop (hợp đồng riêng với hãng), không có thì dùng dòng của tài khoản Goship; trong cùng loại lấy dòng rẻ nhất.
const DEFAULT_CARRIER_CODE = 'best'
const DEFAULT_CARRIER_NAME = /\bbest\b/i
const isDefaultCarrier = (o) => (o.carrierCode ? o.carrierCode === DEFAULT_CARRIER_CODE : DEFAULT_CARRIER_NAME.test(o.carrier))
export const defaultShippingOption = (options) =>
  options
    .filter(isDefaultCarrier)
    .sort((a, b) => Number(!!b.ownAccount) - Number(!!a.ownAccount) || a.fee - b.fee)[0] || options[0] || null

export function useShippingQuote({ items, paymentMethod, province, district, ward }) {
  const [state, setState] = useState({ status: 'idle', options: [] })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const lines = items.map((it) => ({ productId: it.productId, variant: it.size || undefined, quantity: it.quantity }))
  const key = JSON.stringify([lines, paymentMethod, province, district, ward, nonce])

  useEffect(() => {
    if (!lines.length || !paymentMethod || !province || !district || !ward) {
      setState({ status: 'idle', options: [] })
      return undefined
    }
    let alive = true
    setState((s) => ({ status: 'loading', options: s.options }))
    // Chờ một chút để khách đổi nhanh nhiều ô không bắn nhiều lệnh hỏi cước.
    const timer = setTimeout(() => {
      api
        .post('/orders/shipping-quote', { items: lines, paymentMethod, province, district, ward })
        .then((r) => alive && setState(r.mode === 'goship' && r.options?.length ? { status: 'ok', options: r.options } : { status: 'fixed', options: [] }))
        .catch(() => alive && setState({ status: 'fixed', options: [] }))
    }, 350)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { ...state, refresh }
}
