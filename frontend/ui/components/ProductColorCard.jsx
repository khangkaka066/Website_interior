'use client'

import { useState } from 'react'
import { Link } from '@/lib/router'
import WishlistButton from './WishlistButton'
import PriceOld from './PriceOld'

const MAX_SWATCHES = 8

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

// Ảnh gốc của Shopee ~900KB, bản "_tn" ~24KB: ô màu chỉ cần bản nhỏ nên trang không nặng thêm.
function swatchSrc(url) {
  return /^https:\/\/cf\.shopee\.vn\/file\/[\w-]+$/.test(url) ? `${url}_tn` : url
}

// Nhóm tùy chọn đầu tiên có ảnh theo từng giá trị (thường là "Màu Sắc"), giống cách trang chi tiết sản phẩm chọn ảnh chính.
function colorOption(product) {
  const opt = product.options?.[0]
  if (!opt?.images) return null
  const values = (opt.values || []).filter((v) => opt.images[v])
  return values.length > 1 ? { name: opt.name, values, images: opt.images } : null
}

// Thẻ sản phẩm ở trang chủ: rê chuột vào thì thẻ nở ra một chút, hiện các màu; bấm một màu để đổi ảnh ngay trên thẻ
// mà không phải mở trang sản phẩm (phần còn lại của thẻ vẫn là link tới trang sản phẩm).
export default function ProductColorCard({ product: p }) {
  const colors = colorOption(p)
  const [picked, setPicked] = useState(null)
  const image = (picked && colors?.images[picked]) || p.image
  const isColor = /màu/i.test(colors?.name || '')

  return (
    <Link className={`product-card ${colors ? 'has-colors' : ''}`} to={`/products/${p.id}`}>
      <div className="product-thumb">
        <img key={image} className={picked ? 'swatch-swap' : undefined} src={image} alt={p.name} loading="lazy" />
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

      {colors && (
        <div className="product-card-more">
          <span className="swatch-label">
            {picked || `${colors.values.length} ${isColor ? 'màu' : 'lựa chọn'}`}
          </span>
          <div className="swatch-row">
            {colors.values.slice(0, MAX_SWATCHES).map((v) => (
              <button
                key={v}
                type="button"
                className="swatch"
                aria-label={`${colors.name}: ${v}`}
                aria-pressed={picked === v}
                title={v}
                // Tải sẵn ảnh lớn lúc rê chuột/focus để bấm vào là đổi ảnh ngay, không nháy.
                onMouseEnter={() => {
                  new Image().src = colors.images[v]
                }}
                onFocus={() => {
                  new Image().src = colors.images[v]
                }}
                // Thẻ là link: chặn để bấm ô màu không chuyển sang trang sản phẩm. Bấm lại màu đang chọn thì về ảnh gốc.
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPicked((cur) => (cur === v ? null : v))
                }}
              >
                <img src={swatchSrc(colors.images[v])} alt="" loading="lazy" />
              </button>
            ))}
            {colors.values.length > MAX_SWATCHES && <span className="swatch-more">+{colors.values.length - MAX_SWATCHES}</span>}
          </div>
        </div>
      )}
    </Link>
  )
}
