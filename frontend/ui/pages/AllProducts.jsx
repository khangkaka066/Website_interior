'use client'

import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/router'
import { categories } from '../data/shop'
import { useProducts } from '../data/liveProducts'
import WishlistButton from '../components/WishlistButton'
import { buildIndex, searchProducts, COLOR_FILTERS, WIDTH_FILTERS, POPULAR_KEYWORDS } from '../data/smartSearch'
import { CATEGORY_NOTES } from '../data/menu'
import { useShopInfo } from '../useShopInfo'
import PriceOld from '../components/PriceOld'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

const PRICE_RANGES = [
  { id: 'under100', label: 'Dưới 100.000đ', test: (p) => p.price < 100000 },
  { id: '100-250', label: '100.000đ – 250.000đ', test: (p) => p.price >= 100000 && p.price <= 250000 },
  { id: 'over250', label: 'Trên 250.000đ', test: (p) => p.price > 250000 },
]

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Liên quan' },
  { id: 'price-asc', label: 'Giá tăng dần' },
  { id: 'price-desc', label: 'Giá giảm dần' },
  { id: 'newest', label: 'Mới nhất' },
  { id: 'bestseller', label: 'Bán chạy nhất' },
]

export default function AllProducts() {
  const products = useProducts()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category')
  const searchQuery = (searchParams.get('q') || '').trim()
  // Trang kết quả tìm kiếm không cho Google lập chỉ mục (vô số biến thể trùng nội dung).
  const [categoryFilters, setCategoryFilters] = useState(
    initialCategory ? new Set([initialCategory]) : new Set(),
  )
  useEffect(() => {
    setCategoryFilters(initialCategory ? new Set([initialCategory]) : new Set())
    window.scrollTo(0, 0)
  }, [initialCategory])
  const [typeFilters, setTypeFilters] = useState(new Set())
  const [priceFilter, setPriceFilter] = useState('')
  const [colorFilters, setColorFilters] = useState(new Set())
  const [widthFilters, setWidthFilters] = useState(new Set())
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState('relevance')

  const types = useMemo(() => [...new Set(products.map((p) => p.type))], [products])

  function toggleFilter(setFn, current, value) {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setFn(next)
  }

  const { shopInfo } = useShopInfo()
  // Nhóm sản phẩm chưa có sản phẩm nào (sơn tường, bảng hiệu, đồ gỗ...): báo "đang cập nhật" và mời liên hệ thay vì trang trống.
  const onlyCategory = categoryFilters.size === 1 ? [...categoryFilters][0] : null
  const emptyGroup = onlyCategory && !products.some((p) => p.categoryId === onlyCategory) ? categories.find((c) => c.id === onlyCategory) : null

  const activeFilterCount =
    categoryFilters.size + typeFilters.size + colorFilters.size + widthFilters.size + (priceFilter ? 1 : 0) + (inStockOnly ? 1 : 0)

  function clearFilters() {
    setCategoryFilters(new Set())
    setTypeFilters(new Set())
    setPriceFilter('')
    setColorFilters(new Set())
    setWidthFilters(new Set())
    setInStockOnly(false)
  }

  const index = useMemo(() => buildIndex(products), [products])
  const searched = useMemo(() => (searchQuery ? searchProducts(index, searchQuery) : null), [index, searchQuery])

  const filtered = useMemo(() => {
    // Có từ khóa: lấy kết quả đã xếp theo độ liên quan; không thì lấy cả danh mục theo thứ tự gốc.
    let docs = searched ? searched.results.map((r) => r.doc) : index.docs

    if (categoryFilters.size > 0) docs = docs.filter((d) => categoryFilters.has(d.product.categoryId))
    if (typeFilters.size > 0) docs = docs.filter((d) => typeFilters.has(d.product.type))
    if (priceFilter) {
      const range = PRICE_RANGES.find((r) => r.id === priceFilter)
      if (range) docs = docs.filter((d) => range.test(d.product))
    }
    if (colorFilters.size > 0) docs = docs.filter((d) => [...colorFilters].some((c) => d.colors.has(c)))
    if (widthFilters.size > 0) {
      const tests = WIDTH_FILTERS.filter((w) => widthFilters.has(w.id))
      docs = docs.filter((d) => d.widths.some((w) => tests.some((t) => t.test(w))))
    }
    if (inStockOnly) docs = docs.filter((d) => d.inStock)

    const result = docs.map((d) => d.product)
    if (sortBy === 'price-asc') result.sort((a, b) => a.price - b.price)
    else if (sortBy === 'price-desc') result.sort((a, b) => b.price - a.price)
    else if (sortBy === 'newest') result.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    else if (sortBy === 'bestseller') result.sort((a, b) => (b.sold || 0) - (a.sold || 0))

    return result
  }, [index, searched, categoryFilters, typeFilters, priceFilter, colorFilters, widthFilters, inStockOnly, sortBy])

  // Trang không có kết quả: gợi ý sản phẩm bán chạy / phổ biến (mỗi danh mục một sản phẩm đầu tiên) thay vì để trống.
  const popular = useMemo(() => {
    const ranked = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0))
    const seen = new Set()
    const picks = []
    for (const p of ranked) {
      if (seen.has(p.categoryId)) continue
      seen.add(p.categoryId)
      picks.push(p)
    }
    return picks.slice(0, 4)
  }, [products])

  return (
    <>
      <main>
        <section className="shop-all">
          <div className="shop-all-hero container">
            <div className="shop-all-hero-text">
              <h1>Tất cả sản phẩm</h1>
              <p>Rèm cửa và phụ kiện phối hợp hài hòa cho mọi không gian sống.</p>
            </div>
            <div className="shop-all-hero-image">
              <img src="/images/curtains/room-sheer-white.webp" alt="Không gian phòng khách với rèm Clevinum" decoding="async" />
            </div>
          </div>

          <div className="shop-all-body container">
            <aside className="shop-all-filters">
              <div className="shop-all-filters-head">
                <span>Bộ lọc ({activeFilterCount})</span>
                {activeFilterCount > 0 && (
                  <button className="shop-all-clear" onClick={clearFilters}>
                    Xóa hết
                  </button>
                )}
              </div>

              <FilterGroup title="Danh mục">
                {categories.map((c) => (
                  <FilterCheckbox
                    key={c.id}
                    label={c.name}
                    checked={categoryFilters.has(c.id)}
                    onChange={() => toggleFilter(setCategoryFilters, categoryFilters, c.id)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Loại sản phẩm">
                {types.map((t) => (
                  <FilterCheckbox
                    key={t}
                    label={t}
                    checked={typeFilters.has(t)}
                    onChange={() => toggleFilter(setTypeFilters, typeFilters, t)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Giá">
                {PRICE_RANGES.map((r) => (
                  <label className="filter-checkbox" key={r.id}>
                    <input
                      type="radio"
                      name="price"
                      checked={priceFilter === r.id}
                      onChange={() => setPriceFilter(priceFilter === r.id ? '' : r.id)}
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </FilterGroup>

              <FilterGroup title="Màu sắc">
                {COLOR_FILTERS.map((c) => (
                  <FilterCheckbox
                    key={c.id}
                    label={c.label}
                    checked={colorFilters.has(c.id)}
                    onChange={() => toggleFilter(setColorFilters, colorFilters, c.id)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Kích thước">
                {WIDTH_FILTERS.map((w) => (
                  <FilterCheckbox
                    key={w.id}
                    label={w.label}
                    checked={widthFilters.has(w.id)}
                    onChange={() => toggleFilter(setWidthFilters, widthFilters, w.id)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Tình trạng">
                <FilterCheckbox label="Chỉ hiện còn hàng" checked={inStockOnly} onChange={() => setInStockOnly(!inStockOnly)} />
              </FilterGroup>
            </aside>

            <div className="shop-all-results">
              <div className="shop-all-toolbar">
                <span className="all-products-sub">
                  {searchQuery
                    ? `${filtered.length} kết quả cho “${searchQuery}”`
                    : `${filtered.length} sản phẩm từ Clevinum`}
                  {searchQuery && (
                    <>
                      {' · '}
                      <Link to="/products">Xóa tìm kiếm</Link>
                    </>
                  )}
                </span>
                <select className="shop-all-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      Sắp xếp: {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {searched?.correctedQuery && (
                <p className="search-corrected">
                  Đang hiển thị kết quả cho <strong>“{searched.correctedQuery}”</strong> (đã sửa chính tả từ “{searchQuery}”).
                </p>
              )}

              {filtered.length === 0 ? (
                <div className="shop-all-empty search-no-results">
                  <h3>
                    {emptyGroup
                      ? `${emptyGroup.name} đang được cập nhật`
                      : searchQuery
                        ? `Không tìm thấy “${searchQuery}”`
                        : 'Không có sản phẩm phù hợp'}
                  </h3>
                  {emptyGroup && (
                    <p>
                      {CATEGORY_NOTES[emptyGroup.id] ? `${CATEGORY_NOTES[emptyGroup.id]}. ` : ''}
                      Nhóm này chưa đăng sản phẩm lên website. Liên hệ để được tư vấn và báo giá trực tiếp:{' '}
                      <a href={`tel:${String(shopInfo.hotline).replace(/\s/g, '')}`}>{shopInfo.hotline}</a> hoặc{' '}
                      <Link to="/contact">gửi yêu cầu cho chúng tôi</Link>.
                    </p>
                  )}
                  <p>
                    {emptyGroup
                      ? ''
                      : activeFilterCount > 0 && searched?.results.length
                      ? 'Có sản phẩm khớp từ khóa nhưng bị bộ lọc loại hết.'
                      : 'Bạn thử gõ ngắn hơn, bỏ dấu, hoặc xem các gợi ý bên dưới nhé.'}
                  </p>
                  {activeFilterCount > 0 && (
                    <button className="btn btn-accent" onClick={clearFilters}>
                      Xóa bộ lọc
                    </button>
                  )}
                  <div className="no-results-chips">
                    {POPULAR_KEYWORDS.map((k) => (
                      <Link key={k} to={`/products?q=${encodeURIComponent(k)}`}>
                        {k}
                      </Link>
                    ))}
                    {categories.map((c) => (
                      <Link key={c.id} to={`/products?category=${c.id}`}>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                  <h4>Sản phẩm được quan tâm</h4>
                  <div className="product-grid product-grid-all">
                    {popular.map((p) => (
                      <Link className="product-card" key={p.id} to={`/products/${p.id}`}>
                        <div className="product-thumb">
                          <img src={p.image} alt={p.name} loading="lazy" />
                        </div>
                        <span className="product-type">{p.type}</span>
                        <h4>{p.name}</h4>
                        <div className="product-meta">
                          <span className="price">
                            {p.priceMax ? 'Từ ' : ''}
                            {formatPrice(p.price)}
                            <PriceOld product={p} />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="product-grid product-grid-all">
                  {filtered.map((p) => (
                    <div
                      className="product-card"
                      key={p.id}
                      onClick={() => navigate(`/products/${p.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="product-thumb">
                        <img src={p.image} alt={p.name} loading="lazy" />
                        <WishlistButton productId={p.id} />
                      </div>
                      <span className="product-type">{p.type}</span>
                      <h4>{p.name}</h4>
                      <div className="product-meta">
                        <span className="price">
                          {p.priceMax ? 'Từ ' : ''}
                          {formatPrice(p.price)}
                          <PriceOld product={p} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

function FilterGroup({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="filter-group">
      <button className="filter-group-head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="filter-group-body">{children}</div>}
    </div>
  )
}

function FilterCheckbox({ label, checked, onChange }) {
  return (
    <label className="filter-checkbox">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  )
}
