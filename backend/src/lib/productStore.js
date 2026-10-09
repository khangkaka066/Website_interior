import { products as staticProducts } from '../data/shop.js'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from './prisma.js'
import { getSettings } from './settingsStore.js'

// Kho sản phẩm do quản trị viên quản lý (kể cả nhập Excel), lưu trong bảng Product của database.
// Trang quản trị gửi từng sản phẩm "dạng admin"; website bán hàng đọc bản đã chuyển sang "dạng cửa hàng".
// Kho rỗng thì dùng danh sách tĩnh trong data/shop.js. Bản dạng cửa hàng được giữ trong bộ nhớ (nạp lại sau
// mỗi lần ghi và định kỳ) nên các nơi tra giá (đơn hàng...) gọi đồng bộ được.
// Loại hiển thị theo danh mục (bộ lọc ở trang Tất cả sản phẩm).
const TYPE_BY_CATEGORY = {
  'dan-tuong': 'Rèm dán tường',
  'thanh-treo': 'Phụ kiện rèm',
  'chong-nang': 'Rèm cửa',
  'rem-khac': 'Rèm cửa',
  'voan-lua': 'Voan & decor',
  'vat-lieu': 'Vật liệu nội thất',
  'bang-hieu-den': 'Bảng hiệu & đèn LED',
  'do-go': 'Đồ gỗ nội thất',
}

const staticByShopeeId = new Map(staticProducts.filter((p) => p.shopeeId).map((p) => [p.shopeeId, p]))

// Sản phẩm dạng admin -> dạng cửa hàng (cùng hình dạng với data/shop.js).
export const normSku = (sku) => String(sku ?? '').trim().toLowerCase()
const discounted = (price, percent) => (percent ? Math.max(1, Math.round(price * (1 - percent / 100))) : price)

// rules: Map(SKU viết thường -> % giảm). Giá trên website và giá tính tiền khi đặt hàng đều lấy từ đây, nên luôn là giá đã giảm.
// SKU phân loại ưu tiên hơn SKU sản phẩm. `originalPrice` là giá trước giảm của đúng mức giá đang hiển thị.
export function toStorefront(p, rules = new Map()) {
  const productPct = rules.get(normSku(p.sku)) || 0
  const variants = (p.hasVariants ? (p.variants || []) : []).map((v) => {
    const percent = rules.get(normSku(v.sku)) || productPct
    const price = Number(v.price)
    return { ...v, percent, listPrice: price, price: discounted(price, percent) }
  })
  const listPrice = Number(p.price)
  const prices = variants.length ? variants.map((v) => v.price) : [discounted(listPrice, productPct)]
  const images = (p.images || []).filter(Boolean)
  const out = {
    id: p.shopeeId ? `sp${p.shopeeId}` : p.id,
    shopeeId: p.shopeeId || '',
    name: p.name,
    price: Math.min(...prices),
    image: images[0] || '',
    images,
    categoryId: p.categoryId,
    type: staticByShopeeId.get(p.shopeeId)?.type || TYPE_BY_CATEGORY[p.categoryId] || 'Rèm cửa',
    description: p.description || p.shortDescription || '',
    sold: Number(p.sold) || 0,
    createdAt: p.createdAt || '',
  }
  if (variants.length) {
    const cheapest = variants.reduce((a, b) => (b.price < a.price ? b : a))
    if (cheapest.percent) Object.assign(out, { originalPrice: cheapest.listPrice, discountPercent: cheapest.percent })
    const max = Math.max(...prices)
    if (max !== out.price) out.priceMax = max
    out.options = (p.variantAttributes || []).map((a) => ({
      name: a.name,
      values: a.values,
      ...(a.optionImages && Object.keys(a.optionImages).length ? { images: a.optionImages } : {}),
    }))
    out.variants = variants.map((v) => ({
      label: v.label,
      price: v.price,
      ...(v.percent ? { originalPrice: v.listPrice, discountPercent: v.percent } : {}),
      stock: Number(v.stock) || 0,
    }))
  } else if (productPct) {
    Object.assign(out, { originalPrice: listPrice, discountPercent: productPct })
  }
  return out
}

