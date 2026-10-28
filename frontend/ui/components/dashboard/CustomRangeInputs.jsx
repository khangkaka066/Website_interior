'use client'

import { useState } from 'react'

const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// Trạng thái hai ngày "Từ – Đến" (mặc định hôm nay); chọn lệch thì ô còn lại tự theo.
export function useCustomDates() {
  const today = localToday()
  const [dates, setDates] = useState({ from: today, to: today })
  const setDate = (key, value) =>
    setDates((d) => {
      const next = { ...d, [key]: value }
      if (next.from > next.to) next[key === 'from' ? 'to' : 'from'] = value
      return next
    })
  return [dates, setDate, today]
}

export default function CustomRangeInputs({ dates, setDate, max }) {
  return (
    <span className="range-custom">
      <input type="date" aria-label="Từ ngày" value={dates.from} max={max} onChange={(e) => e.target.value && setDate('from', e.target.value)} />
      <span>–</span>
      <input type="date" aria-label="Đến ngày" value={dates.to} max={max} onChange={(e) => e.target.value && setDate('to', e.target.value)} />
    </span>
  )
}
