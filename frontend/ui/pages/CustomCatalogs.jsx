'use client'

import { useState } from 'react'
import { CATALOGS } from '../data/catalogs'
import CatalogFlipBook from '../components/CatalogFlipBook'

// Trang "Đặt riêng": khách xem catalog mẫu (không phải sản phẩm bán sẵn trong kho) rồi liên hệ đặt làm theo đúng kích thước/màu mình cần.
export default function CustomCatalogs() {
  const [openSlug, setOpenSlug] = useState(null)
  const open = CATALOGS.find((c) => c.slug === openSlug) || null

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Đặt riêng theo yêu cầu</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Xem catalog mẫu màn/rèm dưới đây, bấm vào để lật từng trang như xem sách. Chọn được mẫu ưng ý rồi liên hệ chúng tôi để đặt làm riêng theo
        đúng kích thước, màu và chất liệu bạn cần.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {CATALOGS.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setOpenSlug(c.slug)}
            className="group overflow-hidden rounded-xl border border-line bg-white text-left shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-[4/3] overflow-hidden bg-gray-100">
              <img src={c.pages[0]} alt={c.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
            </div>
            <div className="p-5">
              <h2 className="font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-muted">{c.description}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-accent">Xem catalog ({c.pages.length} trang) →</span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        Cần tư vấn mẫu, kích thước hoặc giá?{' '}
        <a href="/contact" className="font-semibold text-accent underline">
          Liên hệ chúng tôi
        </a>
        .
      </p>

      {open && <CatalogFlipBook catalog={open} onClose={() => setOpenSlug(null)} />}
    </div>
  )
}
