'use client'

import { useEffect, useRef, useState } from 'react'

const SRC = '/videos/curtain-fabric.mp4'
const POSTER = '/videos/curtain-fabric-poster.webp'

// Video giới thiệu vải rèm trong khung viền vàng trang trí. Để trang chủ nhẹ: video chỉ được tải khi khách cuộn tới gần, tự phát (tắt tiếng, lặp)
// khi nằm trong màn hình và tự dừng khi cuộn đi chỗ khác. Khách bật "giảm chuyển động" trong hệ điều hành thì không tự phát (có nút phát).
export default function HeroVideo() {
  const wrap = useRef(null)
  const video = useRef(null)
  const [load, setLoad] = useState(false) // đã tới gần: bắt đầu tải video
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    setReduced(Boolean(mq?.matches))
  }, [])

  useEffect(() => {
    const el = wrap.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setLoad(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = video.current
        if (entry.isIntersecting) {
          setLoad(true)
          if (v && !reduced && v.paused && !v.dataset.userPaused) v.play().catch(() => {}) // trình duyệt chặn tự phát: để khách bấm nút
        } else if (v && !v.paused) {
          v.pause()
        }
      },
      { rootMargin: '200px 0px', threshold: [0, 0.35] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  // Video vừa tải xong dữ liệu đầu: phát nếu đang trong màn hình.
  function onLoadedData() {
    const v = video.current
    const r = wrap.current?.getBoundingClientRect()
    const visible = r && r.top < window.innerHeight && r.bottom > 0
    if (v && visible && !reduced && !v.dataset.userPaused) v.play().catch(() => {})
  }

  function togglePlay() {
    const v = video.current
    if (!v) return
    if (v.paused) {
      delete v.dataset.userPaused
      v.play().catch(() => {})
    } else {
      v.dataset.userPaused = '1' // khách chủ động dừng: không tự phát lại khi cuộn qua
      v.pause()
    }
  }

  function toggleMute() {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  return (
    <section className="hero-video" ref={wrap} aria-label="Video giới thiệu vải rèm">
      <span className="hero-eyebrow">XEM VẢI RÈM THỰC TẾ</span>
      <div className="hv-frame">
        <span className="hv-corner hv-tl" aria-hidden="true" />
        <span className="hv-corner hv-tr" aria-hidden="true" />
        <span className="hv-corner hv-bl" aria-hidden="true" />
        <span className="hv-corner hv-br" aria-hidden="true" />
        <div className="hv-mat">
          <video
            ref={video}
            className="hv-video"
            poster={POSTER}
            src={load ? SRC : undefined}
            muted
            loop
            playsInline
            preload="none"
            onLoadedData={onLoadedData}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            aria-label="Video vải rèm buông rủ dưới ánh sáng tự nhiên"
          />
          <div className="hv-controls">
            <button type="button" onClick={togglePlay} aria-label={playing ? 'Tạm dừng video' : 'Phát video'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
