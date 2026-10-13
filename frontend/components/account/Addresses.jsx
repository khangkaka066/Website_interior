'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/ui/api'
import AddressFields from '@/ui/components/AddressFields'
import { Notice, Field, input, btnPrimary, btnGhost, fullAddress } from './ui'

// Ô nhập có nhãn của trang tài khoản. Không dùng <label> bọc ngoài: bấm vào một mục trong danh sách sẽ kích hoạt lại ô nhập và mở lại danh sách.
function AddressField({ label, children }) {
  return (
    <div className="block text-sm font-medium">
      <span>{label}</span>
      {children}
    </div>
  )
}

const EMPTY = { recipientName: '', phone: '', addressLine: '', ward: '', district: '', province: '', isDefault: false }

export function Addresses() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null) // null = đóng form, { id?, ...fields }
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get('/account/addresses').then(setList).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const set = (k) => (e) => setEdit((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { id, ...fields } = edit
    // Gửi chuỗi rỗng cho phường/quận thì backend coi như bỏ trống.
    try {
      if (id) await api.patch(`/account/addresses/${id}`, fields)
      else await api.post('/account/addresses', fields)
      setEdit(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function act(fn) {
    setError('')
    try {
      await fn()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Sổ địa chỉ</h2>
        {!edit && <button className={btnPrimary} onClick={() => setEdit({ ...EMPTY })}>+ Thêm địa chỉ</button>}
      </div>
      <div className="mt-4"><Notice>{error}</Notice></div>

      {edit && (
        <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-line bg-white p-5" noValidate>
          <h3 className="font-semibold">{edit.id ? 'Sửa địa chỉ' : 'Địa chỉ mới'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Người nhận *"><input className={input} value={edit.recipientName} onChange={set('recipientName')} maxLength={100} autoComplete="name" /></Field>
            <Field label="Số điện thoại *"><input className={input} value={edit.phone} onChange={set('phone')} maxLength={20} inputMode="tel" autoComplete="tel" /></Field>
            <div className="sm:col-span-2"><Field label="Địa chỉ (số nhà, đường) *"><input className={input} value={edit.addressLine} onChange={set('addressLine')} maxLength={300} autoComplete="street-address" placeholder="Số nhà, tên đường" /></Field></div>
            <AddressFields value={edit} onChange={(patch) => setEdit((f) => ({ ...f, ...patch }))} Field={AddressField} inputClassName={input} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!edit.isDefault} onChange={set('isDefault')} /> Đặt làm địa chỉ mặc định
          </label>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu địa chỉ'}</button>
            <button type="button" className={btnGhost} onClick={() => setEdit(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="mt-5 space-y-3">
        {!list && !error && <p className="text-sm text-muted">Đang tải…</p>}
        {list?.length === 0 && !edit && <p className="rounded-xl border border-line bg-white p-8 text-center text-muted">Bạn chưa lưu địa chỉ nào.</p>}
        {list?.map((a) => (
          <div key={a.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{a.recipientName}</strong>
              <span className="text-sm text-muted">{a.phone}</span>
              {a.isDefault && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">Mặc định</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{fullAddress(a)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => setEdit({ ...EMPTY, ...a })}>Sửa</button>
              {!a.isDefault && <button className={btnGhost} onClick={() => act(() => api.patch(`/account/addresses/${a.id}`, { isDefault: true }))}>Đặt mặc định</button>}
              <button className={btnGhost} onClick={() => confirm('Xóa địa chỉ này?') && act(() => api.delete(`/account/addresses/${a.id}`))}>Xóa</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
