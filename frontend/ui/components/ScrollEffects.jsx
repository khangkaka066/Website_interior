'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import '../styles/scroll-effects.css'

// Hiệu ứng cuộn trang cho khu khách hàng:
//  - Mọi trang: thanh tiến trình cuộn (B3), header dính đầu trang và gọn lại khi cuộn xuống (C1), nút "Lên đầu trang" (C2).
//  - Chỉ trang chủ: các khối hiện dần từ dưới lên, thẻ trong lưới hiện lần lượt (A1, A2), ba ô danh mục "mở ra như kéo rèm" (A3).
// An toàn: nội dung mặc định luôn hiện. Hiệu ứng ẩn chỉ được gắn sau khi trang chạy, chỉ cho phần còn nằm dưới màn hình, và gỡ sạch sau khi hiện xong,
// nên JS lỗi / khách bật "giảm chuyển động" thì không có gì bị ẩn.
const REVEAL = [
  '.product-section .section-title',
  '.product-section .tabs',
  '.product-grid > *',
  '.product-section .view-all-link',
  '.deal-visual',
  '.deal-content',
  '.product-columns > *',
  '.perks > .perk',
  '.instagram-section .section-title',
  '.instagram-grid > *',
]
const CURTAINS = '.category-grid .cat-card'
const STAGGER_MS = 80
const MAX_STAGGER = 6
const REVEAL_MS = 750

export default function ScrollEffects() {
  const pathname = usePathname()
  const bar = useRef(null)
  const [showTop, setShowTop] = useState(false)

  // Thanh tiến trình, header, nút lên đầu trang: gộp một bộ lắng nghe cuộn, mỗi khung hình tối đa một lần cập nhật.
  useEffect(() => {
    const header = document.querySelector('.header')
    let ticking = false
    let lastY = window.scrollY
    function update() {
      ticking = false
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`
      setShowTop(y > 700)
      if (header) {
        header.classList.toggle('is-scrolled', y > 8)
        const dy = y - lastY
        if (y < 120) {
          header.classList.remove('is-compact')
          lastY = y
        } else if (dy > 6) {
          header.classList.add('is-compact') // cuộn xuống: gọn lại
          lastY = y
        } else if (dy < -6) {
          header.classList.remove('is-compact') // cuộn lên: hiện đầy đủ
          lastY = y
        }
      }
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      header?.classList.remove('is-scrolled', 'is-compact')
    }
  }, [pathname])

  // Hiện dần / mở rèm khi cuộn tới (chỉ trang chủ).
  useEffect(() => {
    window.__sx = { stage: 'start', pathname }
    if (pathname !== '/') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return undefined

    window.__sx.stage = 'after-guards'
    const vh = window.innerHeight
    const below = (el) => el.getBoundingClientRect().top > vh * 0.92 // chỉ ẩn phần còn dưới màn hình
    const reveals = [...new Set(REVEAL.flatMap((s) => [...document.querySelectorAll(s)]))].filter(below)
    const curtains = [...document.querySelectorAll(CURTAINS)].filter(below)
    window.__sx.counts = { reveals: reveals.length, curtains: curtains.length, all: document.querySelectorAll('.product-grid > *').length }
    reveals.forEach((el) => el.classList.add('rv', 'rv-hide'))
    curtains.forEach((el) => el.classList.add('cc-closed'))

    const timers = []
    const io = new IntersectionObserver(
      (entries) => {
        // Các thẻ cùng vào màn hình một lượt thì hiện cách nhau chút một (lần lượt từ trái sang phải).
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, k) => {
            const el = e.target
            const delay = Math.min(k, MAX_STAGGER) * STAGGER_MS
            el.style.setProperty('--rv-delay', `${delay}ms`)
            if (el.classList.contains('cc-closed')) el.classList.remove('cc-closed')
            else el.classList.remove('rv-hide')
            io.unobserve(el)
            // Hiện xong thì gỡ sạch lớp hiệu ứng để không đè lên hiệu ứng rê chuột sẵn có của thẻ.
            timers.push(
              setTimeout(() => {
                el.classList.remove('rv')
                el.style.removeProperty('--rv-delay')
              }, REVEAL_MS + delay + 150),
            )
          })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    )
    ;[...reveals, ...curtains].forEach((el) => io.observe(el))

    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
      ;[...reveals, ...curtains].forEach((el) => {
        el.classList.remove('rv', 'rv-hide', 'cc-closed')
        el.style.removeProperty('--rv-delay')
      })
    }
  }, [pathname])

  function toTop() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <i ref={bar} />
      </div>
      <button type="button" className={`to-top${showTop ? ' is-on' : ''}`} onClick={toTop} aria-label="Lên đầu trang" tabIndex={showTop ? 0 : -1}>
        ↑
      </button>
    </>
  )
}