let storefront = staticProducts
let skuIndex = new Map() // SKU (viết thường) -> { kind: 'product' | 'variant', name, label?, price }; dùng để kiểm tra SKU khi nhập giảm giá
let storefrontById = new Map(storefront.map((p) => [p.id, p]))

const REFRESH_MS = 15000 // nhiều server cùng chạy thì sau tối đa chừng này sẽ thấy thay đổi của nhau

// Chỉ sản phẩm đang bán (active) và còn giá hợp lệ mới lên website.
function rebuild(list, discountRules = []) {
  const rules = new Map(discountRules.map((r) => [normSku(r.sku), Number(r.percent)]))
  skuIndex = new Map()
  for (const p of list) {
    if (p.sku) skuIndex.set(normSku(p.sku), { kind: 'product', name: p.name, price: Number(p.price) || 0 })
    if (p.hasVariants) for (const v of p.variants || []) if (v.sku) skuIndex.set(normSku(v.sku), { kind: 'variant', name: p.name, label: v.label, price: Number(v.price) || 0 })
  }
  storefront = list.length
    ? list.filter((p) => p.status === 'active').map((p) => toStorefront(p, rules)).filter((p) => Number.isFinite(p.price) && p.price > 0)
    : staticProducts
  storefrontById = new Map(storefront.map((p) => [p.id, p]))
}

async function readAll() {
  return prisma.product.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
}

export async function loadProducts() {
  const [rows, settings] = await Promise.all([readAll(), getSettings()])
  rebuild(rows.map((r) => r.data), settings.discounts.rules)
}

export const getSkuInfo = (sku) => skuIndex.get(normSku(sku))

let timer = null
export function startProductRefresh() {
  if (timer) return
  timer = setInterval(() => loadProducts().catch((err) => console.warn('Không nạp lại được sản phẩm:', err.message)), REFRESH_MS)
  timer.unref()
}

export const getStorefrontProducts = () => storefront
export const getStorefrontProduct = (id) => storefrontById.get(id)

export async function getAdminProductsState() {
  const rows = await readAll()
  const updatedAt = rows.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), new Date(0))
  return { products: rows.map((r) => r.data), updatedAt: rows.length ? updatedAt.toISOString() : null }
}

const toRow = (p) => ({
  shopeeId: p.shopeeId ? String(p.shopeeId) : null,
  sku: p.sku ? String(p.sku) : null,
  name: p.name,
  status: p.status || 'active',
  categoryId: p.categoryId || null,
  price: Math.max(0, Math.round(Number(p.price) || 0)),
  data: p,
})

const CHUNK = 200

