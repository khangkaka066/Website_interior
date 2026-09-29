import { getDisplayStatus } from '../../../data/adminProducts'

export default function ProductStatusBadge({ product }) {
  const { label, className } = getDisplayStatus(product)
  return <span className={`order-status-badge ${className}`}>{label}</span>
}
