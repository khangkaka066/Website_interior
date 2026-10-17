'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import '../styles/scroll-effects.css'

// Hiệu ứng cuộn trang cho khu khách hàng:
//  - Mọi trang: thanh tiến trình cuộn, header dính đầu trang (cuộn xuống thì trượt đi, cuộn lên thì hiện lại), nút "Lên đầu trang".
//  - Trang chủ: hero trôi nhẹ theo cuộn khối hiện dần từ dưới lên, thẻ trong lưới hiện lần lượt trái -> phải,
//    ba ô danh mục "mở rèm" từ giữa ra hai bên.
// Nguyên tắc: chỉ dùng transform/opacity/clip-path (không đổi kích thước nên không giật bố cục); trạng thái ẩn giữ bằng Web Animations API
// (không đổi thuộc tính DOM nào nên không lệch với HTML React đang nạp); JS lỗi / "giảm chuyển động" thì nội dung vẫn hiện đầy đủ.
const REVEAL = [
  '.product-section .tabs',
  '.product-grid > *',
  '.product-section .view-all-link',
  '.deal-visual',
  '.deal-content',
  '.product-columns > *',
  '.perks > .perk',
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

  // Hiện dần / mở rèm khi cuộn tới (chỉ trang chủ), chạy lại mỗi lần khối cuộn ra phía dưới rồi quay vào (cuộn ngược lên rồi xuống lại).
  // Khi chuyển trang bằng link (không tải lại), nội dung trang chủ đến SAU khung chờ (loading.js) nên không có sẵn lúc hiệu ứng khởi động:
  // MutationObserver theo dõi và gắn hiệu ứng cho khối mới xuất hiện, kể cả sản phẩm tải về muộn.
  useEffect(() => {
    if (pathname !== '/') return undefined
    if (reducedMotion() || typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return undefined

    const managed = new Set()
    const holds = new Map() // khối đang "chưa hiện" -> các animation giữ nó ở trạng thái ẩn (không đổi thuộc tính DOM nào, tránh lệch với HTML React đang nạp)
    let scanQueued = false
    const below = (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92 // chỉ ẩn phần còn nằm dưới màn hình

    // Phần ảnh được "kéo rèm" mở từ giữa ra hai bên (clip-path) trong khi khối hiện dần. Gắn clip-path lên ảnh bên trong, không lên khối đang được
    // theo dõi: khối bị cắt hết chiều ngang thì trình duyệt coi như không nằm trong màn hình và không bao giờ kích hoạt hiệu ứng.
    const wipeOf = (el) => (el.matches(CURTAINS) ? el.querySelector('.cat-photo-wrap') : el.matches('.deal-visual') ? el.querySelector('img') : null)

    // Giữ khối ở trạng thái ẩn bằng một animation 1ms có fill: forwards (hủy animation là khối trở lại bình thường).
    function arm(el) {
      if (holds.has(el)) return
      const list = [el.animate([{ opacity: 0, translate: '0 32px' }], { duration: 1, fill: 'forwards' })]
      const wipe = wipeOf(el)
      if (wipe) list.push(wipe.animate([{ clipPath: 'inset(0 50% 0 50%)' }], { duration: 1, fill: 'forwards' }))
      if (el.matches(CURTAINS)) {
        const photo = el.querySelector('.cat-photo')
        if (photo) list.push(photo.animate([{ transform: 'scale(1.14)' }], { duration: 1, fill: 'forwards' }))
      }
      holds.set(el, list)
    }

    // Bỏ trạng thái ẩn và phát hiệu ứng vào (Web Animations API: không để lại thuộc tính nào nên không đè lên hiệu ứng rê chuột của thẻ).
    function play(el, delay) {
      holds.get(el)?.forEach((a) => a.cancel())
      holds.delete(el)
      const opts = { duration: REVEAL_MS, delay, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' }
      el.animate([{ opacity: 0, translate: '0 32px' }, { opacity: 1, translate: '0 0' }], opts)
      wipeOf(el)?.animate([{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], { ...opts, delay: delay + 150, duration: 1200, easing: 'cubic-bezier(0.7, 0, 0.2, 1)' })
      if (el.matches(CURTAINS)) {
        el.querySelector('.cat-photo')?.animate([{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { ...opts, duration: 1400 })
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        // Các thẻ cùng vào màn hình một lượt thì hiện cách nhau chút một, từ trên xuống và từ trái sang phải.
        entries
          .filter((e) => e.isIntersecting && holds.has(e.target))
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((e, k) => play(e.target, Math.min(k, MAX_STAGGER) * STAGGER_MS))
        // Khối đã cuộn hẳn ra PHÍA DƯỚI màn hình (khách cuộn ngược lên) thì ẩn lại để lần cuộn xuống tới sẽ hiện dần lần nữa.
        // Khối ra phía trên thì để yên: hiệu ứng mờ dần theo cuộn (scroll-effects.css) đã lo.
        entries.forEach((e) => {
          if (!e.isIntersecting && e.boundingClientRect.top > 0) arm(e.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    )

    function scan() {
      scanQueued = false
      const found = new Set(REVEAL.flatMap((q) => [...document.querySelectorAll(q)]))
      document.querySelectorAll(CURTAINS).forEach((el) => found.add(el))
      found.forEach((el) => {
        if (managed.has(el)) return
        managed.add(el)
        if (below(el)) arm(el) // đã nằm trong màn hình lúc xuất hiện thì để hiện sẵn
        io.observe(el)
      })
      // Khối đã bị React gỡ khỏi trang thì thôi theo dõi.
      managed.forEach((el) => {
        if (!el.isConnected) {
          io.unobserve(el)
          managed.delete(el)
          holds.delete(el)
        }
      })
    }
    const queueScan = () => {
      if (!scanQueued) {
        scanQueued = true
        requestAnimationFrame(scan)
      }
    }
    scan()
    const mo = new MutationObserver(queueScan)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      io.disconnect()
      holds.forEach((list) => list.forEach((a) => a.cancel()))
    }
  }, [pathname])

  // Lên đầu trang: tự chạy từng khung hình (thay cho scroll mượt của trình duyệt). Cuộn mượt gốc có thời gian cố định theo trình duyệt và bị giật khi trang
  // đang có nhiều hiệu ứng theo cuộn; ở đây thời gian tỉ lệ nhẹ với quãng đường (0,45–1,1 giây), có đà vào/ra, và trong lúc chạy tạm tắt các hiệu ứng
  // gắn với vị trí cuộn (class is-jumping, xem scroll-effects.css) để mỗi khung hình chỉ còn việc cuộn. Khách lăn chuột / chạm / bấm phím thì dừng ngay.
  const jumpRef = useRef(null)
  function stopJump() {
    const j = jumpRef.current
    if (!j) return
    cancelAnimationFrame(j.raf)
    ;['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => window.removeEventListener(t, stopJump))
    document.documentElement.classList.remove('is-jumping')
    jumpRef.current = null
  }
  useEffect(() => stopJump, [])
  function toTop() {
    stopJump()
    const from = window.scrollY
    if (from <= 0) return
    if (reducedMotion()) {
      window.scrollTo(0, 0)
      return
    }
    const duration = Math.min(1100, Math.max(450, Math.sqrt(from) * 14))
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
    const t0 = performance.now()
    document.documentElement.classList.add('is-jumping')
    ;['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => window.addEventListener(t, stopJump, { passive: true }))
    const j = (jumpRef.current = { raf: 0 })
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      window.scrollTo(0, from * (1 - ease(p)))
      if (p < 1) j.raf = requestAnimationFrame(step)
      else stopJump()
    }
    j.raf = requestAnimationFrame(step)
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
