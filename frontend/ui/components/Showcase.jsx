'use client'

import { useEffect, useRef } from 'react'
import HeroVideo from './HeroVideo'
import HeroStack from './HeroStack'

// Máy tính + không bật "giảm chuyển động": khối được ghim lại một quãng cuộn, video thu nhỏ dần từ to về vừa khung, ảnh rèm trôi nhẹ.
// GSAP nạp muộn (không nằm trong JS đầu trang); điện thoại / máy tính bảng / giảm chuyển động thì hiện tĩnh.
function useShowcaseScroll(ref) {
  useEffect(() => {
    let mm
    let dead = false
    ;(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (dead || !ref.current) return
      gsap.registerPlugin(ScrollTrigger)
      mm = gsap.matchMedia()
      mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
        const box = ref.current
        const canPin = box.offsetHeight <= window.innerHeight // cao hơn màn hình thì không ghim, chỉ thu nhỏ khi cuộn qua
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: box, start: canPin ? 'center center' : 'top 80%', end: canPin ? '+=60%' : 'bottom top', pin: canPin, scrub: 0.6, invalidateOnRefresh: true },
        })
        tl.fromTo('.hero-video', { scale: 1.14 }, { scale: 1 }, 0).fromTo('.hero-visual', { y: 24 }, { y: -32 }, 0)
        return () => tl.scrollTrigger?.kill()
      }, ref)
    })()
    return () => {
      dead = true
      mm?.revert()
    }
  }, [ref])
}

export default function Showcase() {
  const ref = useRef(null)
  useShowcaseScroll(ref)
  return (
    <section className="showcase" ref={ref} aria-labelledby="showcase-title">
      <div className="container showcase-head">
        <h2 className="section-title" id="showcase-title">Chất vải thật, màu thật</h2>
        <p>Ba mẫu rèm xếp chồng và video cận cảnh bề mặt vải.</p>
      </div>
      <div className="container hero-inner showcase-inner">
        <div className="hero-main">
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
