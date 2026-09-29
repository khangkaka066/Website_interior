import { products, categories } from './shop'
import { getSession } from '../auth'

const STORAGE_KEY = 'clevinum_admin_products'

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generateId(name) {
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

function mapProductFromShop(shopProduct) {
  const categoryId = categories[0]?.id || 'dan-tuong'
  return {
    id: shopProduct.id,
    sku: `SP-${shopProduct.id.toUpperCase()}`,
    name: shopProduct.name,
    shortDescription: '',
    description: '',
    categoryId,
    brand: '',
    tags: [],
    images: [shopProduct.image],
    price: shopProduct.price,
    costPrice: null,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    stock: 0,
    lowStockThreshold: 10,
    hasVariants: false,
    variantAttributes: [],
    variants: [],
    shipping: { weight: null, length: null, width: null, height: null, type: '' },
    seo: { metaTitle: '', metaDescription: '', slug: slugify(shopProduct.name) },
    status: 'active',
    sold: shopProduct.sold ? parseInt(shopProduct.sold.replace(/[^0-9]/g, '')) : 0,
    rating: shopProduct.rating || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  }
}

function getStorageProducts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

function saveStorageProducts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function listProducts() {
  let adminProducts = getStorageProducts()
  if (!adminProducts) {
    adminProducts = products.map(mapProductFromShop)
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
    id: data.id || generateId(data.name),
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

  const newId = generateId(original.name + ' bản sao')
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
