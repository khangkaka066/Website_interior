import { describe, test, expect, beforeEach, vi } from 'vitest'

const store = new Map()
vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })
vi.stubGlobal('window', { dispatchEvent() {}, addEventListener() {} })

const { seedAdminProducts, listProducts, REMOVED_SHOPEE_IDS } = await import('../data/adminProducts')

const SEED = [
  { id: 'a', shopeeId: '1', sku: 'a', name: 'A seed', description: 'mô tả seed', updatedBy: 'import' },
  { id: 'b', shopeeId: '2', sku: 'b', name: 'B seed', description: 'mô tả seed', updatedBy: 'import' },
]
const KEY = 'clevinum_admin_products'

beforeEach(() => {
  store.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => SEED }))
})

describe('seedAdminProducts', () => {
  test('KHÔNG ghi đè sản phẩm đã có (kể cả khi đánh dấu import) bằng dữ liệu seed', async () => {
    // Lỗi từng gặp: trình duyệt mới (localStorage trống) kéo dữ liệu từ server rồi chạy seed, ghi đè mô tả mà admin đã nhập bằng Excel.
    const mine = [{ ...SEED[0], description: 'mô tả MỚI nhập từ Excel' }, { ...SEED[1], description: 'mô tả MỚI 2' }]
    store.set(KEY, JSON.stringify(mine))
    await seedAdminProducts()
    expect(listProducts()).toEqual(mine)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('kho hoàn toàn trống thì nạp seed một lần', async () => {
    await seedAdminProducts()
    expect(listProducts().map((p) => p.id)).toEqual(['a', 'b'])
  })

  test('sản phẩm đặt riêng/may đo luôn bị dọn, kể cả khi đã sửa tay', async () => {
    const removed = [...REMOVED_SHOPEE_IDS][0]
    store.set(KEY, JSON.stringify([{ ...SEED[0] }, { id: 'x', shopeeId: removed, name: 'Đặt riêng', updatedBy: 'admin' }]))
    await seedAdminProducts()
    expect(listProducts().map((p) => p.id)).toEqual(['a'])
  })

  test('seed không nạp lại sản phẩm đặt riêng/may đo', async () => {
    const removed = [...REMOVED_SHOPEE_IDS][0]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [...SEED, { id: 'x', shopeeId: removed, name: 'Đặt riêng' }] }))
    await seedAdminProducts()
    expect(listProducts().map((p) => p.id)).toEqual(['a', 'b'])
  })

  test('không tải được seed thì bỏ qua êm, không lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(seedAdminProducts()).resolves.toBeUndefined()
    expect(listProducts()).toEqual([])
  })
})
