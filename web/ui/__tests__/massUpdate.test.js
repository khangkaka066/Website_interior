import { describe, test, expect, beforeEach, vi } from 'vitest'

// Kho sản phẩm admin nằm trong localStorage: dựng một bản giả trong bộ nhớ cho test.
const store = new Map()
vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })
vi.stubGlobal('window', { dispatchEvent() {}, addEventListener() {} })

const { buildPreview } = await import('../data/massUpdate')
const { REMOVED_SHOPEE_IDS } = await import('../data/adminProducts')

const existing = {
  id: 'ray-1', sku: 'ray-1', shopeeParentSku: 'ray-1', shopeeId: '111', name: 'Thanh ray', description: 'Mô tả cũ', categoryId: 'thanh-treo',
  images: ['a.jpg'], price: 100000, stock: 5, hasVariants: false, variants: [], variantAttributes: [], status: 'active', updatedBy: 'admin',
}
const basic = (rows) => ({ kind: 'basic', fileName: 'basic.xlsx', rows: rows.map((r, i) => ({ row: i + 7, parentSku: '', description: '', ...r })) })
const sales = (rows) => ({ kind: 'sales', fileName: 'sales.xlsx', rows: rows.map((r, i) => ({ row: i + 7, parentSku: '', name: '', variantId: '', variantName: '', variantSku: '', gtin: '', price: null, stock: null, marketPrices: {}, ...r })) })

beforeEach(() => {
  store.clear()
  store.set('clevinum_admin_products', JSON.stringify([existing]))
})

describe('buildPreview', () => {
  test('khớp theo Mã Sản phẩm -> cập nhật, ô trống giữ nguyên dữ liệu cũ', () => {
    const { items, nextList } = buildPreview([basic([{ id: '111', name: 'Thanh ray mới', description: '' }])])
    expect(items[0].status).toBe('update')
    const p = nextList.find((x) => x.id === 'ray-1')
    expect(p.name).toBe('Thanh ray mới')
    expect(p.description).toBe('Mô tả cũ')
    expect(p.images).toEqual(['a.jpg'])
  })

  test('không có thay đổi thì báo unchanged và không đổi danh sách', () => {
    const { items, nextList } = buildPreview([basic([{ id: '111', name: 'Thanh ray' }])])
    expect(items[0].status).toBe('unchanged')
    expect(nextList).toHaveLength(1)
  })

  test('mã chưa có -> tạo mới, kèm cảnh báo còn thiếu ảnh/phân loại', () => {
    const { items, nextList } = buildPreview([basic([{ id: '222', name: 'Sản phẩm mới', description: 'abc' }])])
    expect(items[0].status).toBe('create')
    expect(items[0].warnings.join(' ')).toMatch(/thiếu.*ảnh.*media_info/)
    expect(items[0].warnings.join(' ')).toMatch(/sales_info/)
    expect(nextList).toHaveLength(2)
  })

  test('tắt tạo mới thì bỏ qua mã chưa có', () => {
    const { items, nextList } = buildPreview([basic([{ id: '222', name: 'Mới' }])], { createMissing: false })
    expect(items[0].status).toBe('skipped')
    expect(nextList).toHaveLength(1)
  })

  test('sản phẩm đặt riêng/may đo bị bỏ qua, không bị tạo lại', () => {
    const removedId = [...REMOVED_SHOPEE_IDS][0]
    const { items, nextList } = buildPreview([basic([{ id: removedId, name: 'Bộ rèm ĐẶT MAY RIÊNG' }])])
    expect(items[0].status).toBe('skipped')
    expect(items[0].warnings.join(' ')).toMatch(/đặt riêng/)
    expect(nextList).toHaveLength(1)
  })

  test('chỉ nhập sales_info vẫn cập nhật được giá phân loại của sản phẩm đã có', () => {
    const { items, nextList } = buildPreview([sales([{ id: '111', variantName: 'Trắng', variantSku: 'r-w', price: 120000, stock: 9 }])])
    expect(items[0].status).toBe('update')
    const p = nextList.find((x) => x.id === 'ray-1')
    expect(p.images).toEqual(['a.jpg']) // phần không có trong file được giữ nguyên
    expect(p.name).toBe('Thanh ray')
    expect(p.variants.some((v) => v.price === 120000)).toBe(true)
  })
})
