import { useRef, useState, useMemo } from 'react'
import {
  KINDS,
  parseWorkbookFile,
  buildPreview,
  commitPreview,
  exportKind,
  exportFileName,
  downloadBlob,
} from '../../../data/massUpdate'

const STATUS_LABEL = {
  create: { text: 'Tạo mới', color: 'var(--dash-success, #3e8e4f)' },
  update: { text: 'Cập nhật', color: 'var(--dash-primary)' },
  unchanged: { text: 'Không đổi', color: 'var(--dash-muted)' },
  skipped: { text: 'Bỏ qua', color: 'var(--dash-danger)' },
}

const tabStyle = (active) => ({
  padding: '8px 16px',
  border: 'none',
  borderBottom: active ? '2px solid var(--dash-primary)' : '2px solid transparent',
  background: 'none',
  color: active ? 'var(--dash-primary)' : 'var(--dash-muted)',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
})

export default function MassUpdateModal({ initialTab = 'import', allProducts, filteredProducts, selectedProducts, onClose, onApplied }) {
  const [tab, setTab] = useState(initialTab)
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px' }}>
        <div className="dash-modal-head">
          <h3>Cập nhật sản phẩm hàng loạt (Excel)</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--dash-border)', marginBottom: '16px' }}>
          <button style={tabStyle(tab === 'import')} onClick={() => setTab('import')}>Nhập file</button>
          <button style={tabStyle(tab === 'export')} onClick={() => setTab('export')}>Xuất file</button>
        </div>
        {tab === 'import' ? (
          <ImportTab onApplied={onApplied} onClose={onClose} />
        ) : (
          <ExportTab allProducts={allProducts} filteredProducts={filteredProducts} selectedProducts={selectedProducts} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ImportTab({ onApplied, onClose }) {
  const inputRef = useRef(null)
  const [parsed, setParsed] = useState([])
  const [parseErrors, setParseErrors] = useState([])
  const [createMissing, setCreateMissing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState(null)
  const [fatal, setFatal] = useState('')

  const preview = useMemo(() => (parsed.length ? buildPreview(parsed, { createMissing }) : null), [parsed, createMissing])
  const counts = useMemo(() => {
    const c = { create: 0, update: 0, unchanged: 0, skipped: 0 }
    preview?.items.forEach((i) => c[i.status]++)
    return c
  }, [preview])
  const rowErrors = useMemo(() => parsed.flatMap((f) => f.errors), [parsed])

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => /\.xlsx$/i.test(f.name))
    if (!files.length) {
      setFatal('Chỉ nhận file .xlsx.')
      return
    }
    setBusy(true)
    setFatal('')
    setResult(null)
    const ok = [...parsed]
    const bad = []
    for (const f of files) {
      try {
        const res = await parseWorkbookFile(f)
        const idx = ok.findIndex((p) => p.kind === res.kind && p.fileName === res.fileName)
        if (idx >= 0) ok[idx] = res
        else ok.push(res)
      } catch (err) {
        bad.push(`${f.name}: ${err.message}`)
      }
    }
    setParsed(ok)
    setParseErrors(bad)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(fileName) {
    setParsed(parsed.filter((p) => p.fileName !== fileName))
  }

  function handleApply() {
    try {
      commitPreview(preview)
      setResult({ ...counts })
      setParsed([])
      onApplied?.()
    } catch (err) {
      setFatal(
        err.name === 'QuotaExceededError'
          ? 'Bộ nhớ trình duyệt đã đầy, không lưu được. Hãy xóa bớt sản phẩm/ảnh rồi thử lại.'
          : `Không lưu được: ${err.message}`,
      )
    }
  }

  if (result) {
    return (
      <div>
        <p style={{ fontSize: '14px', color: 'var(--dash-heading)', fontWeight: 600 }}>Đã áp dụng xong.</p>
        <p style={{ fontSize: '13px', color: 'var(--dash-text)' }}>
          Cập nhật {result.update} sản phẩm, tạo mới {result.create}, không thay đổi {result.unchanged}
          {result.skipped ? `, bỏ qua ${result.skipped}` : ''}.
        </p>
        <div className="dash-modal-actions">
          <button className="dash-btn" onClick={onClose}>Đóng</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--dash-primary)' : 'var(--dash-border)'}`,
          padding: '28px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(181, 96, 47, 0.06)' : 'transparent',
          fontSize: '13px',
          color: 'var(--dash-text)',
        }}
      >
        <strong style={{ color: 'var(--dash-heading)' }}>Kéo thả hoặc bấm để chọn file .xlsx</strong>
        <div style={{ marginTop: '6px', color: 'var(--dash-muted)' }}>
          Có thể chọn cùng lúc nhiều file: basic_info, media_info, sales_info. Hệ thống tự nhận dạng từng mẫu.
        </div>
        <input ref={inputRef} type="file" accept=".xlsx" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {busy && <p style={{ fontSize: '13px', color: 'var(--dash-muted)' }}>Đang đọc file...</p>}
      {fatal && <p style={{ color: 'var(--dash-danger)', fontSize: '13px' }}>{fatal}</p>}
      {parseErrors.map((e) => (
        <p key={e} style={{ color: 'var(--dash-danger)', fontSize: '13px', margin: '6px 0' }}>{e}</p>
      ))}

      {parsed.length > 0 && (
        <>
          <div style={{ margin: '16px 0 8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {parsed.map((f) => (
              <span
                key={f.fileName}
                style={{ border: '1px solid var(--dash-border)', padding: '4px 10px', fontSize: '12px', display: 'inline-flex', gap: '8px', alignItems: 'center' }}
              >
                <strong>{KINDS[f.kind].label}</strong> · {f.rows.length} dòng
                <button
                  onClick={() => removeFile(f.fileName)}
                  style={{ background: 'none', border: 'none', color: 'var(--dash-muted)', cursor: 'pointer', padding: 0 }}
                  aria-label="Bỏ file"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', margin: '8px 0 12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
            Tạo sản phẩm mới nếu chưa có trong hệ thống (khớp theo Mã Sản phẩm rồi đến SKU)
          </label>

          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span>Cập nhật: <strong>{counts.update}</strong></span>
            <span>Tạo mới: <strong>{counts.create}</strong></span>
            <span>Không đổi: <strong>{counts.unchanged}</strong></span>
            {counts.skipped > 0 && <span>Bỏ qua: <strong>{counts.skipped}</strong></span>}
            {rowErrors.length > 0 && <span style={{ color: 'var(--dash-danger)' }}>Dòng lỗi: <strong>{rowErrors.length}</strong></span>}
          </div>

          <div style={{ maxHeight: '280px', overflow: 'auto', border: '1px solid var(--dash-border)' }}>
            <table className="dash-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Kết quả</th>
                  <th>Sản phẩm</th>
                  <th>Thay đổi</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.slice(0, 200).map((it) => (
                  <tr key={it.key}>
                    <td style={{ color: STATUS_LABEL[it.status].color, fontWeight: 600 }}>{STATUS_LABEL[it.status].text}</td>
                    <td style={{ maxWidth: '320px' }}>{it.name}</td>
                    <td>
                      {it.changes.join(' · ') || '—'}
                      {it.warnings.map((w) => (
                        <div key={w} style={{ color: 'var(--dash-danger)' }}>{w}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.items.length > 200 && (
            <p style={{ fontSize: '12px', color: 'var(--dash-muted)' }}>Hiển thị 200/{preview.items.length} sản phẩm đầu tiên (tất cả vẫn được áp dụng).</p>
          )}

          {rowErrors.length > 0 && (
            <details style={{ marginTop: '12px', fontSize: '12px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--dash-danger)' }}>Xem {rowErrors.length} dòng bị bỏ qua do lỗi</summary>
              <ul style={{ maxHeight: '140px', overflow: 'auto', paddingLeft: '18px' }}>
                {rowErrors.slice(0, 100).map((e, i) => (
                  <li key={i}>{e.file} · dòng {e.row}: {e.message}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <div className="dash-modal-actions">
        <button className="dash-btn-ghost" onClick={onClose} style={{ padding: '8px 16px' }}>Hủy</button>
        <button className="dash-btn" disabled={!preview || counts.create + counts.update === 0} onClick={handleApply}>
          Áp dụng {preview ? `(${counts.create + counts.update} sản phẩm)` : ''}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ExportTab({ allProducts, filteredProducts, selectedProducts }) {
  const [kinds, setKinds] = useState({ basic: true, media: true, sales: true })
  const [scope, setScope] = useState(selectedProducts.length ? 'selected' : 'all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const scopes = [
    { id: 'all', label: `Tất cả sản phẩm (${allProducts.length})`, list: allProducts },
    { id: 'filtered', label: `Đang lọc/tìm kiếm (${filteredProducts.length})`, list: filteredProducts },
    { id: 'selected', label: `Đã chọn (${selectedProducts.length})`, list: selectedProducts },
  ]
  const list = scopes.find((s) => s.id === scope).list
  const chosen = Object.keys(kinds).filter((k) => kinds[k])

  async function handleExport() {
    setBusy(true)
    setError('')
    setDone('')
    try {
      for (const kind of chosen) {
        const { blob } = await exportKind(kind, list)
        downloadBlob(blob, exportFileName(kind))
        await new Promise((r) => setTimeout(r, 400)) // trình duyệt cần khoảng nghỉ giữa các lần tải
      }
      setDone(`Đã xuất ${chosen.length} file cho ${list.length} sản phẩm.`)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--dash-text)', marginTop: 0 }}>
        File xuất ra theo đúng cấu trúc 3 mẫu mass_update, có thể chỉnh sửa rồi nhập lại.
      </p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--dash-heading)', marginBottom: '6px' }}>Loại file</p>
      {Object.entries(KINDS).map(([id, k]) => (
        <label key={id} style={{ display: 'flex', gap: '8px', fontSize: '13px', padding: '4px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={kinds[id]} onChange={(e) => setKinds({ ...kinds, [id]: e.target.checked })} />
          <span>
            <strong>{k.label}</strong> <span style={{ color: 'var(--dash-muted)' }}>· {k.desc} (mass_update_{k.key})</span>
          </span>
        </label>
      ))}
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--dash-heading)', margin: '14px 0 6px' }}>Phạm vi</p>
      {scopes.map((s) => (
        <label key={s.id} style={{ display: 'flex', gap: '8px', fontSize: '13px', padding: '4px 0', cursor: s.list.length ? 'pointer' : 'not-allowed', opacity: s.list.length ? 1 : 0.5 }}>
          <input type="radio" name="scope" disabled={!s.list.length} checked={scope === s.id} onChange={() => setScope(s.id)} />
          {s.label}
        </label>
      ))}
      {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px' }}>{error}</p>}
      {done && <p style={{ color: 'var(--dash-primary)', fontSize: '13px' }}>{done}</p>}
      <div className="dash-modal-actions">
        <button className="dash-btn" disabled={busy || !chosen.length || !list.length} onClick={handleExport}>
          {busy ? 'Đang xuất...' : `Tải xuống (${chosen.length} file)`}
        </button>
      </div>
    </div>
  )
}
