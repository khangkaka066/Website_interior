import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/dashboard/AdminLayout'
import ImageUploader from '../../components/dashboard/products/ImageUploader'
import VariantEditor from '../../components/dashboard/products/VariantEditor'
import {
  getProduct,
  createProduct,
  updateProduct,
  getCategories,
  isSkuTaken,
} from '../../data/adminProducts'

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function validateProduct(form, isPublish, currentId) {
  const errors = {}

  if (!form.name.trim()) {
    errors.name = 'Tên sản phẩm không được bỏ trống'
  }

  if (!form.sku.trim()) {
    errors.sku = 'SKU không được bỏ trống'
  } else if (isSkuTaken(form.sku, currentId)) {
    errors.sku = 'SKU này đã được sử dụng'
  }

  if (isPublish) {
    if (form.price < 0 || isNaN(form.price)) {
      errors.price = 'Giá bán phải >= 0'
    }
    if (form.stock < 0 || !Number.isInteger(form.stock)) {
      errors.stock = 'Tồn kho phải >= 0'
    }
    if (form.images.length === 0) {
      errors.images = 'Phải có ít nhất 1 ảnh'
    }
    if (form.hasVariants && form.variants.length > 0) {
      form.variants.forEach((v, idx) => {
        if (!v.sku) {
          errors[`variant_${idx}_sku`] = 'SKU bắt buộc'
        }
        if (v.stock < 0) {
          errors[`variant_${idx}_stock`] = 'Tồn kho >= 0'
        }
      })
    }
  }

  return errors
}

