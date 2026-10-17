import '../styles/reviews.css'

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)
const day = (d) => new Date(d).toLocaleDateString('vi-VN')

// Đánh giá của khách đã nhận hàng (chỉ khách có đơn Đã giao mới đánh giá được). Chạy trên máy chủ nên Google đọc được nội dung.
export default function ProductReviews({ reviews }) {
  if (!reviews || reviews.count === 0) return null
  const max = Math.max(...Object.values(reviews.distribution), 1)
  return (
    <section className="container pr" id="danh-gia" aria-labelledby="pr-title">
      <h2 id="pr-title">Đánh giá sản phẩm</h2>
      <div className="pr-summary">
        <div className="pr-score">
          <strong>{reviews.average.toFixed(1)}</strong>
          <span className="pr-stars" aria-label={`${reviews.average} trên 5 sao`}>{stars(Math.round(reviews.average))}</span>
          <small>{reviews.count} đánh giá</small>
        </div>
        <ul className="pr-bars">
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n}>
              <span>{n} ★</span>
              <i><b style={{ width: `${(reviews.distribution[n] / max) * 100}%` }} /></i>
              <span>{reviews.distribution[n]}</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="pr-list">
        {reviews.items.map((r) => (
          <li key={r.id}>
            <div className="pr-head">
              <strong>{r.authorName}</strong>
              <span className="pr-stars">{stars(r.rating)}</span>
              <small>{day(r.createdAt)}{r.variant ? ` · Phân loại: ${r.variant}` : ''}</small>
            </div>
            {r.comment && <p>{r.comment}</p>}
            {r.reply && (
              <div className="pr-reply">
                <strong>Phản hồi từ Clevinum</strong>
                <p>{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
