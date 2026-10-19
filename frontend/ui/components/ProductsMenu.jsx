'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Link } from '@/lib/router'
import { CURTAIN_CATEGORIES, PRODUCT_GROUPS, SERVICES } from '../data/menu'

// Menu "Sản phẩm" xổ ra danh mục theo các nhóm trên danh thiếp: rèm/đệm gối/khăn bàn, vật liệu ốp, bảng hiệu & đèn LED, đồ gỗ, kèm dịch vụ.
// Máy tính: rê chuột là mở. Điện thoại/bàn phím: bấm mũi tên bên cạnh chữ "Sản phẩm" (chữ vẫn là link tới trang tất cả sản phẩm).
// Màn hình hẹp: thanh menu cuộn ngang (overflow-x) nên sẽ cắt mất danh mục xổ ra bên trong nó; khi đó danh mục được vẽ ra ngoài thanh menu (portal)
// thành một bảng cố định ngay dưới thanh menu.
const NARROW = '(max-width: 1099px)'

export default function ProductsMenu() {
  const [open, setOpen] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [top, setTop] = useState(0)
  const wrap = useRef(null)
  const sheet = useRef(null)
  const timer = useRef(null)
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Bảng cố định nằm ngay dưới thanh menu; thanh menu cuộn theo trang thì bảng đóng lại để không lơ lửng sai chỗ.
  useEffect(() => {
    if (!open || !narrow || !wrap.current) return undefined
    const place = () => setTop(Math.round(wrap.current.getBoundingClientRect().bottom) + 8)
    place()
    const close = () => setOpen(false)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', close)
    }
  }, [open, narrow])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && !sheet.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Chỉ chuột mới mở/đóng khi rê: màn hình cảm ứng giả lập "rê chuột" khi chạm (mở) rồi tới sự kiện bấm (đóng) nên menu mở rồi tắt ngay.
  const show = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    setOpen(true)
  }
  const hideSoon = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 160)
  }

  const menu = (
    <div className={`mega-menu${narrow ? ' mega-menu-sheet' : ''}`} role="menu" ref={sheet} style={narrow ? { top } : undefined}>
          <div className="container mega-grid">
            {PRODUCT_GROUPS.map((g) => (
              <div className="mega-col" key={g.id}>
                <Link to={g.href} className="mega-title">
                  {g.title}
                </Link>
                {g.id === 'curtain' ? (
                  <ul>
                    {CURTAIN_CATEGORIES.map((c) => (
                      <li key={c.id}>
                        <Link to={`/products?category=${c.id}`}>{c.name}</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="mega-items">
                    {g.items.map((it) => (
                      <li key={it}>
                        <Link to={g.href}>{it}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <div className="container mega-foot">
            <span className="mega-foot-label">Dịch vụ</span>
            {SERVICES.map((s) => (
              <Link key={s.id} to="/about#linh-vuc">
                {s.title}
              </Link>
            ))}
            <Link to="/products" className="mega-all">
              Xem tất cả sản phẩm →
            </Link>
          </div>
        </div>
  )

  return (
    <div className={`nav-products ${open ? 'nav-products-open' : ''}`} ref={wrap} onPointerEnter={show} onPointerLeave={hideSoon}>
      <Link to="/products" className="nav-products-link">
        Sản phẩm
      </Link>
      <button
        type="button"
        className="nav-products-toggle"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Mở danh mục sản phẩm"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (narrow ? createPortal(menu, document.body) : menu)}
    </div>
  )
}
