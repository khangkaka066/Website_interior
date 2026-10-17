'use client'

import { useEffect, useRef } from 'react'

// Số đếm chạy từ 0 lên giá trị thật khi cuộn tới (chạy lại mỗi lần cuộn ra rồi quay vào). Giá trị như "4.9★", "86,5k", "9 năm", "71%":
// phần số đầu được đếm, phần còn lại giữ nguyên. HTML đầu tiên đã có giá trị cuối nên không đổi nội dung khi khách tắt hiệu ứng.
const PATTERN = /^(\d+(?:[.,]\d+)?)(.*)$/

export default function CountUp({ value, duration = 1300 }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    const m = PATTERN.exec(value)
    if (!el || !m || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const comma = m[1].includes(',')
    const target = parseFloat(m[1].replace(',', '.'))
    const decimals = (m[1].split(/[.,]/)[1] || '').length
    const fmt = (n) => (comma ? n.toFixed(decimals).replace('.', ',') : n.toFixed(decimals))
    let raf
    let inView = false

    function run() {
      cancelAnimationFrame(raf)
      const t0 = performance.now()
      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = `${fmt(target * eased)}${m[2]}`
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !inView) {
        inView = true
        run()
      } else if (!e.isIntersecting) {
        inView = false
        cancelAnimationFrame(raf)
        el.textContent = value // ra khỏi màn hình thì trả về giá trị thật, lần vào sau đếm lại
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      el.textContent = value
    }
  }, [value, duration])

  return <span ref={ref} className="count-up">{value}</span>
}
