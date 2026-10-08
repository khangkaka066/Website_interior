import { categories } from './shop'
import { getSession } from '../auth'
import { api } from '../api'

const STORAGE_KEY = 'clevinum_admin_products'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateProductId(name) {
  const slug = slugify(name)
  const time = Date.now().toString(36).slice(-4)
  return `${slug}-${time}`
}

export function getDisplayStatus(product) {
  if (product.status === 'draft') {
    return { label: 'Bản nháp', className: 'status-pending' }
  }
  if (product.status === 'hidden') {
    return { label: 'Tạm ẩn', className: 'status-pending' }
  }
  if (product.status === 'active') {
    if (product.stock === 0) {
      return { label: 'Hết hàng', className: 'status-cancelled' }
    }
    return { label: 'Đang bán', className: 'status-delivered' }
  }
  return { label: 'Không xác định', className: 'status-pending' }
}

function getStorageProducts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// Báo cho dashboard biết danh sách sản phẩm vừa đổi (để kiểm tra lại giá ngay, không cần tải lại trang).
export const PRODUCTS_CHANGED_EVENT = 'clevinum:products-changed'

// localStorage chỉ là bản đệm đọc nhanh; nguồn chính là database qua backend (/api/admin-products) để website bán hàng
// và các máy khác thấy cùng dữ liệu. Mỗi lần lưu đánh dấu "chưa đồng bộ" rồi đẩy lên server (gộp các lần lưu liên tiếp),
// và chỉ đẩy những sản phẩm đã đổi/xóa so với lần đồng bộ trước nên không đè lên sản phẩm người khác sửa.
const DIRTY_KEY = 'clevinum_admin_products_dirty'
const SYNCED_KEY = 'clevinum_admin_products_synced' // { [id]: dấu vân tay } của bản đã đồng bộ gần nhất
const PUSH_DELAY = 600
let pushTimer = null
let pushing = null

function fingerprint(p) {
  const str = JSON.stringify(p)
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return `${str.length}:${h}`
}

function fingerprints(list) {
  return Object.fromEntries(list.map((p) => [p.id, fingerprint(p)]))
}

function readSynced() {
  try {
    return JSON.parse(localStorage.getItem(SYNCED_KEY)) || {}
  } catch {
    return {}
  }
}

function saveStorageProducts(list, { push = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT))
  if (push) {
    try {
      localStorage.setItem(DIRTY_KEY, '1')
    } catch {
      // bỏ qua
    }
    clearTimeout(pushTimer)
    pushTimer = setTimeout(pushProducts, PUSH_DELAY)
  }
}

export function pushProducts() {
  clearTimeout(pushTimer)
  if (pushing) return pushing
  const run = (async () => {
    try {
      const snapshot = localStorage.getItem(STORAGE_KEY)
      const list = JSON.parse(snapshot || '[]')
      const now = fingerprints(list)
      const before = readSynced()
      const upserts = list.filter((p) => before[p.id] !== now[p.id])
      const deletes = Object.keys(before).filter((id) => !(id in now))
      if (upserts.length || deletes.length) await api.post('/admin-products/sync', { upserts, deletes })
      localStorage.setItem(SYNCED_KEY, JSON.stringify(now))
      // Nếu trong lúc gửi lại có thay đổi mới thì giữ cờ, lần đẩy sau sẽ gửi tiếp.
      if (localStorage.getItem(STORAGE_KEY) === snapshot) localStorage.removeItem(DIRTY_KEY)
      return true
    } catch (err) {
      console.warn('Chưa đồng bộ được sản phẩm lên máy chủ:', err.message)
      return false
    }
  })()
  // Xóa khóa chống gửi trùng SAU khi gán: lần gửi không có gì để gửi kết thúc ngay (đồng bộ), nếu xóa bên trong thì khóa sẽ bị đặt lại
  // sau đó và kẹt vĩnh viễn, khiến mọi lần gửi sau đó trong phiên này không làm gì.
  pushing = run
  run.finally(() => {
    if (pushing === run) pushing = null
  })
  return run
}

