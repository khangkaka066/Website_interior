import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeVi, findProvince } from '../utils/vnProvinces'

const rows = JSON.parse(readFileSync(new URL('../../public/data/vn-provinces.json', import.meta.url), 'utf8'))

describe('normalizeVi', () => {
  it('bỏ dấu và đổi đ thành d để gõ không dấu vẫn khớp', () => {
    expect(normalizeVi('Phường Ba Đình')).toBe('phuong ba dinh')
    expect(normalizeVi('Thành phố Hồ Chí Minh')).toBe('thanh pho ho chi minh')
  })
})

describe('dữ liệu tỉnh/thành, phường/xã', () => {
  it('có 34 tỉnh/thành, mỗi tỉnh có phường/xã', () => {
    expect(rows).toHaveLength(34)
    for (const [code, name, wards] of rows) {
      expect(code).toMatch(/^\d{2}$/)
      expect(name).toBeTruthy()
      expect(wards.length).toBeGreaterThan(0)
    }
  })

  it('mã tỉnh và mã phường/xã không trùng', () => {
    const provinceCodes = rows.map((r) => r[0])
    expect(new Set(provinceCodes).size).toBe(provinceCodes.length)
    const wardCodes = rows.flatMap((r) => r[2].map((w) => w[0]))
    expect(new Set(wardCodes).size).toBe(wardCodes.length)
  })

  it('tìm được "Ba Đình" khi gõ không dấu', () => {
    const hanoi = rows.find((r) => r[1] === 'Thành phố Hà Nội')
    expect(hanoi[2].some((w) => normalizeVi(w[1]).includes('ba dinh'))).toBe(true)
  })
})

describe('findProvince (địa chỉ cũ do khách gõ tay)', () => {
  const provinces = rows.map(([code, name]) => ({ code, name, wards: [] }))

  it('nhận ra tên viết thiếu tiền tố, không dấu hoặc viết tắt', () => {
    expect(findProvince(provinces, 'Hồ Chí Minh')?.name).toBe('Thành phố Hồ Chí Minh')
    expect(findProvince(provinces, 'tp ho chi minh')?.name).toBe('Thành phố Hồ Chí Minh')
    expect(findProvince(provinces, 'TP. Hà Nội')?.name).toBe('Thành phố Hà Nội')
    expect(findProvince(provinces, 'Cao Bằng')?.name).toBe('Tỉnh Cao Bằng')
  })

  it('không đoán bừa khi tên lạ hoặc rỗng', () => {
    expect(findProvince(provinces, 'Atlantis')).toBeUndefined()
    expect(findProvince(provinces, '')).toBeUndefined()
    expect(findProvince(provinces, undefined)).toBeUndefined()
  })
})
