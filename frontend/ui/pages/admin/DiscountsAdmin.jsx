'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'
import { parseDiscountFile } from '../../data/discountImport'

const muted = { fontSize: '12px', color: 'var(--dash-text-muted, #888)' }

const IMPORT_STATUS = {
  ok: { label: 'Sẽ áp dụng', cls: 'status-delivered' },
  clear: { label: 'Bỏ giảm giá cũ', cls: 'status-processing' },
  none: { label: 'Không giảm', cls: 'status-pending' },
  error: { label: 'Lỗi', cls: 'status-cancelled' },
}

// Giảm giá theo mã: nhập MỘT mã (mã sản phẩm / Mã Shopee / SKU, hoặc mã phân loại) + phần trăm giảm. Server tự nhận ra mã thuộc sản phẩm
// hay phân loại. Mã sản phẩm giảm mọi phân loại; mã phân loại chỉ giảm phân loại đó (ưu tiên hơn). Website hiện giá đã giảm kèm giá gốc
// gạch ngang, và đơn hàng tính tiền theo giá đã giảm.
export default function DiscountsAdmin() {
  const [rules, setRules] = useState([])
  const [edits, setEdits] = useState({}) // mã -> % đang gõ dở
  const [form, setForm] = useState({ code: '', percent: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [imp, setImp] = useState(null) // { fileName, rows, missing, analysis, busy, error } — kết quả xem trước file Excel
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      setRules((await api.get('/discounts')).rules)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function persist(next, doneMessage) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await api.put('/discounts', { rules: next.map(({ code, percent, originalPrice, salePrice }) => ({ code, percent, ...(salePrice && { originalPrice: originalPrice || undefined, salePrice }) })) })
      setRules(res.rules)
      setEdits({})
      setNotice(doneMessage)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function add(e) {
    e.preventDefault()
    const code = form.code.trim()
    const percent = Number(form.percent)
    if (!code) return setError('Vui lòng nhập mã sản phẩm hoặc mã phân loại.')
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) return setError('Phần trăm giảm phải là số nguyên từ 1 đến 90.')
    const next = [...rules.filter((r) => r.code.toLowerCase() !== code.toLowerCase()), { code, percent }] // nhập lại mã đã có thì cập nhật %
    if (await persist(next, `Đã áp dụng giảm ${percent}% cho mã ${code}.`)) setForm({ code: '', percent: '' })
  }

  async function chooseFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setNotice('')
    setShowErrorsOnly(false)
    setImp({ fileName: file.name, rows: [], missing: [], analysis: null, busy: true, error: '' })
    try {
      const { rows, missing } = await parseDiscountFile(file)
      if (!rows.length) throw new Error('File không có dòng dữ liệu nào.')
      const analysis = await api.post('/discounts/import', { rows })
      setImp({ fileName: file.name, rows, missing, analysis, busy: false, error: '' })
    } catch (err) {
      setImp({ fileName: file.name, rows: [], missing: [], analysis: null, busy: false, error: err.message })
    }
  }

  async function applyImport() {
    setImp((i) => ({ ...i, busy: true, error: '' }))
    try {
      const res = await api.post('/discounts/import', { rows: imp.rows, apply: true })
      setNotice(`Đã nhập từ ${imp.fileName}: áp dụng ${res.summary.ok} dòng, bỏ giảm giá ${res.summary.clear} dòng, ${res.summary.error} dòng lỗi bị bỏ qua.`)
      setImp(null)
      await load()
    } catch (err) {
      setImp((i) => ({ ...i, busy: false, error: err.message }))
    }
  }

  const dirty = (r) => edits[r.code] !== undefined && Number(edits[r.code]) !== r.percent

  return (
    <AdminLayout activeNav="discounts" pageTitle="Giảm giá theo mã">
      <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <form onSubmit={add} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="dash-form-field" style={{ flex: '1 1 300px' }}>
            <label>Mã sản phẩm / Mã phân loại / SKU</label>
            <input
              value={form.code} maxLength={100} placeholder="Ví dụ: 26331538658 hoặc 396395613449"
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="dash-form-field" style={{ width: '140px' }}>
            <label>Giảm (%)</label>
            <input type="number" min={1} max={90} step={1} value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))} placeholder="10" />
          </div>
          <button className="dash-btn" disabled={saving}>{saving ? 'Đang lưu...' : 'Áp dụng'}</button>
        </form>
        <p style={{ ...muted, marginTop: '10px' }}>
          Chỉ cần nhập một mã, không cần SKU. Mã sản phẩm (Mã Shopee hoặc SKU) giảm mọi phân loại của sản phẩm; mã phân loại chỉ giảm đúng phân loại đó
          (ưu tiên hơn). Nhập lại mã đã có để đổi phần trăm. Thay đổi có hiệu lực ngay trên website, kể cả giá tính tiền khi đặt hàng.
        </p>
        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '10px' }} role="alert">{error}</p>}
        {notice && <p style={{ color: 'var(--dash-success, #1a7f37)', fontSize: '13px', marginTop: '10px' }} role="status">{notice}</p>}
      </div>

      <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>Nhập từ file Excel / CSV</strong>
            <p style={{ ...muted, marginTop: '4px' }}>
              Cột cần có: Mã phân loại hàng (hoặc Mã sản phẩm nếu không có phân loại), Giá Gốc, Giá đang hiển thị (giá đã áp mã giảm). Các cột khác (Tên, Ngành hàng,
              Doanh số, Kho hàng...) được bỏ qua. % giảm được tính ngược từ hai mức giá; website hiện giá gốc gạch ngang, giá giảm và % giảm, giá bán đúng bằng
              “Giá đang hiển thị”. Dòng có giá hiển thị bằng giá gốc sẽ bỏ giảm giá cũ của phân loại đó.
            </p>
          </div>
          <label className="dash-btn" style={{ cursor: 'pointer' }}>
            Chọn file…
            <input type="file" accept=".xlsx,.csv" onChange={chooseFile} style={{ display: 'none' }} disabled={imp?.busy} />
          </label>
        </div>

        {imp && (
          <div style={{ marginTop: '14px' }}>
            <p style={muted}>File: <strong>{imp.fileName}</strong>{imp.busy ? ' — đang xử lý...' : ''}</p>
            {imp.error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '8px' }} role="alert">{imp.error}</p>}
            {imp.missing.length > 0 && (
              <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '8px' }}>Thiếu cột: {imp.missing.join(', ')}.</p>
            )}
            {imp.analysis && (
              <>
                <p style={{ fontSize: '13px', margin: '10px 0' }}>
                  {imp.analysis.summary.total} dòng: <strong>{imp.analysis.summary.ok}</strong> sẽ áp dụng · {imp.analysis.summary.clear} bỏ giảm giá cũ ·{' '}
                  {imp.analysis.summary.none} không giảm · <strong style={{ color: imp.analysis.summary.error ? 'var(--dash-danger)' : undefined }}>{imp.analysis.summary.error}</strong> lỗi (sẽ bị bỏ qua)
                </p>
                <label style={{ fontSize: '13px' }}>
                  <input type="checkbox" checked={showErrorsOnly} onChange={(e) => setShowErrorsOnly(e.target.checked)} /> Chỉ hiện dòng lỗi / cảnh báo
                </label>
                <div style={{ maxHeight: '360px', overflow: 'auto', marginTop: '8px' }}>
                  <table className="dash-table">
                    <thead>
                      <tr><th>Dòng</th><th>Mã</th><th>Sản phẩm / phân loại</th><th>Giá gốc</th><th>Giá hiển thị</th><th>Giảm</th><th>Kết quả</th></tr>
                    </thead>
                    <tbody>
                      {imp.analysis.results
                        .filter((r) => !showErrorsOnly || r.status === 'error' || r.warning)
                        .slice(0, 500)
                        .map((r) => (
                          <tr key={r.row}>
                            <td>{r.row}</td>
                            <td>{r.variantCode || r.productCode || '—'}</td>
                            <td>{r.name ? <>{r.name}{r.label && <div style={muted}>{r.label}</div>}</> : '—'}</td>
                            <td>{r.listPrice ? formatCurrency(r.listPrice) : '—'}</td>
                            <td>{r.salePrice ? formatCurrency(r.salePrice) : '—'}</td>
                            <td>{r.percent ? `-${r.percent}%` : '—'}</td>
                            <td>
                              <span className={`order-status-badge ${IMPORT_STATUS[r.status].cls}`}>{IMPORT_STATUS[r.status].label}</span>
                              {(r.message || r.warning) && <div style={{ ...muted, color: r.status === 'error' ? 'var(--dash-danger)' : undefined }}>{r.message || r.warning}</div>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {imp.analysis.results.length > 500 && !showErrorsOnly && <p style={muted}>Chỉ hiện 500 dòng đầu; tất cả dòng hợp lệ vẫn được áp dụng.</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="dash-btn" disabled={imp.busy || imp.analysis.summary.ok + imp.analysis.summary.clear === 0} onClick={applyImport}>
                    {imp.busy ? 'Đang áp dụng...' : `Áp dụng ${imp.analysis.summary.ok + imp.analysis.summary.clear} dòng`}
                  </button>
                  <button className="dash-btn-outline" disabled={imp.busy} onClick={() => setImp(null)}>Hủy</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : rules.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Chưa có mã nào được giảm giá.</p>
        </div>
      ) : (
        <div className="dash-card dash-card-wide">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Áp dụng cho</th>
                <th>Giá gốc</th>
                <th>Giảm (%)</th>
                <th>Giá sau giảm</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const pct = edits[r.code] !== undefined ? Number(edits[r.code]) : r.percent
                const fixed = r.salePrice && edits[r.code] === undefined // đã sửa % thì thành giảm theo % như thường
                const after = fixed ? r.salePrice : r.found && pct >= 1 && pct <= 90 ? Math.max(1, Math.round((r.catalogPrice ?? r.price) * (1 - pct / 100))) : null
                return (
                  <tr key={r.code}>
                    <td><strong>{r.code}</strong></td>
                    <td>
                      {r.found ? (
                        <>
                          {r.name}
                          <div style={muted}>
                            {r.kind === 'variant' ? `Chỉ phân loại: ${r.label}${r.sku ? ` · SKU ${r.sku}` : ''}` : 'Toàn bộ phân loại của sản phẩm'}
                            {r.salePrice ? ' · giá cố định theo file' : ''}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--dash-danger)' }}>Không còn mã này trong kho sản phẩm</span>
                      )}
                    </td>
                    <td>{r.found ? formatCurrency(r.price) : '—'}</td>
                    <td>
                      <input
                        type="number" min={1} max={90} step={1} style={{ width: '80px' }}
                        value={edits[r.code] ?? r.percent}
                        onChange={(e) => setEdits((m) => ({ ...m, [r.code]: e.target.value }))}
                      />
                    </td>
                    <td>{after ? <strong>{formatCurrency(after)}</strong> : '—'}</td>
                    <td>
                      <button
                        className="dash-btn-outline" disabled={saving || !dirty(r)}
                        onClick={() => persist(rules.map((x) => (x.code === r.code ? { code: x.code, percent: Number(edits[r.code]) } : x)), `Đã đổi mã ${r.code} thành giảm ${edits[r.code]}%.`)}
                      >
                        Lưu
                      </button>{' '}
                      <button
                        className="dash-btn-outline" disabled={saving}
                        onClick={() => persist(rules.filter((x) => x.code !== r.code), `Đã bỏ giảm giá cho mã ${r.code}.`)}
                      >
                        Bỏ giảm giá
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ ...muted, padding: '8px 16px' }}>Với sản phẩm có nhiều phân loại, “Giá gốc” là giá của phân loại rẻ nhất.</p>
        </div>
      )}
    </AdminLayout>
  )
}
