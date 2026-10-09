import { describe, test, expect, beforeEach, vi } from 'vitest'

const store = new Map()
vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })
vi.stubGlobal('window', { dispatchEvent() {}, addEventListener() {} })

const server = { products: [] }
const post = vi.fn(async (_path, body) => {
  for (const p of body.upserts) {
    const i = server.products.findIndex((x) => x.id === p.id)
    if (i >= 0) server.products[i] = p
    else server.products.push(p)
  }
  server.products = server.products.filter((p) => !body.deletes.includes(p.id))
  return { ok: true }
})
vi.mock('../api', () => ({ api: { get: vi.fn(async () => ({ products: server.products })), post: (...a) => post(...a) }, getToken: () => 't' }))

const { syncProductsWithServer, pushProducts, listProducts } = await import('../data/adminProducts')

const KEY = 'clevinum_admin_products'
const P = (id, description) => ({ id, name: id, description, updatedAt: '2026-09-30' })
const local = () => JSON.parse(store.get(KEY) || '[]')
const byId = (list, id) => list.find((p) => p.id === id)

beforeEach(() => {
  store.clear()
  post.mockClear()
  server.products = [P('a', 'cũ'), P('b', 'cũ')]
})

describe('đồng bộ sản phẩm giữa các máy', () => {
  test('máy mới/chưa sửa gì: lấy bản trên server', async () => {
    store.set(KEY, JSON.stringify([P('a', 'cũ'), P('b', 'cũ')]))
    server.products = [P('a', 'MỚI 8/10'), P('b', 'cũ')]
    await syncProductsWithServer()
    expect(byId(local(), 'a').description).toBe('MỚI 8/10')
  })

  test('cờ "chưa đồng bộ" bị sót lại vẫn lấy được dữ liệu mới (lỗi từng gặp: máy khác mãi thấy ngày cũ)', async () => {
    store.set(KEY, JSON.stringify([P('a', 'cũ'), P('b', 'cũ')]))
    store.set('clevinum_admin_products_dirty', '1')
    server.products = [P('a', 'MỚI 8/10'), P('b', 'cũ')]
    await syncProductsWithServer()
    expect(byId(local(), 'a').description).toBe('MỚI 8/10')
    expect(store.get('clevinum_admin_products_dirty')).toBeUndefined()
  })

  test('sản phẩm đang sửa dở ở máy này được giữ và gửi lên, không bị bản server đè', async () => {
    store.set(KEY, JSON.stringify([P('a', 'cũ'), P('b', 'cũ')]))
    await syncProductsWithServer() // ghi nhận mốc đã đồng bộ
    const edited = local().map((p) => (p.id === 'b' ? { ...p, description: 'SỬA DỞ' } : p))
    store.set(KEY, JSON.stringify(edited))
    server.products = [P('a', 'MỚI 8/10'), P('b', 'cũ')]
    await syncProductsWithServer()
    await vi.waitFor(() => expect(byId(server.products, 'b').description).toBe('SỬA DỞ'))
    expect(byId(local(), 'a').description).toBe('MỚI 8/10')
    expect(byId(local(), 'b').description).toBe('SỬA DỞ')
  })

  test('server đã xóa sản phẩm (từng đồng bộ) thì máy này cũng bỏ; sản phẩm mới tạo chưa gửi thì giữ', async () => {
    store.set(KEY, JSON.stringify([P('a', 'cũ'), P('b', 'cũ')]))
    await syncProductsWithServer()
    store.set(KEY, JSON.stringify([...local(), P('moi', 'mới tạo')]))
    server.products = [P('a', 'cũ')]
    await syncProductsWithServer()
    expect(local().map((p) => p.id).sort()).toEqual(['a', 'moi'])
  })

  test('khóa chống gửi trùng không bị kẹt sau lần gửi không có gì để gửi', async () => {
    store.set(KEY, JSON.stringify([P('a', 'cũ'), P('b', 'cũ')]))
    await syncProductsWithServer() // đặt mốc
    await pushProducts() // không có gì thay đổi: kết thúc ngay
    store.set(KEY, JSON.stringify(local().map((p) => (p.id === 'a' ? { ...p, description: 'SAU KHI KẸT' } : p))))
    await pushProducts()
    expect(byId(server.products, 'a').description).toBe('SAU KHI KẸT')
    expect(post).toHaveBeenCalled()
  })

  test('database trống: máy này gửi toàn bộ sản phẩm đang có lên', async () => {
    server.products = []
    store.set(KEY, JSON.stringify([P('x', 'một'), P('y', 'hai')]))
    await syncProductsWithServer()
    await vi.waitFor(() => expect(server.products.map((p) => p.id).sort()).toEqual(['x', 'y']))
  })

  test('listProducts đọc đúng kho cục bộ', () => {
    store.set(KEY, JSON.stringify([P('a', 'x')]))
    expect(listProducts()).toHaveLength(1)
  })
})
