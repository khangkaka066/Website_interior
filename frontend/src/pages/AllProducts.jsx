import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { products, categories } from '../data/shop'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

const COLLECTIONS = [
  { id: 'new', label: 'Mới về' },
  { id: 'best', label: 'Bán chạy' },
  { id: 'sale', label: 'Đang giảm giá' },
  { id: 'latest', label: 'Mới nhất' },
]

const PRICE_RANGES = [
  { id: 'under100', label: 'Dưới 100.000đ', test: (p) => p.price < 100000 },
  { id: '100-250', label: '100.000đ – 250.000đ', test: (p) => p.price >= 100000 && p.price <= 250000 },
  { id: 'over250', label: 'Trên 250.000đ', test: (p) => p.price > 250000 },
]

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Liên quan' },
  { id: 'newest', label: 'Mới nhất' },
  { id: 'price-asc', label: 'Giá tăng dần' },
  { id: 'price-desc', label: 'Giá giảm dần' },
  { id: 'bestselling', label: 'Bán chạy nhất' },
]

export default function AllProducts() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category')
  const [collectionFilters, setCollectionFilters] = useState(new Set())
  const [categoryFilters, setCategoryFilters] = useState(
    initialCategory ? new Set([initialCategory]) : new Set(),
  )
  const [typeFilters, setTypeFilters] = useState(new Set())
  const [priceFilter, setPriceFilter] = useState('')
  const [sortBy, setSortBy] = useState('relevance')

  const types = useMemo(() => [...new Set(products.map((p) => p.type))], [])

  function toggleFilter(setFn, current, value) {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setFn(next)
  }

  const activeFilterCount = collectionFilters.size + categoryFilters.size + typeFilters.size + (priceFilter ? 1 : 0)

  function clearFilters() {
    setCollectionFilters(new Set())
    setCategoryFilters(new Set())
    setTypeFilters(new Set())
    setPriceFilter('')
  }

  const filtered = useMemo(() => {
    let result = products

    if (collectionFilters.size > 0) {
      result = result.filter((p) => {
        if (collectionFilters.has('sale') && p.discount > 0) return true
        return collectionFilters.has(p.tab)
      })
    }
    if (categoryFilters.size > 0) {
      result = result.filter((p) => categoryFilters.has(p.categoryId))
    }
    if (typeFilters.size > 0) {
      result = result.filter((p) => typeFilters.has(p.type))
    }
    if (priceFilter) {
      const range = PRICE_RANGES.find((r) => r.id === priceFilter)
      if (range) result = result.filter(range.test)
    }

    result = [...result]
    if (sortBy === 'newest') result.sort((a, b) => (a.tab === 'new' ? -1 : 1) - (b.tab === 'new' ? -1 : 1))
    else if (sortBy === 'price-asc') result.sort((a, b) => a.price - b.price)
    else if (sortBy === 'price-desc') result.sort((a, b) => b.price - a.price)
    else if (sortBy === 'bestselling') result.sort((a, b) => (b.tab === 'best' ? 1 : 0) - (a.tab === 'best' ? 1 : 0))

    return result
  }, [collectionFilters, categoryFilters, typeFilters, priceFilter, sortBy])

  return (
    <>
      <Header />
      <main>
        <section className="shop-all">
          <div className="shop-all-hero container">
            <div className="shop-all-hero-text">
              <h1>Tất cả sản phẩm</h1>
              <p>Rèm cửa và phụ kiện phối hợp hài hòa cho mọi không gian sống.</p>
            </div>
            <div className="shop-all-hero-image">
              <img src="/images/curtains/room-sheer-white.png" alt="Không gian phòng khách với rèm Clevinum" />
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

              <FilterGroup title="Bộ sưu tập">
                {COLLECTIONS.map((c) => (
                  <FilterCheckbox
                    key={c.id}
                    label={c.label}
                    checked={collectionFilters.has(c.id)}
                    onChange={() => toggleFilter(setCollectionFilters, collectionFilters, c.id)}
                  />
                ))}
              </FilterGroup>

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
            </aside>

            <div className="shop-all-results">
              <div className="shop-all-toolbar">
                <span className="all-products-sub">{filtered.length} sản phẩm từ Clevinum</span>
                <select className="shop-all-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      Sắp xếp: {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {filtered.length === 0 ? (
                <p className="shop-all-empty">Không tìm thấy sản phẩm phù hợp bộ lọc.</p>
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
                      {p.discount >= 40 ? (
                        <span className="badge badge-discount card-badge">-{p.discount}%</span>
                      ) : p.tab === 'new' ? (
                        <span className="badge badge-green card-badge">MỚI</span>
                      ) : null}
                      <div className="product-thumb">
                        <img src={p.image} alt={p.name} />
                      </div>
                      <span className="product-type">{p.type}</span>
                      <h4>{p.name}</h4>
                      <div className="product-meta">
                        <span className="price">{formatPrice(p.price)}</span>
                        <span className="rating">
                          ★ {p.rating} · {p.sold} đã bán
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
      <Footer />
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