// Ghi các sản phẩm đổi và xóa các sản phẩm bị bỏ, trong một giao dịch; sản phẩm khác không bị đụng tới.
// Mỗi lô ghi bằng một câu SQL duy nhất (database ở xa, ghi từng dòng sẽ chậm và quá thời gian giao dịch).
export async function applyProductChanges({ upserts = [], deletes = [] }) {
  await prisma.$transaction(
    async (tx) => {
      if (deletes.length) await tx.product.deleteMany({ where: { id: { in: deletes } } })
      for (let i = 0; i < upserts.length; i += CHUNK) {
        const rows = upserts.slice(i, i + CHUNK).map((p) => ({ id: p.id, ...toRow(p) }))
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "Product" ("id", "shopeeId", "sku", "name", "status", "categoryId", "price", "data", "updatedAt")
          SELECT t.id, t."shopeeId", t.sku, t.name, t.status, t."categoryId", t.price, t.data::jsonb, now()
          FROM unnest(
            ${rows.map((r) => r.id)}::text[],
            ${rows.map((r) => r.shopeeId)}::text[],
            ${rows.map((r) => r.sku)}::text[],
            ${rows.map((r) => r.name)}::text[],
            ${rows.map((r) => r.status)}::text[],
            ${rows.map((r) => r.categoryId)}::text[],
            ${rows.map((r) => r.price)}::int[],
            ${rows.map((r) => JSON.stringify(r.data))}::text[]
          ) AS t(id, "shopeeId", sku, name, status, "categoryId", price, data)
          ON CONFLICT ("id") DO UPDATE SET
            "shopeeId" = EXCLUDED."shopeeId", "sku" = EXCLUDED."sku", "name" = EXCLUDED."name",
            "status" = EXCLUDED."status", "categoryId" = EXCLUDED."categoryId", "price" = EXCLUDED."price",
            "data" = EXCLUDED."data", "updatedAt" = EXCLUDED."updatedAt"`)
      }
    },
    { timeout: 30000, maxWait: 10000 },
  )
  await loadProducts()
}

// ---------------------------------------------------------------------------
// Tồn kho theo đơn hàng
// ---------------------------------------------------------------------------

export class StockError extends Error {}

// Mã sản phẩm trên website ("sp<MãShopee>" hoặc mã admin) -> dòng trong bảng Product (khóa dòng để hai đơn cùng lúc không bán vượt hàng).
async function lockProductRow(tx, productId) {
  const shopeeId = String(productId).startsWith('sp') ? String(productId).slice(2) : null
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "data" FROM "Product"
    WHERE "id" = ${String(productId)} OR ("shopeeId" IS NOT NULL AND "shopeeId" = ${shopeeId})
    LIMIT 1 FOR UPDATE`)
  return rows[0] || null
}

const sumStock = (p) => (p.variants || []).reduce((n, v) => n + (Number(v.stock) || 0), 0)

// lines: [{ productId, variant (nhãn phân loại hoặc null), quantity }]. direction = -1 trừ kho, +1 cộng lại.
// Chạy trong giao dịch của đơn hàng. Trả về true nếu có sản phẩm trong database được cập nhật.
async function adjustStock(tx, lines, direction) {
  let touched = false
  const byProduct = new Map()
  for (const l of lines) {
    if (!l.productId) continue
    if (!byProduct.has(l.productId)) byProduct.set(l.productId, [])
    byProduct.get(l.productId).push(l)
  }
  for (const [productId, items] of byProduct) {
    const row = await lockProductRow(tx, productId)
    if (!row) continue // đang dùng danh sách tĩnh (chưa có sản phẩm trong database): không có tồn kho để trừ
    const p = row.data
    for (const l of items) {
      const qty = Number(l.quantity) || 0
      if (l.variant && p.hasVariants) {
        const v = (p.variants || []).find((x) => x.label === l.variant)
        if (!v) continue
        const next = (Number(v.stock) || 0) + direction * qty
        if (next < 0) throw new StockError(`"${p.name}" (${v.label}) chỉ còn ${Number(v.stock) || 0} sản phẩm.`)
        v.stock = next
      } else if (!p.hasVariants) {
        const next = (Number(p.stock) || 0) + direction * qty
        if (next < 0) throw new StockError(`"${p.name}" chỉ còn ${Number(p.stock) || 0} sản phẩm.`)
        p.stock = next
      }
      p.sold = Math.max(0, (Number(p.sold) || 0) - direction * qty) // đã bán tăng khi trừ kho, giảm khi hoàn
    }
    if (p.hasVariants) p.stock = sumStock(p)
    p.updatedAt = new Date().toISOString()
    await tx.product.update({ where: { id: row.id }, data: { data: p } })
    touched = true
  }
  return touched
}

export const reserveStock = (tx, lines) => adjustStock(tx, lines, -1)
export const releaseStock = (tx, lines) => adjustStock(tx, lines, +1)
