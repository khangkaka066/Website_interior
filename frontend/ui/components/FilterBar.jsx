'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from '@/lib/router'
import { categories } from '../data/shop'
import { COLOR_FILTERS } from '../data/smartSearch'

// Thanh lọc nhanh ở trang chủ: chọn danh mục / màu / khoảng giá rồi sang trang Sản phẩm với bộ lọc đã áp (cùng tham số URL mà trang đó đọc).
const PRICES = [
  { id: 'under100', label: 'Dưới 100.000đ' },
  { id: '100-250', label: '100.000đ – 250.000đ' },
  { id: 'over250', label: 'Trên 250.000đ' },
]

// Màu chấm tròn cho từng nhóm màu (khớp COLOR_FILTERS trong smartSearch).
const SWATCH = { xam: '#9ca3af', xanh: '#3b82f6', nau: '#8b5a2b', hong: '#f472b6', vang: '#e8c05a', trang: '#ffffff', den: '#1f2937', bac: '#cbd5e1' }

const Icon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

// Ô chọn tự vẽ (thay <select> của trình duyệt): danh sách bo góc đổ bóng, có ô "Tất cả", dấu tích ở mục đang chọn, bàn phím đầy đủ.
function Dropdown({ icon, label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef(null)
  const listId = useId()
  const items = [{ id: '', label: `Tất cả ${label.toLowerCase()}` }, ...options]
  const current = options.find((o) => o.id === value)

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => !root.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  function openList() {
    setActive(Math.max(0, items.findIndex((o) => o.id === value)))
    setOpen(true)
  }
  function pick(i) {
    onChange(items[i].id)
    setOpen(false)
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'Tab') return setOpen(false)
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      if (!open) return openList()
      if (e.key === 'ArrowDown') setActive((a) => Math.min(items.length - 1, a + 1))
      else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
      else pick(active)
    }
  }

  return (
    <div className={`filter-field${open ? ' is-open' : ''}${value ? ' has-value' : ''}`} ref={root}>
      <button type="button" className="filter-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={label} onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKeyDown}>
        {icon}
        <span className="filter-value">{current ? current.label : label}</span>
        <svg className="filter-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="filter-menu" id={listId} role="listbox" aria-label={label}>
          {items.map((o, i) => (
            <li key={o.id || 'all'} role="option" aria-selected={o.id === value} className={`filter-option${i === active ? ' is-active' : ''}${o.id === value ? ' is-selected' : ''}`} onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
              {o.swatch && <i className="filter-swatch" style={{ background: o.swatch }} />}
              <span>{o.label}</span>
              {o.id === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FilterBar() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [price, setPrice] = useState('')

  function submit(e) {
    e.preventDefault()
    const sp = new URLSearchParams()
    if (category) sp.set('category', category)
    if (color) sp.set('color', color)
    if (price) sp.set('price', price)
    navigate(`/products${sp.toString() ? `?${sp}` : ''}`)
  }

  return (
    <form className="filter-bar" onSubmit={submit} role="search" aria-label="Lọc nhanh sản phẩm">
      <Dropdown
        label="Danh mục"
        value={category}
        onChange={setCategory}
        icon={<Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>}
        options={categories.map((c) => ({ id: c.id, label: c.name }))}
      />
      <Dropdown
        label="Màu sắc"
        value={color}
        onChange={setColor}
        icon={<Icon><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="10" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="15.5" cy="10" r="1" fill="currentColor" /><path d="M12 21c-1.5 0-2-1.3-1.2-2.4.8-1 .3-2.1-.8-2.1H8" /></Icon>}
        options={COLOR_FILTERS.map((c) => ({ id: c.id, label: c.label, swatch: SWATCH[c.id] }))}
      />
      <Dropdown
        label="Khoảng giá"
        value={price}
        onChange={setPrice}
        icon={<Icon><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" /></Icon>}
        options={PRICES}
      />
      <button type="submit" className="btn-pill btn-pill-dark filter-submit">
        Tìm rèm
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </button>
    </form>
  )
}
