'use client'

import { useEffect, useRef } from 'react'
import { Link } from '@/lib/router'
import { useProducts } from '../data/liveProducts'
import PriceOld from './PriceOld'
import { sized, IMG } from '../utils/image'
import '../styles/collection-scroll.css'

const MAX_ITEMS = 8
const formatPrice = (n) => n.toLocaleString('vi-VN') + 'đ'

// Bộ sưu tập nổi bật. Điện thoại / giảm chuyển động: dải ảnh vuốt ngang bình thường (có snap).
// Máy tính: khung được ghim lại, cuộn dọc biến thành trượt ngang qua từng ảnh (GSAP ScrollTrigger, nạp muộn).
export default function CollectionScroll() {
  const products = useProducts().slice(0, MAX_ITEMS)
  const section = useRef(null)
  const track = useRef(null)
  const count = products.length

  useEffect(() => {
    if (count < 4) return undefined
    let mm
    let dead = false
    ;(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (dead || !section.current || !track.current) return
      gsap.registerPlugin(ScrollTrigger)
      mm = gsap.matchMedia()
      mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
        const sec = section.current
        const el = track.current
        sec.setAttribute('data-hscroll', 'on') // CSS chuyển sang kiểu ghim; thuộc tính này React không đụng tới
        const dist = () => Math.max(0, el.scrollWidth - sec.clientWidth)
        const tween = gsap.to(el, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: {
            trigger: sec,
            start: 'top top',
            end: () => `+=${dist()}`,
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
        return () => {
          tween.scrollTrigger?.kill()
          tween.kill()
          gsap.set(el, { clearProps: 'transform' })
          sec.removeAttribute('data-hscroll')
        }
      }, section)
    })()
    return () => {
      dead = true
      mm?.revert()
    }
  }, [count])

  if (count < 4) return null
  return (
    <section className="collection" ref={section} aria-label="Bộ sưu tập nổi bật">
      <div className="collection-head container">
        <span className="collection-eyebrow">BỘ SƯU TẬP</span>
        <h2 className="section-title">Chọn rèm hợp không gian của bạn</h2>
      </div>
      <div className="collection-track" ref={track}>
        {products.map((p) => (
          <Link className="collection-card" key={p.id} to={`/products/${p.id}`}>
            <img src={sized(p.image, IMG.large)} alt={p.name} loading="lazy" decoding="async" draggable="false" />
            <div className="collection-card-body">
              <h3>{p.name}</h3>
              <span className="collection-price">
                {p.priceMax ? 'Từ ' : ''}
                {formatPrice(p.price)}
                <PriceOld product={p} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
