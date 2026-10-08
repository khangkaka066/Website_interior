'use client'

import { useState } from 'react'

function cartesianProduct(attributes) {
  if (attributes.length === 0) return []
  if (attributes.length === 1) {
    return attributes[0].values.map((v) => ({ label: v, values: [v] }))
  }

  const [first, ...rest] = attributes
  const restProduct = cartesianProduct(rest)
  const result = []

  for (const val of first.values) {
    for (const item of restProduct) {
      result.push({
        label: `${val} / ${item.label}`,
        values: [val, ...item.values],
      })
    }
  }

  return result
}

export default function VariantEditor({ hasVariants, onToggle, attributes, onAttributesChange, variants, onVariantsChange }) {
  const [attrName, setAttrName] = useState('')
  const [attrValues, setAttrValues] = useState('')

  function handleAddAttribute() {
    if (!attrName.trim() || !attrValues.trim()) return
    const values = attrValues.split(',').map((v) => v.trim())
    onAttributesChange([...attributes, { name: attrName, values }])
    setAttrName('')
    setAttrValues('')
  }

  function handleRemoveAttribute(idx) {
    onAttributesChange(attributes.filter((_, i) => i !== idx))
  }

  function handleGenerateVariants() {
    const combinations = cartesianProduct(attributes)
    const newVariants = combinations.map((combo) => {
      const existing = variants.find((v) => v.label === combo.label)
      if (existing) return existing
      return {
        id: `var-${Date.now()}-${Math.random()}`,
        label: combo.label,
        sku: '',
        price: 0,
        stock: 0,
        image: '',
        status: 'active',
      }
    })
    onVariantsChange(newVariants)
  }

  function handleUpdateVariant(idx, field, value) {
    const newVariants = [...variants]
    newVariants[idx][field] = value
    onVariantsChange(newVariants)
  }

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={hasVariants}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>Sản phẩm có biến thể</span>
      </label>

      {hasVariants && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--dash-border)' }}>
            <p style={{ fontSize: '13px', color: 'var(--dash-text)', marginBottom: '8px' }}>Thuộc tính biến thể</p>
            {attributes.map((attr, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ flex: 1, color: 'var(--dash-heading)', fontWeight: '600' }}>{attr.name}</span>
                <span style={{ color: 'var(--dash-muted)' }}>{attr.values.join(', ')}</span>
                <button
                  onClick={() => handleRemoveAttribute(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dash-danger)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Xóa
                </button>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginTop: '12px' }}>
              <input
                type="text"
                placeholder="Tên thuộc tính (vd: Màu sắc)"
                value={attrName}
                onChange={(e) => setAttrName(e.target.value)}
                className="dash-input"
              />
              <input
                type="text"
                placeholder="Giá trị, cách nhau bằng dấu phẩy"
                value={attrValues}
                onChange={(e) => setAttrValues(e.target.value)}
                className="dash-input"
              />
              <button onClick={handleAddAttribute} className="dash-btn" style={{ whiteSpace: 'nowrap' }}>
                + Thêm
              </button>
            </div>

            {attributes.length > 0 && (
              <button onClick={handleGenerateVariants} className="dash-btn" style={{ marginTop: '12px' }}>
                Tạo biến thể
              </button>
            )}
          </div>

          {variants.length > 0 && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--dash-text)', marginBottom: '8px' }}>Bảng biến thể</p>
              <table className="dash-table" style={{ fontSize: '13px' }}>
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
                  {variants.map((v, idx) => (
                    <tr key={v.id}>
                      <td>{v.label}</td>
                      <td>
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => handleUpdateVariant(idx, 'sku', e.target.value)}
                          className="dash-input"
                          style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={v.price}
                          onChange={(e) => handleUpdateVariant(idx, 'price', parseInt(e.target.value) || 0)}
                          className="dash-input"
                          style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={v.stock}
                          onChange={(e) => handleUpdateVariant(idx, 'stock', parseInt(e.target.value) || 0)}
                          className="dash-input"
                          style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                        />
                      </td>
                      <td>
                        <select
                          value={v.status}
                          onChange={(e) => handleUpdateVariant(idx, 'status', e.target.value)}
                          className="dash-select"
                          style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                        >
                          <option value="active">Đang bán</option>
                          <option value="outofstock">Hết hàng</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
