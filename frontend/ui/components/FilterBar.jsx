'use client'

import { useState } from 'react'
import { useNavigate } from '@/lib/router'
import { categories } from '../data/shop'
import { COLOR_FILTERS } from '../data/smartSearch'

// Thanh lọc nhanh ở trang chủ: chọn danh mục / màu / khoảng giá rồi sang trang Sản phẩm với bộ lọc đã áp (cùng tham số URL mà trang đó đọc).
const PRICES = [
  { id: 'under100', label: 'Dưới 100.000đ' },
  { id: '100-250', label: '100.000đ – 250.000đ' },
  { id: 'over250', label: 'Trên 250.000đ' },
]

const Icon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

function Field({ icon, label, value, onChange, children }) {
  return (
    <label className="filter-field">
      {icon}
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
    </label>
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
      <Field label="Danh mục" value={category} onChange={setCategory} icon={<Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>}>
        <option value="">Danh mục</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Field>
      <Field label="Màu sắc" value={color} onChange={setColor} icon={<Icon><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="10" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="15.5" cy="10" r="1" fill="currentColor" /><path d="M12 21c-1.5 0-2-1.3-1.2-2.4.8-1 .3-2.1-.8-2.1H8" /></Icon>}>
        <option value="">Màu sắc</option>
        {COLOR_FILTERS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </Field>
      <Field label="Khoảng giá" value={price} onChange={setPrice} icon={<Icon><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" /></Icon>}>
        <option value="">Khoảng giá</option>
        {PRICES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </Field>
      <button type="submit" className="btn-pill btn-pill-dark filter-submit">
        Tìm rèm
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </button>
    </form>
  )
}
