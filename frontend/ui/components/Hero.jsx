'use client'

import { Link } from '@/lib/router'
import HeroVideo from './HeroVideo'
import HeroStack from './HeroStack'

export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-glow glow-1" />
      <div className="hero-glow glow-2" />

      <div className="container hero-inner">
        {/* Khối chữ + ảnh rèm (cột trái trên máy tính); video ở cột phải, cùng hàng. */}
        <div className="hero-main">
          <div className="hero-text">
            <span className="hero-eyebrow">CHẤT LIỆU CAO CẤP · CURTAIN PREMIUM</span>
            <h1>
              Ánh sáng đẹp,
              <br />
              <span className="hero-accent">rèm chuẩn form.</span>
            </h1>
            <p>
              Vải rèm dày dặn, cản sáng &amp; chống tia UV vượt trội — buông rủ mềm mại,
              lên màu sang trọng dưới mọi ánh đèn.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-hero" to="/products">
                MUA NGAY
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-glow" />
            <HeroStack />
          </div>
        </div>

        <HeroVideo />
      </div>
    </section>
  )
}
