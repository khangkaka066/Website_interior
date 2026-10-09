'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Thanh tiến trình mỏng ở đầu trang khi chuyển trang: bấm link nội bộ là chạy ngay (khách thấy có phản hồi), đổi địa chỉ xong thì chạy nốt rồi mờ đi.
// Không chặn thao tác và không che nội dung. Tự dừng sau 8 giây phòng khi chuyển trang lỗi.
export default function TopLoader() {
  const pathname = usePathname()
  const search = useSearchParams()?.toString() || ''
  const [phase, setPhase] = useState('idle') // idle | loading | finishing
  const [width, setWidth] = useState(0)
  const trickle = useRef(null)
  const safety = useRef(null)
  const phaseRef = useRef('idle')
  const finishRef = useRef(() => {})
  phaseRef.current = phase

  useEffect(() => {
    const stop = () => {
      clearInterval(trickle.current)
      clearTimeout(safety.current)
    }
    const start = () => {
      if (phaseRef.current === 'loading') return
      stop()
      setPhase('loading')
      setWidth(12)
      trickle.current = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w)), 200)
      safety.current = setTimeout(finish, 8000)
    }
    const finish = () => {
      stop()
      if (phaseRef.current === 'idle') return
      setWidth(100)
      setPhase('finishing')
      safety.current = setTimeout(() => {
        setPhase('idle')
        setWidth(0)
      }, 350)
    }
    finishRef.current = finish

    const onClick = (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target.closest?.('a[href]')
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      let url
      try {
        url = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }
    // Pha capture: chạy TRƯỚC bộ xử lý của <Link> (Link tự gọi preventDefault khi chuyển trang kiểu SPA, nên pha bubble sẽ tưởng click đã bị chặn).
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      stop()
    }
  }, [])

  // Địa chỉ đổi = trang mới đã sẵn sàng.
  useEffect(() => {
    finishRef.current()
  }, [pathname, search])

  if (phase === 'idle') return null
  return (
    <div className="top-loader" aria-hidden="true" style={{ opacity: phase === 'finishing' ? 0 : 1 }}>
      <div className="top-loader-bar" style={{ width: `${width}%` }} />
    </div>
  )
}
