import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProducts, PRODUCTS_CHANGED_EVENT } from '../../data/adminProducts'
import { buildProductStats } from '../../data/productStats'
import { categories } from '../../data/shop'

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
const priceText = (p) => (p.min === p.max ? money(p.min) : `${money(p.min)} – ${money(p.max)}`)
const categoryName = (id) => categories.find((c) => c.id === id)?.name || '—'
const PAGE = 20

export default function SellingProducts() {
  const navigate = useNavigate()
  // Tính lại khi danh sách sản phẩm đổi (nhập Excel, sửa giá, tab khác lưu).
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener(PRODUCTS_CHANGED_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PRODUCTS_CHANGED_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])
  const stats = useMemo(() => buildProductStats(listProducts()), [version])
  const [view, setView] = useState(stats.groups.length ? 'groups' : 'all')
  const [onlyMismatch, setOnlyMismatch] = useState(false)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE)

  const groupNo = useMemo(() => {
    const map = new Map()
    stats.groups.forEach((g, i) => g.members.forEach((m) => map.set(m.id, i + 1)))
    return map
  }, [stats])

  const groups = onlyMismatch ? stats.groups.filter((g) => g.spread > 0) : stats.groups
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stats.selling.filter((p) => !q || p.name.toLowerCase().includes(q) || p.shopeeId.includes(q))
  }, [stats, search])

  const t = stats.totals

  return (
    <div className="dash-card dash-card-wide selling-products">
      <div className="dash-card-head">
        <h3>Sản phẩm shop đang bán</h3>
        <div className="metric-toggle">
          <button className={`metric-btn ${view === 'groups' ? 'metric-btn-active' : ''}`} onClick={() => setView('groups')}>
            Nhóm trùng / lệch giá
          </button>
          <button className={`metric-btn ${view === 'all' ? 'metric-btn-active' : ''}`} onClick={() => setView('all')}>
            Tất cả sản phẩm
          </button>
        </div>
      </div>
      <span className="dash-tag">thống kê từ kho sản phẩm · nghi trùng = tên gần giống hoặc bán cùng phân loại</span>

      <div className="sp-stats">
        <Stat label="Sản phẩm đang bán" value={t.products.toLocaleString('vi-VN')} />
        <Stat label="Tổng phân loại" value={t.variants.toLocaleString('vi-VN')} />
        <Stat label="Nhóm nghi trùng" value={`${t.duplicateGroups}`} sub={`${t.duplicateProducts} sản phẩm`} warn={t.duplicateGroups > 0} />
        <Stat label="Nhóm lệch giá" value={`${t.priceMismatchGroups}`} warn={t.priceMismatchGroups > 0} />
        {(t.hidden > 0 || t.draft > 0) && <Stat label="Đang ẩn / nháp" value={`${t.hidden} / ${t.draft}`} />}
      </div>

      {view === 'groups' ? (
        <>
          <label className="sp-check">
            <input type="checkbox" checked={onlyMismatch} onChange={(e) => setOnlyMismatch(e.target.checked)} />
            Chỉ hiện nhóm có giá khác nhau
          </label>
          {groups.length === 0 && <p className="dash-empty-state">Không có nhóm sản phẩm trùng nào.</p>}
          {groups.map((g) => (
            <div className="sp-group" key={g.key}>
              <div className="sp-group-head">
                <strong>
                  Nhóm {stats.groups.indexOf(g) + 1} · {g.members.length} sản phẩm giống nhau
                </strong>
                <span>
                  {g.spread > 0 ? (
                    <>
                      Giá thấp nhất từ <b>{money(g.lowest)}</b> đến <b>{money(g.highest)}</b> (chênh {g.spreadPct}%)
                    </>
                  ) : (
                    'Cùng mức giá thấp nhất'
                  )}
                  {g.shared > 0 && (
                    <>
                      {' '}
                      · cùng phân loại nhưng khác giá: <b>{g.mismatched}/{g.shared}</b>
                    </>
                  )}
                </span>
              </div>
              <ProductTable rows={g.members} navigate={navigate} showDiff />
            </div>
          ))}
        </>
      ) : (
        <>
          <input
            className="dash-input sp-search"
            placeholder="Tìm theo tên hoặc mã sản phẩm..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShown(PAGE)
            }}
          />
          <ProductTable rows={filtered.slice(0, shown)} navigate={navigate} groupNo={groupNo} />
          {filtered.length > shown && (
            <button className="dash-btn dash-btn-outline sp-more" onClick={() => setShown(shown + PAGE)}>
              Xem thêm ({filtered.length - shown} sản phẩm)
            </button>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub, warn }) {
  return (
    <div className={`sp-stat ${warn ? 'sp-stat-warn' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      {sub && <em>{sub}</em>}
    </div>
  )
}

function ProductTable({ rows, navigate, showDiff, groupNo }) {
  return (
    <div className="sp-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th style={{ width: '52px' }}></th>
            <th>Sản phẩm</th>
            <th>Mã Shopee</th>
            <th>Danh mục</th>
            <th>Giá</th>
            {showDiff && <th>So với thấp nhất</th>}
            <th>Phân loại</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.image && <img src={p.image} alt="" className="sp-thumb" loading="lazy" />}</td>
              <td className="sp-name">
                {p.name}
                {groupNo?.get(p.id) && <span className="sp-badge">Nhóm {groupNo.get(p.id)}</span>}
              </td>
              <td>{p.shopeeId || p.sku}</td>
              <td>{categoryName(p.categoryId)}</td>
              <td>{priceText(p)}</td>
              {showDiff && (
                <td>
                  {p.diffPct === 0 ? <span className="sp-badge sp-badge-low">Thấp nhất</span> : <span className="sp-badge sp-badge-high">+{p.diffPct}%</span>}
                </td>
              )}
              <td>{p.variantCount || '—'}</td>
              <td>
                <div className="dash-row-actions">
                  <button onClick={() => navigate(`/dashboard/products/${p.id}`)}>Xem</button>
                  <button onClick={() => navigate(`/dashboard/products/${p.id}/edit`)}>Sửa</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
