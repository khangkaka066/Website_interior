import { useWishlist } from '../context/WishlistContext'

// Nút trái tim; đặt trong thẻ sản phẩm (là link) nên phải chặn việc bấm lan ra làm chuyển trang.
export default function WishlistButton({ productId, className = '' }) {
  const { has, toggle } = useWishlist()
  const on = has(productId)
  return (
    <button
      type="button"
      className={`wish-btn ${on ? 'wish-on' : ''} ${className}`}
      aria-label={on ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(productId)
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'}>
        <path
          d="M12 20s-7-4.35-9.3-8.8C1.2 8 3 5 6.3 5c2 0 3.4 1.1 4.2 2.4C11.3 6.1 12.7 5 14.7 5 18 5 19.8 8 18.3 11.2 16 15.65 12 20 12 20Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </button>
  )
}
