import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/dashboard/AdminLayout'
import ProductStatusBadge from '../../components/dashboard/products/ProductStatusBadge'
import { listProducts, deleteProduct, duplicateProduct, toggleVisibility, getCategories } from '../../data/adminProducts'

const ITEMS_PER_PAGE = 10

export default function ProductList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const categories = getCategories()
  const allProducts = listProducts()

  const filtered = useMemo(() => {
    let result = allProducts

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }

    if (filterCategory) {
      result = result.filter((p) => p.categoryId === filterCategory)
    }

    if (filterStatus) {
      result = result.filter((p) => {
        if (filterStatus === 'selling') return p.status === 'active' && p.stock > 0
        if (filterStatus === 'outofstock') return p.status === 'active' && p.stock === 0
        if (filterStatus === 'hidden') return p.status === 'hidden'
        if (filterStatus === 'draft') return p.status === 'draft'
        return true
      })
    }

    if (filterStock) {
      result = result.filter((p) => {
        if (filterStock === 'instock') return p.stock > 0
        if (filterStock === 'lowstock') return p.stock > 0 && p.stock <= p.lowStockThreshold
        if (filterStock === 'outofstock') return p.stock === 0
        return true
      })
    }

    if (sortBy === 'latest') {
      result = result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    } else if (sortBy === 'bestselling') {
      result = result.sort((a, b) => b.sold - a.sold)
    } else if (sortBy === 'price-asc') {
      result = result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-desc') {
      result = result.sort((a, b) => b.price - a.price)
    }

    return result
  }, [allProducts, search, filterCategory, filterStatus, filterStock, sortBy])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paged = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  function handleSelectAll(checked) {
    if (checked) {
      setSelectedIds(new Set(paged.map((p) => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  function handleSelectOne(id, checked) {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    setSelectedIds(newSet)
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Xóa ${selectedIds.size} sản phẩm?`)) return
    selectedIds.forEach((id) => deleteProduct(id))
    setSelectedIds(new Set())
    setCurrentPage(1)
  }

  function handleDuplicate(id) {
    const product = duplicateProduct(id)
    if (product) {
      window.alert('Đã nhân bản sản phẩm')
      setCurrentPage(1)
    }
  }

  function handleDelete(id, name) {
    if (!window.confirm(`Xóa sản phẩm "${name}"?`)) return
    deleteProduct(id)
    setCurrentPage(1)
  }

  function handleToggleVisibility(id) {
    toggleVisibility(id)
    setCurrentPage(1)
  }

  const formatPrice = (n) => n?.toLocaleString('vi-VN') + 'đ'
  const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN')
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || '—'
  const getStockClass = (stock, threshold) => {
    if (stock === 0) return 'text-danger'
    if (stock <= threshold) return 'text-warning'
    return ''
  }

  return (
    <AdminLayout activeNav="products" pageTitle="Sản phẩm" headerActions={null}>
      <div className="dash-toolbar">
        <input
          type="text"
          placeholder="Tìm kiếm sản phẩm..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCurrentPage(1)
          }}
          className="dash-input"
        />
        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value)
            setCurrentPage(1)
          }}
          className="dash-select"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value)
            setCurrentPage(1)
          }}
          className="dash-select"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="selling">Đang bán</option>
          <option value="outofstock">Hết hàng</option>
          <option value="hidden">Tạm ẩn</option>
          <option value="draft">Bản nháp</option>
        </select>
        <select
          value={filterStock}
          onChange={(e) => {
            setFilterStock(e.target.value)
            setCurrentPage(1)
          }}
          className="dash-select"
        >
          <option value="">Kho hàng: Tất cả</option>
          <option value="instock">Còn hàng</option>
          <option value="lowstock">Sắp hết</option>
          <option value="outofstock">Hết hàng</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="dash-select">
          <option value="latest">Mới nhất</option>
          <option value="bestselling">Bán chạy nhất</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
        </select>
        <button className="dash-btn" onClick={() => navigate('/dashboard/products/new')}>
          + Thêm sản phẩm
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>Đã chọn {selectedIds.size} sản phẩm</span>
          <button className="btn-delete" onClick={handleDeleteSelected}>
            Xóa đã chọn
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Không tìm thấy sản phẩm nào.</p>
        </div>
      ) : (
        <>
          <div className="dash-card dash-card-wide">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paged.length && paged.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th style={{ width: '60px' }}>Hình ảnh</th>
                  <th>Tên sản phẩm</th>
                  <th>SKU</th>
                  <th>Danh mục</th>
                  <th>Giá</th>
                  <th>Giá KM</th>
                  <th>Tồn kho</th>
                  <th>Đã bán</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        style={{ width: '40px', height: '40px', borderRadius: '0' }}
                      />
                    </td>
                    <td>
                      <a href="#" onClick={() => navigate(`/dashboard/products/${p.id}`)}>
                        {p.name}
                      </a>
                    </td>
                    <td>{p.sku}</td>
                    <td>{getCategoryName(p.categoryId)}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>{p.salePrice ? formatPrice(p.salePrice) : '—'}</td>
                    <td className={getStockClass(p.stock, p.lowStockThreshold)}>
                      {p.stock === 0 ? 'Hết hàng' : `${p.stock}${p.stock <= p.lowStockThreshold ? ' ⚠' : ''}`}
                    </td>
                    <td>{p.sold}</td>
                    <td>
                      <ProductStatusBadge product={p} />
                    </td>
                    <td>{formatDate(p.updatedAt)}</td>
                    <td>
                      <div className="dash-row-actions">
                        <button onClick={() => navigate(`/dashboard/products/${p.id}`)}>Xem</button>
                        <button onClick={() => navigate(`/dashboard/products/${p.id}/edit`)}>Sửa</button>
                        <button onClick={() => handleDuplicate(p.id)}>Nhân bản</button>
                        <button onClick={() => handleToggleVisibility(p.id)}>
                          {p.status === 'draft' ? 'Ẩn' : p.status === 'hidden' ? 'Hiện' : p.stock === 0 ? 'Hiện' : 'Ẩn'}
                        </button>
                        <button onClick={() => handleDelete(p.id, p.name)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`page-btn ${currentPage === page ? 'page-btn-active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
