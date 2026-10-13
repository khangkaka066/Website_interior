'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { normalizeVi } from '../utils/vnProvinces'

// Ô chọn có gõ để lọc (không phân biệt dấu). options: [{ code, name }]. onSelect nhận option đã chọn.
export default function AddressCombobox({ value, options, onSelect, placeholder, disabled, ariaLabel, inputClassName }) {
  const listId = useId()
  const inputRef = useRef(null)
  const [query, setQuery] = useState(null) // null = hiện giá trị đã chọn, chuỗi = khách đang gõ
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // short = tên bỏ tiền tố loại đơn vị, để gõ "ba dinh" xếp "Phường Ba Đình" lên đầu.
  const indexed = useMemo(
    () =>
      options.map((o) => {
        const key = normalizeVi(o.name)
        return { ...o, key, short: key.replace(/^(thanh pho|tinh|phuong|xa|dac khu) /, '') }
      }),
    [options],
  )
  const filtered = useMemo(() => {
    const q = normalizeVi((query || '').trim())
    if (!q) return indexed
    const starts = indexed.filter((o) => o.short.startsWith(q) || o.key.startsWith(q))
    const contains = indexed.filter((o) => !starts.includes(o) && o.key.includes(q))
    return [...starts, ...contains]
  }, [indexed, query])

  function choose(o) {
    onSelect(o)
    setQuery(null)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (filtered[active]) choose(filtered[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(null)
    }
  }

  return (
    <div className="addr-combobox">
      <input
        ref={inputRef}
        className={inputClassName}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query ?? value}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={(e) => {
          e.target.select()
          setOpen(true)
        }}
        // Bỏ gõ dở: quay về giá trị đã chọn để không lưu chữ không có trong danh sách.
        onBlur={() => {
          setOpen(false)
          setQuery(null)
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && (
        <ul id={listId} role="listbox" className="addr-combobox-list">
          {filtered.length === 0 && <li className="addr-combobox-empty">Không tìm thấy</li>}
          {filtered.map((o, i) => (
            <li
              key={o.code}
              role="option"
              aria-selected={o.name === value}
              className={i === active ? 'active' : undefined}
              // onMouseDown (không phải onClick) để chọn được trước khi ô nhập mất focus
              onMouseDown={(e) => {
                e.preventDefault()
                choose(o)
              }}
              onMouseEnter={() => setActive(i)}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
