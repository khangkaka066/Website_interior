'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import '../styles/scroll-effects.css'

// Hiệu ứng cuộn trang cho khu khách hàng:
//  - Mọi trang: thanh tiến trình cuộn, header dính đầu trang (cuộn xuống thì trượt đi, cuộn lên thì hiện lại), nút "Lên đầu trang".
//  - Trang chủ: hero trôi nhẹ theo cuộn khối hiện dần từ dưới lên, thẻ trong lưới hiện lần lượt trái -> phải,
//    ba ô danh mục "mở rèm" từ giữa ra hai bên.
// Nguyên tắc: chỉ dùng transform/opacity/clip-path (không đổi kích thước nên không giật bố cục); trạng thái ẩn đặt bằng thuộc tính data-rv
// (React không đụng tới nên không bị xóa khi render lại); JS lỗi / "giảm chuyển động" thì nội dung vẫn hiện đầy đủ.
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
const STAGGER_MS = 90
const MAX_STAGGER = 6
const REVEAL_MS = 900

const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export default function ScrollEffects() {
  const pathname = usePathname()
  const bar = useRef(null)
  const [showTop, setShowTop] = useState(false)

  // Một bộ lắng nghe cuộn duy nhất, mỗi khung hình cập nhật tối đa một lần.
  useEffect(() => {
    const header = document.querySelector('.header')
    let ticking = false
    let lastY = window.scrollY
    let anchorY = lastY // mốc để đo quãng cuộn theo một chiều, tránh nhấp nháy khi lăn chuột nhẹ
    let dir = 0

    function update() {
      ticking = false
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`
      setShowTop(y > 700)

      if (header) {
        header.classList.toggle('is-scrolled', y > 8)
        const d = Math.sign(y - lastY)
        if (d !== 0 && d !== dir) {
          dir = d
          anchorY = lastY
        }
        lastY = y
        const travelled = Math.abs(y - anchorY)
        const h = header.offsetHeight
        if (y < h + 40 || (dir < 0 && travelled > 12)) header.classList.remove('is-hidden')
        else if (dir > 0 && travelled > 12 && !header.contains(document.activeElement)) header.classList.add('is-hidden')
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
      header?.classList.remove('is-scrolled', 'is-hidden')
    }
  }, [pathname])

  // Hiện dần / mở rèm khi cuộn tới (chỉ trang chủ).
  useEffect(() => {
    if (pathname !== '/') return undefined
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') return undefined

    const vh = window.innerHeight
    const below = (el) => el.getBoundingClientRect().top > vh * 0.92 // chỉ ẩn phần còn nằm dưới màn hình
    const reveals = [...new Set(REVEAL.flatMap((s) => [...document.querySelectorAll(s)]))].filter(below)
    const curtains = [...document.querySelectorAll(CURTAINS)].filter(below)
    const all = [...reveals, ...curtains]
    reveals.forEach((el) => el.setAttribute('data-rv', 'hide'))
    curtains.forEach((el) => el.setAttribute('data-rv', 'curtain'))

    const timers = []
    const io = new IntersectionObserver(
      (entries) => {
        // Các thẻ cùng vào màn hình một lượt thì hiện cách nhau chút một, từ trên xuống và từ trái sang phải.
        entries
          .filter((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((e, k) => {
            const el = e.target
            const delay = e.isIntersecting ? Math.min(k, MAX_STAGGER) * STAGGER_MS : 0
            el.style.setProperty('--rv-delay', `${delay}ms`)
            el.setAttribute('data-rv', 'show')
            io.unobserve(el)
            // Hiện xong thì gỡ sạch để không đè lên hiệu ứng rê chuột sẵn có của thẻ.
            timers.push(
              setTimeout(() => {
                el.removeAttribute('data-rv')
                el.style.removeProperty('--rv-delay')
              }, REVEAL_MS + delay + 200),
            )
          })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    )
    all.forEach((el) => io.observe(el))

    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
      all.forEach((el) => {
        el.removeAttribute('data-rv')
        el.style.removeProperty('--rv-delay')
      })
    }
  }, [pathname])

  function toTop() {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
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
