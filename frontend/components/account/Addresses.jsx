'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/ui/api'
import AddressCombobox from '@/ui/components/AddressCombobox'
import { useVnProvinces, findProvince } from '@/ui/utils/vnProvinces'
import { Notice, Field, input, btnPrimary, btnGhost, fullAddress } from './ui'

const EMPTY = { recipientName: '', phone: '', addressLine: '', ward: '', district: '', province: '', isDefault: false }

export function Addresses() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null) // null = đóng form, { id?, ...fields }
  const [busy, setBusy] = useState(false)
  const address = useVnProvinces()

  const load = useCallback(() => {
    api.get('/account/addresses').then(setList).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const set = (k) => (e) => setEdit((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // Tỉnh đang chọn (kể cả địa chỉ cũ do khách gõ tay) để lấy danh sách phường/xã tương ứng.
  const province = edit && address.status === 'ready' ? findProvince(address.provinces, edit.province) : undefined
  const pickProvince = (p) =>
    setEdit((f) => (province?.code === p.code ? { ...f, province: p.name } : { ...f, province: p.name, ward: '', district: '' })) // đổi sang tỉnh khác thì bỏ phường/quận cũ

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
            {address.status === 'ready' ? (
              <>
                {/* Không bọc trong <label> (Field): bấm vào một mục trong danh sách sẽ kích hoạt lại ô nhập và mở lại danh sách. */}
                <div className="block text-sm font-medium">
                  <span>Tỉnh/thành phố *</span>
                  <AddressCombobox ariaLabel="Tỉnh/thành phố" inputClassName={input} placeholder="Chọn hoặc gõ tên tỉnh/thành" value={edit.province} options={address.provinces} onSelect={pickProvince} />
                </div>
                <div className="block text-sm font-medium">
                  <span>Phường/xã</span>
                  <AddressCombobox
                    ariaLabel="Phường/xã"
                    inputClassName={input}
                    placeholder={province ? 'Chọn hoặc gõ tên phường/xã' : 'Chọn tỉnh/thành trước'}
                    disabled={!province}
                    value={edit.ward || ''}
                    options={province?.wards || []}
                    // phường/xã mới thuộc hành chính 2 cấp nên bỏ quận/huyện cũ (nếu có) và chuẩn hóa tên tỉnh
                    onSelect={(w) => setEdit((f) => ({ ...f, ward: w.name, district: '', province: province.name }))}
                  />
                </div>
              </>
            ) : (
              // Đang tải hoặc không tải được danh sách: cho gõ tay để vẫn lưu được địa chỉ.
              <>
                <Field label="Tỉnh/thành phố *"><input className={input} value={edit.province} onChange={set('province')} maxLength={100} /></Field>
                <Field label="Phường/xã"><input className={input} value={edit.ward || ''} onChange={set('ward')} maxLength={100} /></Field>
              </>
            )}
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
