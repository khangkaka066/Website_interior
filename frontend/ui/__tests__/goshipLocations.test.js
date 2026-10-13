import { describe, it, expect } from 'vitest'
import { normalizeVi, findByName } from '../utils/goshipLocations'

describe('normalizeVi', () => {
  it('bỏ dấu và đổi đ thành d để gõ không dấu vẫn khớp', () => {
    expect(normalizeVi('Phường Ba Đình')).toBe('phuong ba dinh')
    expect(normalizeVi('Hồ Chí Minh')).toBe('ho chi minh')
  })
})

describe('findByName (địa chỉ cũ do khách gõ tay)', () => {
  const cities = [{ id: '700000', name: 'Hồ Chí Minh' }, { id: '100000', name: 'Hà Nội' }, { id: '480000', name: 'Đà Nẵng' }]
  const districts = [{ id: '1', name: 'Quận 1' }, { id: '2', name: 'Quận Tân Bình' }, { id: '3', name: 'Huyện Củ Chi' }, { id: '4', name: 'Quận 10' }]

  it('khớp đúng tên, không phân biệt hoa thường và dấu', () => {
    expect(findByName(cities, 'hồ chí minh')?.id).toBe('700000')
    expect(findByName(cities, 'ha noi')?.id).toBe('100000')
  })

  it('nhận tên thiếu hoặc thừa tiền tố loại đơn vị', () => {
    expect(findByName(cities, 'Thành phố Hồ Chí Minh')?.id).toBe('700000')
    expect(findByName(cities, 'TP. Hà Nội')?.id).toBe('100000')
    expect(findByName(cities, 'tp ho chi minh')?.id).toBe('700000')
    expect(findByName(districts, 'Tân Bình')?.id).toBe('2')
    expect(findByName(districts, 'Củ Chi')?.id).toBe('3')
  })

  it('"Quận 1" không bị nhầm với "Quận 10"', () => {
    expect(findByName(districts, 'Quận 1')?.id).toBe('1')
    expect(findByName(districts, '1')?.id).toBe('1')
    expect(findByName(districts, '10')?.id).toBe('4')
  })

  it('không đoán bừa khi tên lạ, rỗng hoặc mơ hồ', () => {
    expect(findByName(cities, 'Atlantis')).toBeUndefined()
    expect(findByName(cities, '')).toBeUndefined()
    expect(findByName(cities, undefined)).toBeUndefined()
    // Cùng tên rút gọn ở hai loại đơn vị: không chọn hộ khách.
    expect(findByName([{ id: 'a', name: 'Quận Thủ Đức' }, { id: 'b', name: 'Huyện Thủ Đức' }], 'Thủ Đức')).toBeUndefined()
  })
})
