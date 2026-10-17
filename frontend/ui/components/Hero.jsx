'use client'

import { useEffect, useRef } from 'react'
import { Link } from '@/lib/router'
import HeroVideo from './HeroVideo'
import HeroStack from './HeroStack'

// Máy tính + không bật "giảm chuyển động": hero được ghim lại một quãng cuộn, video thu nhỏ dần từ to về vừa khung, khối chữ và ảnh rèm trôi nhẹ.
// GSAP nạp muộn (không nằm trong JS đầu trang); điện thoại / máy tính bảng / giảm chuyển động thì không chạy gì, hero hiện tĩnh như cũ.
function useHeroScroll(ref) {
  useEffect(() => {
    let mm
    let dead = false
    ;(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (dead || !ref.current) return
      gsap.registerPlugin(ScrollTrigger)
      mm = gsap.matchMedia()
      mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
        const hero = ref.current
        const canPin = hero.offsetHeight <= window.innerHeight // hero cao hơn màn hình thì không ghim, chỉ thu nhỏ khi cuộn qua
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: canPin ? '+=70%' : 'bottom top',
            pin: canPin,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        })
        tl.fromTo('.hero-video', { scale: 1.16 }, { scale: 1 }, 0)
          .fromTo('.hero-text', { y: 0 }, { y: -28 }, 0)
          .fromTo('.hero-visual', { y: 0 }, { y: -48 }, 0)
          .fromTo('.hero-glow', { y: 0 }, { y: 60 }, 0)
        return () => tl.scrollTrigger?.kill()
      }, ref)
    })()
    return () => {
      dead = true
      mm?.revert()
    }
  }, [ref])
}

export default function Hero() {
  const ref = useRef(null)
  useHeroScroll(ref)
  return (
    <section className="hero" id="home" ref={ref}>
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
