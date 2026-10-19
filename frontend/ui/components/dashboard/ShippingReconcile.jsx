'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'

// CSV đơn giản: dòng đầu là tên cột, hỗ trợ dấu phẩy hoặc chấm phẩy và giá trị trong ngoặc kép. File Excel (.xlsx) hãy lưu thành CSV trước.
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','
  const split = (line) => {
    const out = []
    let cur = ''
    let quoted = false
    for (const ch of line) {
      if (ch === '"') quoted = !quoted
      else if (ch === sep && !quoted) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim())
  }
  const head = split(lines[0])
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i] || `c${i}`, v])))
}

const RESULT_LABEL = { matched: 'Khớp', mismatch: 'Lệch', not_found: 'Không thấy vận đơn', not_final: 'Chưa giao xong', invalid: 'Dòng lỗi' }

// Tổng hợp dòng tiền vận chuyển + nạp file đối soát của Goship (khớp thì đơn thành "Đã đối soát vận chuyển").
export default function ShippingReconcile() {
  const [sum, setSum] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  const load = useCallback(() => api.get('/shipping/accounting').then(setSum).catch(() => setSum(null)), [])
  useEffect(() => { load() }, [load])

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setReport(null)
    const rows = parseCsv(await file.text())
    if (!rows.length) return setError('File không có dòng dữ liệu. Cần file CSV, dòng đầu là tên cột (Mã vận đơn, Tiền thu hộ, Cước, Phụ phí).')
    setBusy(true)
    try {
      setReport(await api.post('/shipping/reconcile', { rows: rows.slice(0, 500) }))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cards = sum && [
    { label: 'Cước tạm tính (chưa đối soát)', value: formatCurrency(sum.shippingEstimate) },
    { label: 'Cước thực tế đã đối soát', value: formatCurrency(sum.shippingActual), sub: sum.extraFeeTotal ? `gồm phụ phí truy thu ${formatCurrency(sum.extraFeeTotal)}` : '' },
    { label: 'COD chờ Goship đối soát', value: formatCurrency(sum.codWaiting), sub: `${sum.codWaitingCount} đơn` },
    { label: 'COD đã đối soát', value: formatCurrency(sum.codReconciled) },
    { label: 'Chi phí rủi ro (cước đơn hoàn / trả hàng)', value: formatCurrency(sum.returnedCost), sub: `${sum.returnedCount} đơn` },
    { label: 'Thu nhập khác (Goship đền bù)', value: formatCurrency(sum.otherIncome), sub: `${sum.compensatedCount} yêu cầu` },
    { label: 'Đền bù đang chờ Goship', value: formatCurrency(sum.claimsPendingAmount), sub: `${sum.claimsPending} yêu cầu` },
    { label: 'Vận đơn chưa khớp đối soát', value: String(sum.unreconciled), sub: sum.mismatched ? `${sum.mismatched} đơn lệch cần xử lý` : '' },
  ]

  return (
    <section className="dash-card" style={{ marginBottom: '20px' }}>
      <h3 className="form-card-title">Đối soát vận chuyển với Goship</h3>
      {cards && (
        <div className="pay-cards" style={{ marginBottom: '14px' }}>
          {cards.map((c) => (
            <div className="pay-card" key={c.label}>
              <span className="pay-card-title">{c.label}</span>
              <strong className="pay-card-value">{c.value}</strong>
              {c.sub && <span className="pay-card-sub">{c.sub}</span>}
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: '13px', margin: '0 0 10px' }}>
        Tải file đối soát từ cổng Goship (lưu dạng CSV) với các cột: <strong>Mã vận đơn, Tiền thu hộ, Cước, Phụ phí</strong>. Đơn khớp số liệu được đánh dấu "Đã đối soát vận chuyển", đơn lệch được ghi lý do (sai COD, sai cước, truy thu lệch cân).
      </p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} />
      {busy && <p style={{ fontSize: '13px' }}>Đang đối soát…</p>}
      {error && <p className="oa-error" role="alert">{error}</p>}
      {report && (
        <div style={{ marginTop: '12px', fontSize: '13px' }}>
          <p>
            <strong>{report.matched}</strong> khớp · <strong>{report.mismatch}</strong> lệch · {report.notFound} không thấy vận đơn · {report.notFinal} chưa giao xong
            {report.invalid ? ` · ${report.invalid} dòng lỗi` : ''}
          </p>
          {report.results.filter((r) => r.result !== 'matched').length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {report.results.filter((r) => r.result !== 'matched').slice(0, 50).map((r, i) => (
                <li key={`${r.code}-${i}`}>
                  <strong>{r.code || '(trống)'}</strong>{r.orderNumber ? ` · ${r.orderNumber}` : ''} — {RESULT_LABEL[r.result]}: {r.issues.join('; ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