const DEFAULT_FORM = {
  name: '',
  sku: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  brand: '',
  tags: [],
  images: [],
  price: 0,
  costPrice: null,
  salePrice: null,
  saleStartAt: null,
  saleEndAt: null,
  stock: 0,
  lowStockThreshold: 10,
  hasVariants: false,
  variantAttributes: [],
  variants: [],
  shipping: { weight: null, length: null, width: null, height: null, type: '' },
  seo: { metaTitle: '', metaDescription: '', slug: '' },
  status: 'draft',
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState(DEFAULT_FORM)
  const [errors, setErrors] = useState({})
  const [notFound, setNotFound] = useState(false)

  const categories = getCategories()

  useEffect(() => {
    if (isEdit && id) {
      const product = getProduct(id)
      if (!product) {
        setNotFound(true)
      } else {
        setForm(product)
      }
    } else {
      setForm({ ...DEFAULT_FORM, categoryId: categories[0]?.id || '' })
    }
  }, [id, isEdit, categories])

  function updateFormField(path, value) {
    if (path.includes('.')) {
      const [key, subkey] = path.split('.')
      setForm((prev) => ({
        ...prev,
        [key]: { ...prev[key], [subkey]: value },
      }))
    } else {
      setForm((prev) => ({ ...prev, [path]: value }))
    }
  }

  function handleSaveDraft() {
    const draftErrors = {}
    if (!form.name.trim()) {
      draftErrors.name = 'Tên sản phẩm không được bỏ trống'
    }
    if (Object.keys(draftErrors).length > 0) {
      setErrors(draftErrors)
      return
    }

    const toSave = {
      ...form,
      status: 'draft',
      seo: { ...form.seo, slug: form.seo.slug || slugify(form.name) },
    }

    if (isEdit) {
      updateProduct(id, toSave)
    } else {
      createProduct(toSave)
    }
    navigate('/dashboard/products')
  }

  function handlePublish() {
    const publishErrors = validateProduct(form, true, isEdit ? id : null)
    if (Object.keys(publishErrors).length > 0) {
      setErrors(publishErrors)
      return
    }

    const toSave = {
      ...form,
      status: 'active',
      seo: { ...form.seo, slug: form.seo.slug || slugify(form.name) },
    }

    if (isEdit) {
      updateProduct(id, toSave)
    } else {
      createProduct(toSave)
    }
    navigate('/dashboard/products')
  }

  if (notFound) {
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

  const pageTitle = isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'

  return (
    <AdminLayout activeNav="products" pageTitle={pageTitle} headerActions={null}>
      {isEdit && form.updatedAt && (
        <p style={{ fontSize: '13px', color: 'var(--dash-muted)', marginBottom: '16px' }}>
          Đã cập nhật lần cuối: {new Date(form.updatedAt).toLocaleDateString('vi-VN')} bởi {form.updatedBy}
        </p>
      )}

      <div className="product-form-grid">
        <div className="product-form-main">
          <div className="dash-card">
            <h3 className="form-card-title">Thông tin cơ bản</h3>
            <div className="form-group">
              <label>Tên sản phẩm *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                className={`dash-input ${errors.name ? 'input-error' : ''}`}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>SKU *</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => updateFormField('sku', e.target.value)}
                className={`dash-input ${errors.sku ? 'input-error' : ''}`}
              />
              {errors.sku && <span className="field-error">{errors.sku}</span>}
            </div>

            <div className="form-group">
              <label>Mô tả ngắn</label>
              <textarea
                value={form.shortDescription}
                onChange={(e) => updateFormField('shortDescription', e.target.value)}
                className="dash-input"
                rows="2"
              />
            </div>

            <div className="form-group">
              <label>Mô tả chi tiết</label>
              <textarea
                value={form.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                className="dash-input"
                rows="6"
              />
            </div>

            <div className="form-group">
              <label>Thương hiệu</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => updateFormField('brand', e.target.value)}
                className="dash-input"
              />
            </div>

            <div className="form-group">
              <label>Tags (cách nhau bằng dấu phẩy)</label>
              <input
                type="text"
                value={Array.isArray(form.tags) ? form.tags.join(', ') : ''}
                onChange={(e) => updateFormField('tags', e.target.value.split(',').map((t) => t.trim()))}
                className="dash-input"
              />
            </div>
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">Hình ảnh</h3>
            <ImageUploader images={form.images} onChange={(imgs) => updateFormField('images', imgs)} />
            {errors.images && <span className="field-error">{errors.images}</span>}
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">Biến thể sản phẩm</h3>
            <VariantEditor
              hasVariants={form.hasVariants}
              onToggle={(checked) => updateFormField('hasVariants', checked)}
              attributes={form.variantAttributes}
              onAttributesChange={(attrs) => updateFormField('variantAttributes', attrs)}
              variants={form.variants}
              onVariantsChange={(vars) => updateFormField('variants', vars)}
            />
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">Thông tin vận chuyển</h3>
            <div className="form-group">
              <label>Khối lượng (kg)</label>
              <input
                type="number"
                value={form.shipping.weight || ''}
                onChange={(e) => updateFormField('shipping.weight', e.target.value ? parseFloat(e.target.value) : null)}
                className="dash-input"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Chiều dài (cm)</label>
                <input
                  type="number"
                  value={form.shipping.length || ''}
                  onChange={(e) => updateFormField('shipping.length', e.target.value ? parseFloat(e.target.value) : null)}
                  className="dash-input"
                />
              </div>
              <div className="form-group">
                <label>Chiều rộng (cm)</label>
                <input
                  type="number"
                  value={form.shipping.width || ''}
                  onChange={(e) => updateFormField('shipping.width', e.target.value ? parseFloat(e.target.value) : null)}
                  className="dash-input"
                />
              </div>
              <div className="form-group">
                <label>Chiều cao (cm)</label>
                <input
                  type="number"
                  value={form.shipping.height || ''}
                  onChange={(e) => updateFormField('shipping.height', e.target.value ? parseFloat(e.target.value) : null)}
                  className="dash-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Loại vận chuyển</label>
              <select value={form.shipping.type} onChange={(e) => updateFormField('shipping.type', e.target.value)} className="dash-select">
                <option value="">Chọn loại vận chuyển</option>
                <option value="standard">Giao hàng tiêu chuẩn</option>
                <option value="fast">Giao hàng nhanh</option>
                <option value="express">Hỏa tốc</option>
              </select>
            </div>
          </div>
        </div>

        <div className="product-form-sidebar">
          <div className="dash-card">
            <h3 className="form-card-title">Trạng thái</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="status" value="draft" checked={form.status === 'draft'} onChange={() => updateFormField('status', 'draft')} />
                Bản nháp
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="status" value="active" checked={form.status === 'active'} onChange={() => updateFormField('status', 'active')} />
                Đang bán
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="status" value="hidden" checked={form.status === 'hidden'} onChange={() => updateFormField('status', 'hidden')} />
                Tạm ẩn
              </label>
            </div>
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">Danh mục *</h3>
            <select
              value={form.categoryId}
              onChange={(e) => updateFormField('categoryId', e.target.value)}
              className={`dash-select ${errors.categoryId ? 'input-error' : ''}`}
            >
              <option value="">Chọn danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">Giá</h3>
            <div className="form-group">
              <label>Giá bán *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => updateFormField('price', parseInt(e.target.value) || 0)}
                className={`dash-input ${errors.price ? 'input-error' : ''}`}
              />
              {errors.price && <span className="field-error">{errors.price}</span>}
            </div>
            <div className="form-group">
              <label>Giá nhập</label>
              <input
                type="number"
                value={form.costPrice || ''}
                onChange={(e) => updateFormField('costPrice', e.target.value ? parseInt(e.target.value) : null)}
                className="dash-input"
              />
            </div>
            <div className="form-group">
              <label>Giá khuyến mãi</label>
              <input
                type="number"
                value={form.salePrice || ''}
                onChange={(e) => updateFormField('salePrice', e.target.value ? parseInt(e.target.value) : null)}
                className="dash-input"
              />
            </div>
            <div className="form-group">
              <label>Bắt đầu khuyến mãi</label>
              <input
                type="date"
                value={form.saleStartAt || ''}
                onChange={(e) => updateFormField('saleStartAt', e.target.value || null)}
                className="dash-input"
              />
            </div>
            <div className="form-group">
              <label>Kết thúc khuyến mãi</label>
              <input
                type="date"
                value={form.saleEndAt || ''}
                onChange={(e) => updateFormField('saleEndAt', e.target.value || null)}
                className="dash-input"
              />
            </div>
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">Kho</h3>
            <div className="form-group">
              <label>Số lượng tồn kho *</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => updateFormField('stock', parseInt(e.target.value) || 0)}
                className={`dash-input ${errors.stock ? 'input-error' : ''}`}
              />
              {errors.stock && <span className="field-error">{errors.stock}</span>}
            </div>
            <div className="form-group">
              <label>Mức cảnh báo tồn kho</label>
              <input
                type="number"
                value={form.lowStockThreshold}
                onChange={(e) => updateFormField('lowStockThreshold', parseInt(e.target.value) || 0)}
                className="dash-input"
              />
            </div>
          </div>

          <div className="dash-card">
            <h3 className="form-card-title">SEO</h3>
            <div className="form-group">
              <label>Meta title</label>
              <input
                type="text"
                value={form.seo.metaTitle}
                onChange={(e) => updateFormField('seo.metaTitle', e.target.value)}
                className="dash-input"
              />
            </div>
            <div className="form-group">
              <label>Meta description</label>
              <textarea
                value={form.seo.metaDescription}
                onChange={(e) => updateFormField('seo.metaDescription', e.target.value)}
                className="dash-input"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>URL slug</label>
              <input
                type="text"
                value={form.seo.slug}
                onChange={(e) => updateFormField('seo.slug', e.target.value)}
                className="dash-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky-action-bar">
        <button className="dash-btn-ghost" onClick={() => navigate('/dashboard/products')}>
          Hủy
        </button>
        <button className="dash-btn dash-btn-outline" onClick={handleSaveDraft}>
          Lưu bản nháp
        </button>
        <button className="dash-btn" onClick={handlePublish}>
          Xuất bản
        </button>
      </div>
    </AdminLayout>
  )
}
