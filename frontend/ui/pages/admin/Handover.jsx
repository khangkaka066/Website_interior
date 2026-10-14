'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { PICKUP_LABEL } from '../../components/dashboard/orders/PickupMethod'
import { formatCurrency, formatDateTime } from '../../utils/format'
import '../../styles/print.css'

// Biên bản bàn giao cho hãng: danh sách kiện, tổng số kiện / tổng tiền thu hộ, chỗ ký của hai bên. In bằng cùng khung in với tem.
function Manifest({ handover, shop, onClose }) {
  const cod = handover.shipments.reduce((n, s) => n + Number(s.codAmount || 0), 0)
  const pickups = [...new Set(handover.shipments.map((s) => s.pickupMethod).filter(Boolean))]
  return createPortal(
    <div className="print-portal" onClick={onClose}>
      <div className="print-toolbar" onClick={(e) => e.stopPropagation()}>
        <button className="print-btn" onClick={() => window.print()}>🖨 In biên bản</button>
        <button className="print-btn print-btn-ghost" onClick={onClose}>Đóng</button>
      </div>
      <style>{'@media print { @page { size: A4; margin: 12mm } }'}</style>
      <div className="print-page" onClick={(e) => e.stopPropagation()}>
        <section className="print-sheet">
          <header className="print-head">
            <div>
              <div className="print-shop">{shop.name}</div>
              {shop.address && <div>{shop.address}</div>}
              {shop.hotline && <div>Hotline: {shop.hotline}</div>}
            </div>
            <div className="print-code-box">
              <div className="print-title">BIÊN BẢN BÀN GIAO</div>
              <div className="print-code">{handover.code}</div>
              <div>Ngày lập: {formatDateTime(handover.createdAt)}</div>
            </div>
          </header>
          <p style={{ margin: '12px 0' }}>
            Hãng vận chuyển: <strong>{handover.carrier.name}</strong> · Số kiện: <strong>{handover.shipments.length}</strong> · Tiền thu hộ (COD): <strong>{formatCurrency(cod)}</strong>
            {pickups.length > 0 && <> · Hình thức: {pickups.map((p) => PICKUP_LABEL[p]).join(', ')}</>}
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                <th>Mã vận đơn</th>
                <th>Mã đơn</th>
                <th>Người nhận</th>
                <th style={{ width: '60px' }}>SL</th>
                <th style={{ width: '100px' }}>Thu hộ</th>
                <th style={{ width: '70px' }}>Đã nhận</th>
              </tr>
            </thead>
            <tbody>
              {handover.shipments.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td><strong>{s.carrierCode || s.trackingId}</strong></td>
                  <td>{s.order.orderNumber}</td>
                  <td>{s.order.recipientName}{s.province ? `, ${s.province}` : ''}</td>
                  <td>{s.order.items.reduce((n, it) => n + it.quantity, 0)}</td>
                  <td className="print-num">{Number(s.codAmount) ? formatCurrency(s.codAmount) : '—'}</td>
                  <td>☐</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '36px', textAlign: 'center' }}>
            <div><strong>Người giao (shop)</strong><div className="print-muted">(ký, ghi rõ họ tên)</div><div style={{ height: '70px' }} /></div>
            <div><strong>Người nhận ({handover.carrier.name})</strong><div className="print-muted">(ký, ghi rõ họ tên)</div><div style={{ height: '70px' }} /></div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}

export default function Handover() {
  const navigate = useNavigate()
  const [data, setData] = useState({ groups: [], recent: [] })
  const [shop, setShop] = useState({ name: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [manifest, setManifest] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await api.get('/shipping/handovers'))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
    api.get('/shop/info').then((i) => setShop({ name: i.name || '', address: i.address, hotline: i.hotline })).catch(() => {})
  }, [load])

  async function create(carrierId) {
    setBusy(carrierId)
    setError('')
    try {
      setManifest(await api.post('/shipping/handovers', { carrierId }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function reprint(id) {
    try {
      setManifest(await api.get(`/shipping/handovers/${id}`))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AdminLayout activeNav="shipping" pageTitle="Bàn giao cho hãng">
      <p style={{ fontSize: '13px', margin: '0 0 16px' }}>
        Chỉ các kiện <strong>đã quét đóng gói</strong> mới hiện ở đây. Bấm lập biên bản khi shipper đến lấy (hoặc trước khi mang ra bưu cục): hệ thống ghi hành trình "Đã bàn giao", báo khách qua email và in biên bản để hai bên ký.{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/orders/pack') }}>Quét đóng gói →</a>
      </p>
      {error && <div className="dash-card" style={{ marginBottom: '16px', color: 'var(--dash-danger, #c0392b)', fontSize: '13px' }}>{error}</div>}

      {data.groups.length === 0 ? (
        <div className="dash-card"><p className="dash-empty-state">Không có kiện nào đang chờ bàn giao. Hãy quét đóng gói các đơn đã chuẩn bị hàng.</p></div>
      ) : (
        data.groups.map((g) => (
          <div className="dash-card" key={g.carrier.id} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className="form-card-title" style={{ margin: 0 }}>{g.carrier.name} · {g.shipments.length} kiện</h3>
              <button className="dash-btn" disabled={!!busy} onClick={() => create(g.carrier.id)}>{busy === g.carrier.id ? 'Đang lập…' : 'Lập biên bản bàn giao và in'}</button>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.8, marginTop: '8px' }}>
              {g.shipments.map((s) => (
                <div key={s.id}>
                  <strong>{s.carrierCode || s.trackingId}</strong> · {s.order.orderNumber} · {s.order.recipientName}
                  {Number(s.codAmount) ? ` · thu hộ ${formatCurrency(s.codAmount)}` : ''}
                  {s.pickupMethod ? ` · ${PICKUP_LABEL[s.pickupMethod]}` : ''}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="dash-card">
        <h3 className="form-card-title">Biên bản gần đây</h3>
        {data.recent.length === 0 ? (
          <p className="dash-empty-state">Chưa có biên bản nào.</p>
        ) : (
          <table className="dash-table">
            <thead><tr><th>Mã biên bản</th><th>Hãng</th><th>Số kiện</th><th>Lập lúc</th><th>Người lập</th><th /></tr></thead>
            <tbody>
              {data.recent.map((h) => (
                <tr key={h.id}>
                  <td><strong>{h.code}</strong></td><td>{h.carrier}</td><td>{h.count}</td><td>{formatDateTime(h.createdAt)}</td><td>{h.createdBy}</td>
                  <td><button className="dash-btn dash-btn-ghost" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => reprint(h.id)}>Xem / in lại</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {manifest && <Manifest handover={manifest} shop={shop} onClose={() => setManifest(null)} />}
    </AdminLayout>
  )
}
