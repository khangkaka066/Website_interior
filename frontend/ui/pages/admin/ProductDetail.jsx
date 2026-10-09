'use client'

import { useParams, useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import ProductStatusBadge from '../../components/dashboard/products/ProductStatusBadge'
import { getProduct, duplicateProduct, toggleVisibility, getCategories } from '../../data/adminProducts'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = getProduct(id)
  const categories = getCategories()

  if (!product) {
    return (
      <AdminLayout activeNav="products" pageTitle="Lỗi">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>Không tìm thấy sản phẩm.</p>
          <button className="dash-btn" onClick={() => navigate('/dashboard/products')}>
            Quay lại danh sách
          </button>
        </div>
      </AdminLayout>
    )
  }

  function handleDuplicate() {
    const copy = duplicateProduct(id)
    if (copy) {
      window.alert('Đã nhân bản sản phẩm')
      navigate(`/dashboard/products/${copy.id}/edit`)
    }
  }

  function handleToggleVisibility() {
    toggleVisibility(id)
    window.location.reload()
  }

  const categoryName = categories.find((c) => c.id === product.categoryId)?.name || '—'
  const formatPrice = (n) => (n ? n.toLocaleString('vi-VN') + 'đ' : '—')
  const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN')

  const canShowDuplicateBtn = product.status !== 'draft'
  const toggleLabel = product.status === 'draft' ? 'Ẩn' : product.status === 'hidden' ? 'Hiện' : 'Ẩn'

  return (
    <AdminLayout activeNav="products" pageTitle={product.name}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--dash-heading)' }}>{product.name}</h2>
          <ProductStatusBadge product={product} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="dash-btn" onClick={() => navigate(`/dashboard/products/${id}/edit`)}>
            Chỉnh sửa
          </button>
          {canShowDuplicateBtn && (
            <button className="dash-btn dash-btn-ghost" onClick={handleDuplicate}>
              Nhân bản
            </button>
          )}
          <button className="dash-btn dash-btn-ghost" onClick={handleToggleVisibility}>
            {toggleLabel} sản phẩm
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Thông tin sản phẩm</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            <div>
              <strong>SKU:</strong> {product.sku}
            </div>
            <div>
              <strong>Danh mục:</strong> {categoryName}
            </div>
            {product.brand && (
              <div>
                <strong>Thương hiệu:</strong> {product.brand}
              </div>
            )}
            {product.shortDescription && (
              <div>
                <strong>Mô tả ngắn:</strong> {product.shortDescription}
              </div>
            )}
            {product.description && (
              <div>
                <strong>Mô tả:</strong> {product.description}
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div>
                <strong>Tags:</strong> {product.tags.join(', ')}
              </div>
            )}
            <div>
              <strong>Tạo lúc:</strong> {formatDate(product.createdAt)} bởi {product.updatedBy}
            </div>
            <div>
              <strong>Cập nhật:</strong> {formatDate(product.updatedAt)} bởi {product.updatedBy}
            </div>
          </div>
        </div>

        <div className="dash-card">
          <h3 className="form-card-title">Giá & Kho</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            <div>
              <strong>Giá bán:</strong> {formatPrice(product.price)}
            </div>
            {product.costPrice && (
              <div>
                <strong>Giá nhập:</strong> {formatPrice(product.costPrice)}
              </div>
            )}
            {product.salePrice && (
              <div>
                <strong>Giá khuyến mãi:</strong> {formatPrice(product.salePrice)}
              </div>
            )}
            {product.saleStartAt && (
              <div>
                <strong>Bắt đầu KM:</strong> {formatDate(product.saleStartAt)}
              </div>
            )}
            {product.saleEndAt && (
              <div>
                <strong>Kết thúc KM:</strong> {formatDate(product.saleEndAt)}
              </div>
            )}
            <div>
              <strong>Tồn kho:</strong> {product.stock}
            </div>
            <div>
              <strong>Cảnh báo:</strong> {product.lowStockThreshold}
            </div>
          </div>
        </div>
      </div>

      {product.images && product.images.length > 0 && (
        <div className="dash-card" style={{ marginTop: '24px' }}>
          <h3 className="form-card-title">Hình ảnh</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
            {product.images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img
                  src={img}
                  alt={`img-${idx}`}
                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0', border: '1px solid var(--dash-border)' }}
                />
                {idx === 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      background: 'var(--dash-primary)',
                      color: '#fff',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '0',
                    }}
                  >
                    Đại diện
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {product.hasVariants && product.variants && product.variants.length > 0 && (
        <div className="dash-card" style={{ marginTop: '24px' }}>
          <h3 className="form-card-title">Biến thể sản phẩm</h3>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Tổ hợp</th>
                <th>SKU</th>
                <th>Giá</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td>{v.sku || '—'}</td>
                  <td>{v.price || '—'}</td>
                  <td>{v.stock}</td>
                  <td>{v.status === 'active' ? 'Đang bán' : 'Hết hàng'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(product.sold !== undefined || product.sold !== null) && (
        <div className="dash-card" style={{ marginTop: '24px' }}>
          <h3 className="form-card-title">Thống kê bán hàng</h3>
          <span className="dash-tag">số liệu minh họa</span>
          <div style={{ fontSize: '13px', lineHeight: '1.8', marginTop: '8px' }}>
            <div>
              <strong>Đã bán:</strong> {product.sold}
            </div>
            <div>
              <strong>Doanh thu ước tính:</strong> {formatPrice((product.sold || 0) * product.price)}
            </div>
          </div>
        </div>
      )}

      {product.rating && (
        <div className="dash-card" style={{ marginTop: '24px' }}>
          <h3 className="form-card-title">Đánh giá</h3>
          <div style={{ fontSize: '13px' }}>
            <strong>★ {product.rating}</strong>
          </div>
        </div>
      )}

      {product.shipping && Object.values(product.shipping).some((v) => v) && (
        <div className="dash-card" style={{ marginTop: '24px' }}>
          <h3 className="form-card-title">Thông tin vận chuyển</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {product.shipping.weight && (
              <div>
                <strong>Khối lượng:</strong> {product.shipping.weight} kg
              </div>
            )}
            {product.shipping.length && (
              <div>
                <strong>Kích thước:</strong> {product.shipping.length} x {product.shipping.width} x {product.shipping.height} cm
              </div>
            )}
            {product.shipping.type && (
              <div>
                <strong>Loại vận chuyển:</strong> {product.shipping.type}
              </div>
            )}
          </div>
        </div>
      )}

      {product.seo && (Object.values(product.seo).some((v) => v)) && (
        <div className="dash-card" style={{ marginTop: '24px' }}>
          <h3 className="form-card-title">SEO</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {product.seo.slug && (
              <div>
                <strong>Slug:</strong> {product.seo.slug}
              </div>
            )}
            {product.seo.metaTitle && (
              <div>
                <strong>Meta title:</strong> {product.seo.metaTitle}
              </div>
            )}
            {product.seo.metaDescription && (
              <div>
                <strong>Meta description:</strong> {product.seo.metaDescription}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
