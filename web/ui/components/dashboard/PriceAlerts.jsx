'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import { listProducts, PRODUCTS_CHANGED_EVENT } from '../../data/adminProducts'
import { findPriceConflicts, issueSignature } from '../../data/priceCheck'

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
const DISMISS_KEY = 'clevinum_price_alerts_dismissed'
const FIRST = 5

function loadDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY)) || {}
  } catch {
    return {}
  }
}

// Tự tính lại mỗi khi danh sách sản phẩm được lưu (sửa giá, nhập Excel hàng loạt...).
function useIssues() {
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
  const result = useMemo(() => findPriceConflicts(listProducts()), [version])
  const [dismissed, setDismissed] = useState(loadDismissed)
  const isDismissed = (issue) => dismissed[issue.id] === issueSignature(issue)
  function setDismissedFor(issue, value) {
    setDismissed((prev) => {
      const next = { ...prev }
      if (value) next[issue.id] = issueSignature(issue)
      else delete next[issue.id]
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
      } catch {
        // bỏ qua: chỉ mất trạng thái "đã bỏ qua"
      }
      return next
    })
  }
  const open = result.issues.filter((i) => !isDismissed(i))
  return { ...result, open, dismissedIssues: result.issues.filter(isDismissed), setDismissedFor }
}

