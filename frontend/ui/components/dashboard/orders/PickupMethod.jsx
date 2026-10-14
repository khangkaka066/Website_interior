'use client'

import { useState } from 'react'

export const PICKUP_LABEL = { PICKUP: 'Hãng tới shop lấy hàng', DROP_OFF: 'Shop mang hàng ra bưu cục' }
const KEY = 'clevinum_pickup_method'

// Nhớ lựa chọn lần trước của nhân viên trên máy này (mỗi shop thường gửi theo một cách cố định).
export function usePickupMethod() {
  const [method, setMethod] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'DROP_OFF' ? 'DROP_OFF' : 'PICKUP'
    } catch {
      return 'PICKUP'
    }
  })
  const set = (m) => {
    setMethod(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      // không nhớ được lựa chọn: vẫn dùng cho lần này
    }
  }
  return [method, set]
}

// Chọn cách giao hàng cho hãng, giống Shopee: hãng tới shop lấy, hoặc shop mang ra bưu cục.
export default function PickupMethod({ value, onChange, disabled }) {
  const opts = [
    ['PICKUP', 'Hãng tới shop lấy hàng', 'Nhân viên hãng đến địa chỉ kho gửi để lấy.'],
    ['DROP_OFF', 'Shop mang hàng ra bưu cục', 'Nhân viên shop tự mang kiện đã dán tem tới bưu cục của hãng.'],
  ]
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }} disabled={disabled}>
      <legend style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Cách giao hàng cho hãng vận chuyển</legend>
      <div style={{ display: 'grid', gap: '8px' }}>
        {opts.map(([id, label, hint]) => (
          <label key={id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 12px', border: `1px solid ${value === id ? 'var(--dash-accent, #b5602f)' : 'var(--dash-border)'}`, cursor: 'pointer' }}>
            <input type="radio" name="pickup-method" checked={value === id} onChange={() => onChange(id)} style={{ marginTop: '3px' }} />
            <span>
              <strong style={{ fontSize: '13px' }}>{label}</strong>
              <small style={{ display: 'block', color: 'var(--dash-muted)' }}>{hint}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
