'use client'

import { useEffect, useRef, useState } from 'react'

// Ba ảnh rèm xếp chồng 3D ở hero, TỰ ĐỔI CHỖ theo vòng như xếp lại bộ bài: ảnh đang ở trước bay ra sau, ảnh giữa tiến lên trước, ảnh sau tiến lên giữa.
// order = [sau, giữa, trước]. Chuyển động nằm hết trong CSS (transition + keyframes); ở đây chỉ quyết định ai đứng ở vị trí nào.
const CARDS = {
  blue: { src: '/images/curtains/blue.webp', alt: 'Rèm xanh dương', label: 'Xem rèm xanh dương' },
  brown: { src: '/images/curtains/brown.webp', alt: 'Rèm nâu', label: 'Xem rèm nâu' },
  gold: { src: '/images/curtains/gold.webp', alt: 'Rèm vàng gold', label: 'Xem rèm vàng gold' },
}
const SLOTS = ['back', 'mid', 'front']
const CYCLE_MS = 2000 // 0,8 giây đứng yên + 1,2 giây chuyển động (khớp thời gian trong CSS)

export default function HeroStack() {
  const root = useRef(null)
  const [order, setOrder] = useState(['blue', 'brown', 'gold'])
  const [leaving, setLeaving] = useState(null) // ảnh vừa bay từ trước ra sau (được chạy đường bay cong)
  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(true) // đang nằm trong màn hình
  const [tabOn, setTabOn] = useState(true) // tab trình duyệt đang hiển thị
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(Boolean(mq?.matches))
    sync()
    mq?.addEventListener?.('change', sync)
    const onVis = () => setTabOn(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => {
      mq?.removeEventListener?.('change', sync)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Tự xoay một nấc sau mỗi chu kỳ. Mỗi lần thứ tự đổi (kể cả do khách bấm) là hẹn lại từ đầu, nên sau khi bấm luôn có đủ thời gian để ngắm.
  // Dừng khi rê chuột / không nhìn thấy / tab ẩn / khách bật "giảm chuyển động".
  const paused = hover || !visible || !tabOn || reduced
  useEffect(() => {
    if (paused) return undefined
    const t = setTimeout(() => {
      setOrder(([back, mid, front]) => [front, back, mid]) // trước -> sau, sau -> giữa, giữa -> trước
      setLeaving(order[2])
    }, CYCLE_MS)
    return () => clearTimeout(t)
  }, [order, paused])

  // Bấm một ảnh ở sau/giữa thì kéo nó lên trước (các ảnh còn lại xoay theo vòng).
  function bringToFront(id) {
    const i = order.indexOf(id)
    if (i === 2) return
    setLeaving(null)
    setOrder(i === 1 ? [order[2], order[0], order[1]] : [order[1], order[2], order[0]])
    if (i === 1) setLeaving(order[2])
  }

  return (
    <div
      ref={root}
      className="hero-3d-stack"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {Object.entries(CARDS).map(([id, c]) => {
        const slot = SLOTS[order.indexOf(id)]
        return (
          <button
            key={id}
            type="button"
            className={`stack-item slot-${slot}${leaving === id ? ' is-leaving' : ''}`}
            onClick={() => bringToFront(id)}
            aria-label={slot === 'front' ? c.alt : c.label}
            tabIndex={slot === 'front' ? -1 : 0}
          >
            <img className={`stack-card card-${id}`} src={c.src} alt="" fetchPriority={id === 'gold' ? 'high' : undefined} decoding="async" draggable="false" />
          </button>
        )
      })}
      <img className="hero-badge-logo" src="/images/brand/logo.png" alt="Curtain Premium Quality" />
    </div>
  )
}
