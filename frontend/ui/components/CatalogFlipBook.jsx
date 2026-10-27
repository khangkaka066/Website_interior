'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import HTMLFlipBook from 'react-pageflip'

// Một trang của sách: react-pageflip cần mỗi trang là một phần tử nhận được ref (để nó đo kích thước và vẽ hiệu ứng lật).
const Page = forwardRef(function Page({ src, alt }, ref) {
  return (
    <div className="catalog-page" ref={ref}>
      <img src={src} alt={alt} draggable={false} loading="lazy" />
    </div>
  )
})

// Xem catalog kiểu lật sách, mở toàn màn hình (portal ra ngoài layout). Bấm nền, nút ✕ hoặc Esc để đóng; mũi tên trái/phải lật trang.
export default function CatalogFlipBook({ catalog, onClose }) {
  const flipRef = useRef(null)
  const [page, setPage] = useState(0)
  const total = catalog.pages.length

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') flipRef.current?.pageFlip()?.flipNext()
      if (e.key === 'ArrowLeft') flipRef.current?.pageFlip()?.flipPrev()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // chặn cuộn trang nền khi xem catalog
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return createPortal(
    <div className="catalog-viewer" role="dialog" aria-modal="true" aria-label={catalog.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="catalog-viewer-bar">
        <span className="catalog-viewer-title">{catalog.title}</span>
        <span className="catalog-viewer-count">
          Trang {page + 1}/{total}
        </span>
        <button type="button" onClick={onClose} className="catalog-viewer-close" aria-label="Đóng catalog">
          ✕
        </button>
      </div>
      <div className="catalog-viewer-stage">
        <button
          type="button"
          className="catalog-viewer-nav catalog-viewer-prev"
          aria-label="Trang trước"
          onClick={() => flipRef.current?.pageFlip()?.flipPrev()}
        >
          ‹
        </button>
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
          onFlip={(e) => setPage(e.data)}
          className="catalog-flipbook"
        >
          {catalog.pages.map((src, i) => (
            <Page key={src} src={src} alt={`${catalog.title} – trang ${i + 1}`} />
          ))}
        </HTMLFlipBook>
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
