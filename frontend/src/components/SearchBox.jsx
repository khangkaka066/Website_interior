import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProducts } from '../data/liveProducts'
import { buildIndex, suggest } from '../data/smartSearch'

const formatPrice = (n) => n.toLocaleString('vi-VN') + 'đ'

// Ô tìm kiếm có gợi ý ngay khi gõ: sản phẩm, danh mục, từ khóa; tự hiểu gõ sai chính tả và từ đồng nghĩa.
export default function SearchBox() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(urlQuery)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef(null)
  const products = useProducts()
  const index = useMemo(() => buildIndex(products), [products])
  const sug = useMemo(() => (query.trim() ? suggest(index, query) : null), [index, query])

  // Ô luôn khớp với ?q= trên địa chỉ (bấm "Xóa tìm kiếm" hoặc quay lại thì ô tự đổi theo).
  useEffect(() => setQuery(urlQuery), [urlQuery])

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Các dòng bấm được, theo thứ tự hiển thị (để dùng phím ↑ ↓ Enter).
  const rows = []
  if (sug) {
    sug.keywords.forEach((k) => rows.push({ kind: 'kw', label: k, go: () => goSearch(k) }))
    sug.categories.forEach((c) => rows.push({ kind: 'cat', label: c.name, go: () => go(`/products?category=${c.id}`) }))
    sug.products.forEach((p) => rows.push({ kind: 'p', product: p, go: () => go(`/products/${p.id}`) }))
  }

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  function goSearch(text) {
    const q = text.trim()
    setQuery(q)
    go(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  function onSubmit(e) {
    e.preventDefault()
    if (active >= 0 && rows[active]) rows[active].go()
    else goSearch(query)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (rows.length ? (a + 1) % rows.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (rows.length ? (a <= 0 ? rows.length - 1 : a - 1) : -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showPanel = open && query.trim()
  let n = -1 // chỉ số dòng đang vẽ, khớp với mảng rows

  return (
    <div className="search-box" ref={boxRef}>
      <form className="search-bar" role="search" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Tìm rèm bạn cần..."
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={!!showPanel}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" aria-label="Tìm kiếm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.2" stroke="white" strokeWidth="1.6" />
            <line x1="11" y1="11" x2="15" y2="15" stroke="white" strokeWidth="1.6" />
          </svg>
        </button>
      </form>

      {showPanel && sug && (
        <div className="search-suggest" role="listbox">
          {sug.correctedQuery && (
            <button type="button" className="ss-did-you-mean" onClick={() => goSearch(sug.correctedQuery)}>
              Có phải bạn muốn tìm: <strong>{sug.correctedQuery}</strong>?
            </button>
          )}

          {sug.keywords.length > 0 && (
            <div className="ss-group">
              <span className="ss-title">Từ khóa</span>
              {sug.keywords.map((k) => {
                const i = ++n
                return (
                  <button type="button" key={k} className={`ss-row ${active === i ? 'ss-active' : ''}`} onClick={() => goSearch(k)}>
                    🔍 {k}
                  </button>
                )
              })}
            </div>
          )}

          {sug.categories.length > 0 && (
            <div className="ss-group">
              <span className="ss-title">Danh mục</span>
              {sug.categories.map((c) => {
                const i = ++n
                return (
                  <button type="button" key={c.id} className={`ss-row ${active === i ? 'ss-active' : ''}`} onClick={() => go(`/products?category=${c.id}`)}>
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}

          {sug.products.length > 0 ? (
            <div className="ss-group">
              <span className="ss-title">Sản phẩm</span>
              {sug.products.map((p) => {
                const i = ++n
                return (
                  <button type="button" key={p.id} className={`ss-row ss-product ${active === i ? 'ss-active' : ''}`} onClick={() => go(`/products/${p.id}`)}>
                    <img src={p.image} alt="" loading="lazy" />
                    <span className="ss-name">{p.name}</span>
                    <span className="ss-price">
                      {p.priceMax ? 'Từ ' : ''}
                      {formatPrice(p.price)}
                    </span>
                  </button>
                )
              })}
              {sug.total > sug.products.length && (
                <button type="button" className="ss-all" onClick={() => goSearch(query)}>
                  Xem tất cả {sug.total} kết quả
                </button>
              )}
            </div>
          ) : (
            <div className="ss-empty">
              Chưa thấy sản phẩm khớp “{query.trim()}”.{' '}
              <button type="button" onClick={() => goSearch(query)}>
                Xem gợi ý khác
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
