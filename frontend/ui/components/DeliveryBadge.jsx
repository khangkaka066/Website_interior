import '../styles/delivery-type.css'

export const DELIVERY_LABEL = { EXPRESS: 'Hỏa tốc', INTRACITY: 'Nội thành', INTERPROVINCE: 'Liên tỉnh' }

// Nhãn loại đơn: hỏa tốc (đỏ), nội thành (xanh lá), liên tỉnh (xanh dương).
export default function DeliveryBadge({ type }) {
  if (!DELIVERY_LABEL[type]) return null
  return <span className={`dt-badge dt-${type.toLowerCase()}`}>{DELIVERY_LABEL[type]}</span>
}
