'use client'

import { useEffect, useRef, useState } from 'react'

const SRC = '/videos/curtain-fabric.mp4'
const POSTER = '/videos/curtain-fabric-poster.webp'

// Video giới thiệu vải rèm trong khung viền vàng trang trí. Để trang chủ nhẹ: video chỉ được tải khi khách cuộn tới gần, tự phát (tắt tiếng, lặp)
// khi nằm trong màn hình và tự dừng khi cuộn đi chỗ khác. Khách KHÔNG có nút dừng; chỉ có nút bật/tắt tiếng. Nút phát ▶ chỉ hiện khi video không tự phát được
// (khách bật "giảm chuyển động" trong hệ điều hành, hoặc trình duyệt chặn tự phát) để vẫn có cách xem.
export default function HeroVideo() {
  const wrap = useRef(null)
  const video = useRef(null)
  const [load, setLoad] = useState(false) // đã tới gần: bắt đầu tải video
  const [needsTap, setNeedsTap] = useState(false) // không tự phát được: hiện nút ▶
  const [muted, setMuted] = useState(true)
  const [reduced, setReduced] = useState(false)

  // Phát video; trình duyệt chặn thì chuyển sang chế độ chờ khách bấm ▶.
  function tryPlay() {
    const v = video.current
    if (!v) return
    v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true))
  }

  // Tự phát chỉ khi khách không bật "giảm chuyển động". Đọc thiết lập ngay lúc phát (không dùng state) để tránh phát nhầm trước khi state kịp cập nhật.
  const prefersReduced = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  function autoPlay() {
    if (!prefersReduced()) tryPlay()
  }

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const r = Boolean(mq?.matches)
    setReduced(r)
    setNeedsTap(r)
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
          if (v && v.paused) autoPlay()
        } else if (v && !v.paused) {
          v.pause()
        }
      },
      { rootMargin: '200px 0px', threshold: [0, 0.35] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Vừa đặt nguồn video (khách cuộn tới gần): phát ngay. Gọi play() sau khi đã có src mới tải được dữ liệu dù preload="none"; gọi trước đó (lúc chưa có src)
  // thì không có tác dụng và video đứng yên cho tới khi khách cuộn thêm.
  useEffect(() => {
    const v = video.current
    if (!load || !v) return
    const r = wrap.current?.getBoundingClientRect()
    const visible = r && r.top < window.innerHeight && r.bottom > 0
    if (visible) autoPlay()
  }, [load])

  function playNow() {
    const v = video.current
    if (!v) return
    setLoad(true)
    tryPlay()
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
            onPlay={() => setNeedsTap(false)}
            aria-label="Video vải rèm buông rủ dưới ánh sáng tự nhiên"
          />
          <div className="hv-controls">
            {needsTap && (
              <button type="button" onClick={playNow} aria-label="Phát video">
                ▶
              </button>
            )}
            <button type="button" onClick={toggleMute} aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
