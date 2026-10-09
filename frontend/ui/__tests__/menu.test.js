import { describe, test, expect } from 'vitest'
import { PRODUCT_GROUPS, CURTAIN_CATEGORIES, SERVICES, BUSINESS_AREAS, CATEGORY_NOTES } from '../data/menu'
import { categories } from '../data/shop'

describe('menu Sản phẩm / lĩnh vực hoạt động', () => {
  const ids = new Set(categories.map((c) => c.id))

  test('mọi danh mục trong menu đều tồn tại trong dữ liệu danh mục (để lọc và gán sản phẩm được)', () => {
    for (const c of CURTAIN_CATEGORIES) expect(ids.has(c.id), c.id).toBe(true)
    for (const g of PRODUCT_GROUPS.filter((g) => g.categoryId)) expect(ids.has(g.categoryId), g.id).toBe(true)
  })

  test('mỗi nhóm có đường dẫn bấm được và có mục con', () => {
    for (const g of PRODUCT_GROUPS) {
      expect(g.href.startsWith('/products')).toBe(true)
      expect(g.items.length).toBeGreaterThan(0)
    }
    expect(PRODUCT_GROUPS.find((g) => g.categoryId === 'vat-lieu').href).toBe('/products?category=vat-lieu')
  })

  test('danh thiếp: 6 lĩnh vực (2 dịch vụ + 4 nhóm sản phẩm), đúng nội dung', () => {
    expect(BUSINESS_AREAS).toHaveLength(6)
    expect(SERVICES).toHaveLength(2)
    expect(PRODUCT_GROUPS).toHaveLength(4)
    expect(BUSINESS_AREAS.join(' ')).toMatch(/lam sóng.*than tre.*sàn giả gỗ/)
    expect(BUSINESS_AREAS.join(' ')).toMatch(/bảng hiệu.*decal.*đèn LED/i)
  })

  test('nhóm chưa có sản phẩm có lời giới thiệu để hiện trang "đang cập nhật"', () => {
    for (const id of ['vat-lieu', 'bang-hieu-den', 'do-go']) expect(CATEGORY_NOTES[id]).toBeTruthy()
  })

  test('chỉ danh mục có ảnh mới lên lưới danh mục trang chủ', () => {
    const withImage = categories.filter((c) => c.image)
    expect(withImage.map((c) => c.id)).toEqual(CURTAIN_CATEGORIES.map((c) => c.id))
  })
})
