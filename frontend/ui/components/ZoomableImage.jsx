'use client'

import { useEffect, useRef, useState } from 'react'

const MIN = 1
const MAX = 4
const STEP = 0.5
const HOLD_ZOOM = 2.5 // mức phóng khi giữ chuột trái
const clamp = (z) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100))

// Ảnh sản phẩm có zoom: Ctrl/Cmd + cuộn chuột (laptop/PC),
// giữ chuột trái để phóng tại chỗ và rê chuột tới đâu zoom tới đó (thả chuột thì về cỡ gốc),
// chụm 2 ngón (điện thoại/tablet); đã zoom bằng Ctrl+cuộn/chụm thì kéo (chuột hoặc 1 ngón) để xem các góc.
export default function ZoomableImage({ src, alt, ...imgProps }) {
  const stageRef = useRef(null)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const pointers = useRef(new Map())
  const gesture = useRef(null) // { type: 'pan' | 'pinch', ... }
  const [dragging, setDragging] = useState(false)

  // Đổi sang ảnh khác thì về cỡ gốc.
  useEffect(() => {
    setView({ s: 1, x: 0, y: 0 })
  }, [src])

  // Giữ ảnh không trôi ra khỏi khung: tối đa (s-1)/2 kích thước mỗi bên.
  const limit = (s, x, y) => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r || s <= 1) return { s, x: 0, y: 0 }
    const mx = ((s - 1) * r.width) / 2
    const my = ((s - 1) * r.height) / 2
    return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) }
  }

  // Đổi mức zoom quanh điểm (cx, cy) tính từ tâm khung; không truyền thì zoom quanh tâm.
  const zoomTo = (next, cx = 0, cy = 0) =>
    setView((v) => {
      const s = clamp(next)
      const k = s / v.s
      return limit(s, cx - (cx - v.x) * k, cy - (cy - v.y) * k)
    })
  const fromCenter = (clientX, clientY) => {
    const r = stageRef.current.getBoundingClientRect()
    return [clientX - r.left - r.width / 2, clientY - r.top - r.height / 2]
  }

  // Ctrl/Cmd + cuộn: zoom tại con trỏ; cuộn thường vẫn cuộn trang.
  useEffect(() => {
    const el = stageRef.current
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const [cx, cy] = fromCenter(e.clientX, e.clientY)
      zoomTo(viewRef.current.s + (e.deltaY < 0 ? STEP : -STEP) / 2, cx, cy)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y) || 1
  }
  const mid = () => {
    const [a, b] = [...pointers.current.values()]
    return [(a.x + b.x) / 2, (a.y + b.y) / 2]
  }

  function onPointerDown(e) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'mouse' && viewRef.current.s === 1) {
      // giữ chuột trái: phóng tại điểm giữ, điểm dưới con trỏ giữ nguyên vị trí khi rê
      const [cx, cy] = fromCenter(e.clientX, e.clientY)
      gesture.current = { type: 'hold' }
      setView(limit(HOLD_ZOOM, -cx * (HOLD_ZOOM - 1), -cy * (HOLD_ZOOM - 1)))
      setDragging(true)
    } else if (pointers.current.size === 2) {
      const [mx, my] = mid()
      gesture.current = { type: 'pinch', d: dist(), s: viewRef.current.s, mx, my }
    } else if (pointers.current.size === 1 && viewRef.current.s > 1) {
      gesture.current = { type: 'pan', x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }
      setDragging(true)
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.type === 'hold') {
      const [cx, cy] = fromCenter(e.clientX, e.clientY)
      setView(limit(HOLD_ZOOM, -cx * (HOLD_ZOOM - 1), -cy * (HOLD_ZOOM - 1)))
    } else if (g.type === 'pinch' && pointers.current.size === 2) {
      const [mx, my] = mid()
      const s = clamp(g.s * (dist() / g.d))
      const [cx, cy] = fromCenter(mx, my)
      setView((v) => {
        const k = s / v.s
        // vừa zoom quanh điểm giữa 2 ngón, vừa đi theo khi 2 ngón di chuyển
        return limit(s, cx - (cx - v.x) * k + (mx - g.mx), cy - (cy - v.y) * k + (my - g.my))
      })
      gesture.current = { ...g, mx, my }
    } else if (g.type === 'pan') {
      setView((v) => limit(v.s, g.vx + e.clientX - g.x, g.vy + e.clientY - g.y))
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (gesture.current?.type === 'hold') setView({ s: 1, x: 0, y: 0 })
    gesture.current = null
    setDragging(false)
    // còn 1 ngón sau khi chụm: tiếp tục kéo nếu đang zoom
    if (pointers.current.size === 1 && viewRef.current.s > 1) {
      const [p] = [...pointers.current.values()]
      gesture.current = { type: 'pan', x: p.x, y: p.y, vx: viewRef.current.x, vy: viewRef.current.y }
    }
  }

  const zoomed = view.s > 1
  return (
    <>
      <div
        ref={stageRef}
        className={`zoom-stage${zoomed ? ' is-zoomed' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
          {...imgProps}
        />
      </div>
    </>
  )
}