// Mở trang quản trị: bản trên máy có thay đổi chưa gửi (hoặc database chưa có gì) thì gửi lên,
// ngược lại lấy bản trong database về để mọi máy cùng một dữ liệu.
export async function syncProductsWithServer() {
  try {
    const dirty = localStorage.getItem(DIRTY_KEY) === '1'
    const remote = await api.get('/admin-products')
    const remoteEmpty = !remote.products?.length
    if (dirty || remoteEmpty) {
      if (remoteEmpty) localStorage.removeItem(SYNCED_KEY) // database trống: gửi lại toàn bộ
      if (dirty || getStorageProducts()?.length) await pushProducts()
      return
    }
    saveStorageProducts(remote.products, { push: false })
    localStorage.setItem(SYNCED_KEY, JSON.stringify(fingerprints(remote.products)))
  } catch (err) {
    console.warn('Không đồng bộ được sản phẩm với máy chủ, dùng bản trên máy:', err.message)
  }
}

// Máy khác (hoặc tab khác) có thay đổi chưa đẩy lên khi đóng tab thì thử đẩy nốt.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (localStorage.getItem(DIRTY_KEY) === '1') pushProducts()
  })
}

// Ghi đè toàn bộ danh sách trong một lần (dùng cho nhập Excel hàng loạt).
export function saveAllProducts(list) {
  saveStorageProducts(list)
}

export function listProducts() {
  let adminProducts = getStorageProducts()
  if (!adminProducts) {
    adminProducts = []
    saveStorageProducts(adminProducts)
  }
  return adminProducts
}

export function getProduct(id) {
  const list = listProducts()
  return list.find((p) => p.id === id) || null
}

export function createProduct(data) {
  const list = listProducts()
  const session = getSession()
  const updatedBy = session?.name || session?.username || 'admin'

  const newProduct = {
    ...data,
    id: data.id || generateProductId(data.name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy,
  }

  list.push(newProduct)
  saveStorageProducts(list)
  return newProduct
}

export function updateProduct(id, patch) {
  const list = listProducts()
  const idx = list.findIndex((p) => p.id === id)
  if (idx === -1) return null

  const session = getSession()
  const updatedBy = session?.name || session?.username || 'admin'

  const updated = {
    ...list[idx],
    ...patch,
    id,
    createdAt: list[idx].createdAt,
    updatedAt: new Date().toISOString(),
    updatedBy,
  }

  list[idx] = updated
  saveStorageProducts(list)
  return updated
}

export function duplicateProduct(id) {
  const original = getProduct(id)
  if (!original) return null

  const newId = generateProductId(original.name + ' bản sao')
  const newSku = original.sku + '-copy'
  const copy = {
    ...original,
    id: newId,
    sku: newSku,
    name: original.name + ' (bản sao)',
    status: 'draft',
    sold: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const list = listProducts()
  list.push(copy)
  saveStorageProducts(list)
  return copy
}

export function deleteProduct(id) {
  const list = listProducts()
  const filtered = list.filter((p) => p.id !== id)
  saveStorageProducts(filtered)
}

export function toggleVisibility(id) {
  const product = getProduct(id)
  if (!product) return null

  if (product.status === 'draft') return product
  const newStatus = product.status === 'hidden' ? 'active' : 'hidden'
  return updateProduct(id, { status: newStatus })
}

export function isSkuTaken(sku, excludeId) {
  const list = listProducts()
  return list.some((p) => p.sku === sku && p.id !== excludeId)
}

export function getCategories() {
  return categories
}

// Sản phẩm "đặt riêng/may đo" đã được loại khỏi danh mục: xoá khỏi kho và nhập Excel cũng bỏ qua (xem massUpdate.js).
export const REMOVED_SHOPEE_IDS = new Set([
  '57050806448', '53350747268', '49250752876', '48704342790', '44704352551', '41254764144',
  '41204967638', '28331663746', '28079820871', '27790162001', '26980681627', '24364975873',
])

export async function seedAdminProducts() {
  try {
    const before = listProducts()
    const cleaned = before.filter((p) => !REMOVED_SHOPEE_IDS.has(p.shopeeId))
    if (cleaned.length !== before.length) saveStorageProducts(cleaned)
    // Chỉ nạp seed khi kho trống hoàn toàn: không bao giờ ghi đè dữ liệu đã có trong database.
    if (cleaned.length > 0) return
    const res = await fetch(`${import.meta.env.BASE_URL}data/seed-products.json`)
    if (!res.ok) return
    const seed = await res.json()
    saveStorageProducts((Array.isArray(seed) ? seed : seed.products).filter((p) => !REMOVED_SHOPEE_IDS.has(p.shopeeId)))
  } catch {
    // Không seed được: bỏ qua.
  }
}
