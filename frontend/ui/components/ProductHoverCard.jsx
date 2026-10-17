'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/router'
import WishlistButton from './WishlistButton'
import PriceOld from './PriceOld'
import RatingStars from './RatingStars'
import { useRatings } from '../data/ratings'
import { sized, IMG } from '../utils/image'

const MAX_IMAGES = 4
const SWITCH_DELAY_MS = 220 // chuột phải dừng ở một vùng ảnh chừng này mới đổi ảnh: lướt nhanh qua không làm ảnh nháy liên tục

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

// Thẻ sản phẩm ở trang chủ: bằng chuột (laptop/PC) rê ngang qua ảnh để xem các ảnh khác của sản phẩm, rời chuột thì về ảnh đầu.
// Ảnh phụ chỉ được tải khi khách rê tới (mỗi ảnh gốc ~900KB nên không tải sẵn). Màn hình cảm ứng giữ nguyên thẻ như cũ.
export default function ProductHoverCard({ product: p }) {
  const gallery = [...new Set([p.image, ...(p.images || [])].filter(Boolean))].slice(0, MAX_IMAGES)
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState(false) // đã rê chuột vào thẻ: từ lúc này mới dựng các ảnh phụ
  const timer = useRef(null)
  const multi = gallery.length > 1
  const rating = useRatings()[p.id]

  useEffect(() => () => clearTimeout(timer.current), [])

  function goTo(i) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setActive(i), SWITCH_DELAY_MS)
  }

  function onPointerMove(e) {
    if (!multi || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.min(gallery.length - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * gallery.length)))
    goTo(i)
  }

  return (
    <Link className="product-card" to={`/products/${p.id}`}>
      <div
        className="product-thumb"
        onPointerEnter={(e) => {
          if (multi && e.pointerType === 'mouse') setArmed(true) // tải sẵn các ảnh phụ (bản nhỏ ~40KB) để chuyển ảnh mượt, không bị trống
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          clearTimeout(timer.current)
          setActive(0)
        }}
      >
        <img src={sized(gallery[0] || p.image, IMG.card)} alt={p.name} loading="lazy" decoding="async" />
        {gallery.slice(1).map((src, k) => {
          const i = k + 1
          return armed && <img key={src} className={`thumb-alt ${active === i ? 'thumb-alt-on' : ''}`} src={sized(src, IMG.card)} alt="" aria-hidden="true" />
        })}
        {multi && (
          <span className="thumb-dots" aria-hidden="true">
            {gallery.map((src, i) => (
              <i key={src} className={active === i ? 'on' : undefined} />
            ))}
          </span>
        )}
        <WishlistButton productId={p.id} />
      </div>
      <h4>{p.name}</h4>
      <RatingStars rating={rating} />
      <div className="product-meta">
        <span className="price">
          {p.priceMax ? 'Từ ' : ''}
          {formatPrice(p.price)}
          <PriceOld product={p} />
        </span>
      </div>
    </Link>
  )
}
