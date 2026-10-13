'use client'

import { useState } from 'react'
import { Link } from '@/lib/router'
import WishlistButton from './WishlistButton'
import PriceOld from './PriceOld'

const MAX_IMAGES = 4

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

// Thẻ sản phẩm ở trang chủ: bằng chuột (laptop/PC) rê ngang qua ảnh để xem các ảnh khác của sản phẩm, rời chuột thì về ảnh đầu.
// Ảnh phụ chỉ được tải khi khách rê tới (mỗi ảnh gốc ~900KB nên không tải sẵn). Màn hình cảm ứng giữ nguyên thẻ như cũ.
export default function ProductHoverCard({ product: p }) {
  const gallery = [...new Set([p.image, ...(p.images || [])].filter(Boolean))].slice(0, MAX_IMAGES)
  const [active, setActive] = useState(0)
  const [seen, setSeen] = useState(() => new Set([0])) // chỉ dựng ảnh đã rê tới
  const multi = gallery.length > 1

  function show(i) {
    setActive(i)
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)))
  }

  function onPointerMove(e) {
    if (!multi || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.min(gallery.length - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * gallery.length)))
    if (i !== active) show(i)
  }

  return (
    <Link className="product-card" to={`/products/${p.id}`}>
      <div
        className="product-thumb"
        onPointerEnter={(e) => {
          if (multi && e.pointerType === 'mouse') setSeen((s) => (s.has(1) ? s : new Set(s).add(1))) // tải sẵn ảnh thứ hai ngay khi chuột vào
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(0)}
      >
        <img src={gallery[0] || p.image} alt={p.name} loading="lazy" />
        {gallery.slice(1).map((src, k) => {
          const i = k + 1
          return seen.has(i) && <img key={src} className={`thumb-alt ${active === i ? 'thumb-alt-on' : ''}`} src={src} alt="" aria-hidden="true" />
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
