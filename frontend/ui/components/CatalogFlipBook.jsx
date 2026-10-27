'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import HTMLFlipBook from 'react-pageflip'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))

// Một trang của sách: react-pageflip cần mỗi trang là một phần tử nhận được ref (để nó đo kích thước và vẽ hiệu ứng lật).
const Page = forwardRef(function Page({ src, alt }, ref) {
  return (
    <div className="catalog-page" ref={ref}>
      <img src={src} alt={alt} draggable={false} loading="lazy" />
    </div>
  )
})

// Xem catalog kiểu lật sách, mở toàn màn hình (portal ra ngoài layout). Bấm nền, nút ✕ hoặc Esc để đóng; mũi tên trái/phải lật trang.
// Zoom: nút +/− (mọi thiết bị), Ctrl + cuộn chuột (laptop/PC), chụm/mở 2 ngón + kéo 2 ngón để xem các góc (điện thoại/tablet).
export default function CatalogFlipBook({ catalog, onClose }) {
  const flipRef = useRef(null)
  const stageRef = useRef(null)
  const [page, setPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1) // để các listener gắn một lần (wheel, touch, kéo chuột) luôn đọc được zoom mới nhất
  const total = catalog.pages.length

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_STEP))
  const zoomReset = () => setZoom(1)

  // Esc đóng, mũi tên trái/phải lật trang, +/- zoom bằng bàn phím (laptop/PC).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') flipRef.current?.pageFlip()?.flipNext()
      else if (e.key === 'ArrowLeft') flipRef.current?.pageFlip()?.flipPrev()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-' || e.key === '_') zoomOut()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // chặn cuộn trang nền khi xem catalog
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // Laptop/PC: giữ Ctrl (hoặc Cmd trên Mac) rồi cuộn chuột để zoom tại chỗ, không chặn cuộn chuột bình thường.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else zoomOut()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Điện thoại/tablet: 2 ngón để zoom (pinch) và kéo xem các góc khi đã zoom. Chỉ can thiệp lúc có ĐÚNG 2 điểm chạm
  // (bắt ở pha capture, chặn lan xuống bên trong trước khi react-pageflip xử lý), nên vuốt 1 ngón để lật trang vẫn bình thường.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    let startDist = 0
    let startZoom = 1
    let lastMid = null
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const mid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 })
    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return
      startDist = dist(e.touches[0], e.touches[1]) || 1
      startZoom = zoomRef.current
      lastMid = mid(e.touches[0], e.touches[1])
      e.preventDefault()
      e.stopPropagation()
    }
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || !lastMid) return
      const next = clampZoom(startZoom * (dist(e.touches[0], e.touches[1]) / startDist))
      setZoom(next)
      const m = mid(e.touches[0], e.touches[1])
      el.scrollBy(lastMid.x - m.x, lastMid.y - m.y)
      lastMid = m
      e.preventDefault()
      e.stopPropagation()
    }
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) lastMid = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: false, capture: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    el.addEventListener('touchend', onTouchEnd, { capture: true })
    el.addEventListener('touchcancel', onTouchEnd, { capture: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true })
      el.removeEventListener('touchmove', onTouchMove, { capture: true })
      el.removeEventListener('touchend', onTouchEnd, { capture: true })
      el.removeEventListener('touchcancel', onTouchEnd, { capture: true })
    }
  }, [])

  // Laptop/PC: giữ chuột trái kéo để xem các góc khi đã zoom (chuột không có cử chỉ chụm 2 ngón như cảm ứng).
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    let dragging = false
    let start = { x: 0, y: 0, left: 0, top: 0 }
    const onDown = (e) => {
      if (zoomRef.current <= 1) return
      dragging = true
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
      el.classList.add('is-panning')
    }
    const onMove = (e) => {
      if (!dragging) return
      el.scrollLeft = start.left - (e.clientX - start.x)
      el.scrollTop = start.top - (e.clientY - start.y)
    }
    const onUp = () => {
      dragging = false
      el.classList.remove('is-panning')
    }
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return createPortal(
    <div
      className="catalog-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={catalog.title}
      onClick={(e) => e.target === e.currentTarget && zoom <= 1 && onClose()}
    >
      <div className="catalog-viewer-bar">
        <span className="catalog-viewer-title">{catalog.title}</span>
        <span className="catalog-viewer-count">
          Trang {page + 1}/{total}
        </span>
        <div className="catalog-viewer-zoom">
          <button type="button" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} aria-label="Thu nhỏ">
            −
          </button>
          <button type="button" onClick={zoomReset} className="catalog-viewer-zoom-pct" aria-label="Về cỡ gốc 100%">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Phóng to">
            +
          </button>
        </div>
        <button type="button" onClick={onClose} className="catalog-viewer-close" aria-label="Đóng catalog">
          ✕
        </button>
      </div>
      <div className={`catalog-viewer-stage${zoom > 1 ? ' is-zoomed' : ''}`} ref={stageRef}>
        <button
          type="button"
          className="catalog-viewer-nav catalog-viewer-prev"
          aria-label="Trang trước"
          onClick={() => flipRef.current?.pageFlip()?.flipPrev()}
        >
          ‹
        </button>
        <div className="catalog-zoom-wrap" style={{ transform: `scale(${zoom})` }}>
          <HTMLFlipBook
            ref={flipRef}
            width={catalog.width || 480}
            height={catalog.height || 680}
            size="stretch"
            minWidth={240}
            minHeight={200}
            maxWidth={900}
            maxHeight={1040}
            showCover={false}
            mobileScrollSupport
            onFlip={(e) => {
              setPage(e.data)
              zoomReset() // sang trang mới thì về cỡ gốc, tránh trang mới cũng bị phóng to/lệch theo trang trước
            }}
            className="catalog-flipbook"
          >
            {catalog.pages.map((src, i) => (
              <Page key={src} src={src} alt={`${catalog.title} – trang ${i + 1}`} />
            ))}
          </HTMLFlipBook>
        </div>
        <button
          type="button"
          className="catalog-viewer-nav catalog-viewer-next"
          aria-label="Trang sau"
          onClick={() => flipRef.current?.pageFlip()?.flipNext()}
        >
          ›
        </button>
      </div>
    </div>,
    document.body,
  )
}
