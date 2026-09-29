import { useState } from 'react'
import { testimonials } from '../data/shop'

export default function Testimonials() {
  const [active, setActive] = useState(0)

  return (
    <section className="container testimonials">
      <span className="eyebrow center">KHÁCH HÀNG NÓI GÌ</span>
      <h2 className="section-title">Khách hàng yêu thích</h2>
      <p className="placeholder-note">
        * Nội dung minh họa — thay bằng đánh giá thật từ Shopee khi có.
      </p>

      <div className="testimonial-cards">
        {testimonials.map((t) => (
          <div className="testimonial-card" key={t.id}>
            <span className="quote-mark">&ldquo;</span>
            <p>{t.quote}</p>
            <strong>{t.name}</strong>
            <span className="text-muted">{t.role}</span>
          </div>
        ))}
      </div>

      <div className="dots">
        {testimonials.map((t, i) => (
          <button
            key={t.id}
            className={`dot ${active === i ? 'dot-active' : ''}`}
            onClick={() => setActive(i)}
            aria-label={`testimonial-${i}`}
          />
        ))}
      </div>
    </section>
  )
}
