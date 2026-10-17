import '../styles/reviews.css'

// Dải sao trung bình gọn (★ 4.8 (12)); chưa có đánh giá thì không hiện gì.
export default function RatingStars({ rating }) {
  if (!rating?.count) return null
  return (
    <span className="rating-mini" aria-label={`${rating.average} trên 5 sao, ${rating.count} đánh giá`}>
      <span className="rating-mini-star" aria-hidden="true">★</span> {rating.average.toFixed(1)} <small>({rating.count})</small>
    </span>
  )
}