function IssueRow({ issue, dismissed, onToggle }) {
  const isSku = issue.type === 'sku-price'
  return (
    <div className={`pa-item pa-${issue.severity}`}>
      <div className="pa-item-head">
        <div>
          <span className={`pa-kind pa-kind-${issue.severity}`}>{isSku ? 'Trùng SKU' : 'Cùng loại, cùng kích thước'}</span>
          <strong className="pa-name">{isSku ? `SKU ${issue.sku}` : issue.productName}</strong>
          <span className="pa-size">Kích thước: {issue.sizeText}</span>
        </div>
        <div className="pa-actions">
          {!isSku && (
            <Link className="pa-link" to={`/dashboard/products/${issue.productId}`}>
              Mở sản phẩm
            </Link>
          )}
          <button className="pa-btn" onClick={onToggle}>
            {dismissed ? 'Hiện lại' : 'Bỏ qua'}
          </button>
        </div>
      </div>
      <table className="pa-table">
        <tbody>
          {issue.rows.map((r) => (
            <tr key={r.variantId} className={issue.oddIds.has(r.variantId) ? 'pa-odd' : ''}>
              <td>
                {isSku && (
                  <Link className="pa-link" to={`/dashboard/products/${r.productId}`}>
                    {r.productName.slice(0, 48)}
                    {r.productName.length > 48 ? '…' : ''}
                  </Link>
                )}
                {isSku && <br />}
                {r.label}
              </td>
              <td className="pa-sku">{r.sku || '—'}</td>
              <td className="pa-price">{money(r.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pa-hint">
        {issue.common
          ? `Giá phổ biến trong nhóm: ${money(issue.common.price)} (${issue.common.count} phân loại). Dòng tô màu là dòng đang lệch.`
          : 'Các giá chia đều, chưa rõ giá nào đúng. Hãy kiểm tra lại từng dòng.'}
        {isSku && ' Mỗi phân loại nên có SKU riêng.'}
      </p>
    </div>
  )
}

// Trạng thái ẩn/hiện nhớ lại giữa các lần mở trang.
function useOpenPref(key, initial = true) {
  const storeKey = `clevinum_price_alerts_open_${key}`
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(storeKey)
      return v === null ? initial : v === '1'
    } catch {
      return initial
    }
  })
  function toggle() {
    setOpen((prev) => {
      try {
        localStorage.setItem(storeKey, prev ? '0' : '1')
      } catch {
        // bỏ qua: chỉ mất trạng thái ẩn/hiện
      }
      return !prev
    })
  }
  return [open, toggle]
}

function Arrow({ open }) {
  return <span className="pa-arrow">{open ? '▾' : '▸'}</span>
}

// Một nhóm cảnh báo (theo loại) có mũi tên ẩn/hiện riêng.
function Section({ id, title, items, onDismiss }) {
  const [open, toggle] = useOpenPref(id)
  const [showAll, setShowAll] = useState(false)
  if (items.length === 0) return null
  const shown = showAll ? items : items.slice(0, FIRST)
  return (
    <div className="pa-section">
      <button type="button" className="pa-section-head" onClick={toggle} aria-expanded={open}>
        <Arrow open={open} />
        <span>{title}</span>
        <span className="pa-count">{items.length}</span>
      </button>
      {open && (
        <>
          {shown.map((i) => (
            <IssueRow key={i.id} issue={i} dismissed={false} onToggle={() => onDismiss(i, true)} />
          ))}
          {items.length > FIRST && (
            <button className="pa-btn pa-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Thu gọn' : `Xem thêm ${items.length - FIRST} cảnh báo`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function PriceAlerts() {
  const { totals, open, dismissedIssues, setDismissedFor } = useIssues()
  const [cardOpen, toggleCard] = useOpenPref('card')
  const [showDismissed, setShowDismissed] = useState(false)

  return (
    <div className="dash-card dash-card-wide price-alerts" id="price-alerts">
      <div className="dash-card-head">
        <h3>
          <button type="button" className="pa-card-toggle" onClick={toggleCard} aria-expanded={cardOpen}>
            <Arrow open={cardOpen} />
            Cảnh báo giá không đồng nhất
            {open.length > 0 && <span className="pa-count">{open.length}</span>}
          </button>
        </h3>
      </div>
      {cardOpen && (
        <>
          <span className="dash-tag">
            cùng sản phẩm hoặc cùng SKU, cùng loại rèm (Ore, Dán, Rido, Voan...), cùng kích thước, bất kể màu, mà giá khác nhau · tự kiểm tra lại mỗi lần bạn cập nhật giá
          </span>

          {totals.all === 0 || open.length === 0 ? (
            <p className="pa-ok">
              ✓ {totals.all === 0 ? 'Không phát hiện giá nào lệch.' : 'Mọi cảnh báo đã được bỏ qua.'}
            </p>
          ) : (
            <>
              <p className="pa-summary">
                Có <b>{open.length}</b> chỗ cần kiểm tra. Bấm mũi tên từng nhóm để ẩn/hiện.
              </p>
              <Section
                id="sku"
                title="Trùng SKU, giá khác nhau"
                items={open.filter((i) => i.type === 'sku-price')}
                onDismiss={setDismissedFor}
              />
              <Section
                id="size"
                title="Cùng loại rèm, cùng kích thước, giá khác nhau"
                items={open.filter((i) => i.type === 'size-price')}
                onDismiss={setDismissedFor}
              />
            </>
          )}

          {dismissedIssues.length > 0 && (
            <div className="pa-dismissed">
              <button className="pa-btn" onClick={() => setShowDismissed((v) => !v)}>
                {showDismissed ? 'Ẩn' : 'Xem'} {dismissedIssues.length} cảnh báo đã bỏ qua
              </button>
              {showDismissed &&
                dismissedIssues.map((i) => (
                  <IssueRow key={i.id} issue={i} dismissed onToggle={() => setDismissedFor(i, false)} />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Thanh nhắc gọn ở trang Sản phẩm: đang sửa giá thì thấy ngay có chỗ lệch.
export function PriceAlertsBanner() {
  const { open } = useIssues()
  if (open.length === 0) return null
  return (
    <Link to="/dashboard#price-alerts" className="pa-banner">
      ⚠ Phát hiện <b>{open.length}</b> chỗ giá không đồng nhất (cùng mã, cùng kích thước nhưng khác giá). Xem ở Tổng quan →
    </Link>
  )
}
