'use client'

import { useEffect, useRef } from 'react'

// Hạt bụi nắng bay lơ lửng sau nội dung hero: các đốm sáng vàng ấm trôi chậm, lấp lánh nhẹ, kèm vệt nắng mờ từ góc trên phải.
// Chỉ chạy khi hero đang nằm trong màn hình và tab đang mở; tôn trọng prefers-reduced-motion (chỉ vẽ một khung tĩnh).
const TONES = ['244,180,70', '236,160,52', '250,196,96', '224,142,40'] // vàng nắng -> hổ phách đậm: nền hero sáng nên cần đủ đậm mới thấy

// Một đốm sáng mềm vẽ sẵn một lần, mỗi hạt chỉ phóng to/thu nhỏ rồi chép lại (rẻ hơn tạo gradient cho từng hạt mỗi khung hình).
function makeSprite(rgb) {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${rgb},1)`)
  grad.addColorStop(0.25, `rgba(${rgb},0.55)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

export default function SunDust({ density = 1 }) {
  const wrap = useRef(null)
  const canvas = useRef(null)

  useEffect(() => {
    const el = wrap.current
    const cv = canvas.current
    if (!el || !cv) return undefined
    const ctx = cv.getContext('2d')
    if (!ctx) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = TONES.map(makeSprite)

    let w = 0
    let h = 0
    let dpr = 1
    let parts = []
    let raf = 0
    let last = 0
    let visible = true

    const spawn = (anywhere) => {
      const depth = Math.random() // 0 = xa, 1 = gần: hạt gần to, sáng và trôi nhanh hơn
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 20,
        size: 8 + depth * 26, // đường kính đốm sáng (px)
        speed: 4 + depth * 11, // px/giây, trôi lên
        sway: 6 + Math.random() * 18, // biên độ lắc ngang
        swayRate: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.3 + Math.random() * 0.7,
        base: 0.4 + depth * 0.55,
        sprite: sprites[(Math.random() * sprites.length) | 0],
      }
    }

    const resize = () => {
      const r = el.getBoundingClientRect()
      w = r.width
      h = r.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(90, Math.max(22, (w * h) / 11000)) * density) // màn hình nhỏ thì ít hạt hơn
      parts = Array.from({ length: count }, () => spawn(true))
    }

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        const sway = Math.sin(t * p.swayRate + p.phase) * p.sway
        const tw = 0.6 + 0.4 * Math.sin(t * p.twinkle * 2 + p.phase * 2)
        // mờ dần ở mép trên và dưới để hạt không hiện / biến mất đột ngột
        const edge = Math.min(1, p.y / 60, (h - p.y) / 60)
        const a = p.base * tw * Math.max(0, edge)
        if (a <= 0.01) continue
        ctx.globalAlpha = a
        ctx.drawImage(p.sprite, p.x + sway - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
      ctx.globalAlpha = 1
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000 || 0) // tab bị treo lâu rồi quay lại không làm hạt nhảy vọt
      last = now
      const t = now / 1000
      for (const p of parts) {
        p.y -= p.speed * dt
        if (p.y < -20) Object.assign(p, spawn(false), { x: Math.random() * w })
      }
      draw(t)
    }

    const start = () => {
      if (reduced || raf || !visible || document.hidden) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    resize()
    draw(0)
    start()

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(el)
    const ro = new ResizeObserver(() => {
      resize()
      if (reduced) draw(0)
    })
    ro.observe(el)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [density])

  return (
    <div ref={wrap} className="sun-dust" aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}
