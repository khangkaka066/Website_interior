'use client'

import AddressCombobox from './AddressCombobox'
import { useLocations, findByName } from '../utils/goshipLocations'

// Ba ô địa chỉ: Tỉnh/Thành phố -> Quận/Huyện -> Phường/Xã, danh sách theo Goship. value = { province, district, ward } (tên);
// onChange nhận phần thay đổi. Chọn cấp trên thì cấp dưới bị xóa. Không tải được danh sách thì cấp đó thành ô gõ tay.
// Field: component bọc nhãn + ô nhập theo kiểu của từng trang. inputClassName: class cho ô nhập.
export default function AddressFields({ value, onChange, Field, inputClassName }) {
  const cities = useLocations('/shop/locations/cities')
  const city = cities.status === 'ready' ? findByName(cities.items, value.province) : undefined
  const districts = useLocations(city ? `/shop/locations/cities/${city.id}/districts` : null)
  const district = districts.status === 'ready' ? findByName(districts.items, value.district) : undefined
  const wards = useLocations(district ? `/shop/locations/districts/${district.id}/wards` : null)

  const text = (key, autoComplete) => (
    <input className={inputClassName} value={value[key] || ''} onChange={(e) => onChange({ [key]: e.target.value })} autoComplete={autoComplete} />
  )

  if (cities.status !== 'ready') {
    // Đang tải hoặc lỗi: gõ tay để khách vẫn đặt được hàng.
    return (
      <>
        <Field label="Tỉnh/Thành phố *">{text('province', 'address-level1')}</Field>
        <Field label="Quận/Huyện">{text('district', 'address-level2')}</Field>
        <Field label="Phường/Xã">{text('ward', 'address-level3')}</Field>
      </>
    )
  }

  return (
    <>
      <Field label="Tỉnh/Thành phố *">
        <AddressCombobox
          ariaLabel="Tỉnh/Thành phố"
          inputClassName={inputClassName}
          placeholder="Chọn hoặc gõ tên tỉnh/thành"
          value={value.province || ''}
          options={cities.items}
          onSelect={(c) => (city?.id === c.id ? onChange({ province: c.name }) : onChange({ province: c.name, district: '', ward: '' }))}
        />
      </Field>
      <Field label="Quận/Huyện">
        {districts.status === 'error' || (districts.status === 'ready' && districts.items.length === 0) ? (
          text('district', 'address-level2')
        ) : (
          <AddressCombobox
            ariaLabel="Quận/Huyện"
            inputClassName={inputClassName}
            placeholder={!city ? 'Chọn tỉnh/thành trước' : districts.status === 'loading' ? 'Đang tải…' : 'Chọn hoặc gõ tên quận/huyện'}
            disabled={!city || districts.status === 'loading'}
            value={value.district || ''}
            options={districts.items}
            onSelect={(d) => (district?.id === d.id ? onChange({ district: d.name }) : onChange({ district: d.name, ward: '' }))}
          />
        )}
      </Field>
      <Field label="Phường/Xã">
        {wards.status === 'error' || (wards.status === 'ready' && wards.items.length === 0) ? (
          text('ward', 'address-level3')
        ) : (
          <AddressCombobox
            ariaLabel="Phường/Xã"
            inputClassName={inputClassName}
            placeholder={!district ? 'Chọn quận/huyện trước' : wards.status === 'loading' ? 'Đang tải…' : 'Chọn hoặc gõ tên phường/xã'}
            disabled={!district || wards.status === 'loading'}
            value={value.ward || ''}
            options={wards.items}
            onSelect={(w) => onChange({ ward: w.name })}
          />
        )}
      </Field>
    </>
  )
}
