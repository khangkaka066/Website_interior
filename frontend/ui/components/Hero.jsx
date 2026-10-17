'use client'

import { Link } from '@/lib/router'
import { shopInfo } from '../data/shop'
import FilterBar from './FilterBar'
import Words from './Words'
import CountUp from './CountUp'

// Hero căn giữa: dòng tin cậy (số liệu thật của shop), tiêu đề, hai nút, điểm đánh giá, rồi thanh lọc nhanh dẫn sang trang Sản phẩm.
const rating = shopInfo.stats.find((s) => s.label === 'Đánh giá')
const years = shopInfo.stats.find((s) => s.label === 'Hoạt động')

export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="container hero-center">
        <span className="hero-trust">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
            <circle cx="7" cy="18" r="1.6" />
            <circle cx="17" cy="18" r="1.6" />
          </svg>
          {years ? `${years.value} ${years.sub} · ` : ''}Giao hàng toàn quốc
        </span>

        <h1>
          <Words text="Giữ ánh sáng," load />
          <br />
          <span className="hero-accent">
            <Words text="giữ không gian riêng" start={2} load />
          </span>
        </h1>
        <p className="hero-sub">Vải rèm dày dặn, cản sáng &amp; chống tia UV vượt trội, buông rủ mềm mại và lên màu sang trọng dưới mọi ánh đèn.</p>

        <div className="hero-cta">
          <Link className="btn-pill btn-pill-dark" to="/products">
            Mua sắm ngay
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </Link>
          <a className="btn-pill btn-pill-light" href="#deal">
            Xem ưu đãi
          </a>
        </div>

        {rating && (
          <div className="hero-rating">
            <span className="hero-stars" aria-hidden="true">★★★★★</span>
            <strong><CountUp value={rating.value.replace('★', '')} /></strong>
            <small>{rating.sub} trên Shopee</small>
          </div>
        )}

        <FilterBar />
      </div>
    </section>
  )
}
