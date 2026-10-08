// Nhập / xuất hàng loạt sản phẩm theo 3 mẫu Excel "mass_update_*" (basic_info,
// media_info, sales_info). Toàn bộ chạy trên trình duyệt vì kho sản phẩm admin
// nằm trong localStorage (xem adminProducts.js).
//
// Quy ước khi nhập: ô để trống = giữ nguyên dữ liệu hiện có (không xoá).
// Sản phẩm được khớp theo Mã Sản phẩm -> SKU Sản phẩm; nếu không thấy thì tạo mới
// (có thể tắt).
import { categories } from './shop'
import { generateProductId, listProducts, saveAllProducts, REMOVED_SHOPEE_IDS } from './adminProducts'

export const KINDS = {
  basic: { key: 'basic_info', label: 'Thông tin cơ bản', desc: 'Mã, SKU, tên, mô tả' },
  media: { key: 'media_info', label: 'Hình ảnh', desc: 'Ảnh bìa, ảnh sản phẩm, ảnh phân loại' },
  sales: { key: 'sales_info', label: 'Thông tin bán hàng', desc: 'Phân loại, giá, tồn kho' },
}

const DEFAULT_CATEGORY = '101155 - Home & Living/Decoration/Curtains & Blinds'
const MARKETS = ['MY', 'PH', 'SG', 'TH']
const MAX_OPTIONS = 11
const MAX_IMAGES = 8
const FIRST_DATA_ROW = 7
const MIN_PRICE = 1000
const MAX_PRICE = 120000000

// ---------------------------------------------------------------------------
// Excel helpers
// ---------------------------------------------------------------------------

let excelPromise
function loadExcelJS() {
  excelPromise ||= import('exceljs').then((m) => m.default || m)
  return excelPromise
}

function cellText(cell) {
  const v = cell?.value
  if (v == null) return ''
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('')
    if (v.result !== undefined && v.result !== null) return String(v.result)
    if (v.text !== undefined) return String(v.text)
    if (v instanceof Date) return v.toISOString()
    return ''
  }
  return String(v)
}

function headerMap(ws) {
  const map = {}
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const key = cellText(cell).trim()
    if (key) map[key] = col
  })
  return map
}

function detectKind(ws, headers) {
  const tag = cellText(ws.getRow(2).getCell(1)).trim()
  for (const [kind, def] of Object.entries(KINDS)) if (tag === def.key) return kind
  if (headers.et_title_product_description) return 'basic'
  if (headers.ps_item_cover_image) return 'media'
  if (headers.et_title_variation_price) return 'sales'
  return null
}

const normId = (v) => String(v ?? '').trim().replace(/\.0+$/, '')
const isId = (v) => /^\d+$/.test(v)

function toInt(text) {
  const n = Number(String(text).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

// Đọc một file Excel -> { kind, fileName, rows, errors }
export async function parseWorkbookFile(file) {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('File không có sheet nào.')
  const headers = headerMap(ws)
  const kind = detectKind(ws, headers)
  if (!kind) throw new Error('Không nhận ra mẫu file (cần basic_info, media_info hoặc sales_info).')

  const col = (row, key) => (headers[key] ? cellText(row.getCell(headers[key])).trim() : '')
  const rows = []
  const errors = []
  const err = (r, message) => errors.push({ file: file.name, row: r, message })

  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (r < FIRST_DATA_ROW) return
    const id = normId(col(row, 'et_title_product_id'))
    const name = col(row, 'et_title_product_name')
    const parentSku = col(row, 'et_title_parent_sku')
    if (!id && !name && !parentSku) return
    if (id && !isId(id)) return err(r, `Mã Sản phẩm "${id}" không hợp lệ.`)
    if (!id && !parentSku) return err(r, 'Thiếu Mã Sản phẩm và SKU Sản phẩm, không xác định được sản phẩm.')

    if (kind === 'basic') {
      rows.push({ row: r, id, parentSku, name, description: col(row, 'et_title_product_description') })
    } else if (kind === 'media') {
      const images = [col(row, 'ps_item_cover_image')]
      for (let i = 1; i <= MAX_IMAGES; i++) images.push(col(row, `ps_item_image.${i}`))
      const options = []
      for (let i = 1; i <= MAX_OPTIONS; i++) {
        const optName = col(row, `et_title_option_${i}_for_variation_1`)
        if (optName) options.push({ name: optName, image: col(row, `et_title_option_image_${i}_for_variation_1`) })
      }
      rows.push({
        row: r,
        id,
        parentSku,
        name,
        category: col(row, 'et_title_product_category'),
        images: images.filter(Boolean),
        sizeChartTemplate: col(row, 'ps_new_size_chart'),
        sizeChartImage: col(row, 'et_title_size_chart'),
        varName: col(row, 'et_title_variation_1'),
        options,
      })
    } else {
      const price = col(row, 'et_title_variation_price')
      const stock = col(row, 'et_title_variation_stock')
      const item = {
        row: r,
        id,
        parentSku,
        name,
        variantId: normId(col(row, 'et_title_variation_id')),
        variantName: col(row, 'et_title_variation_name'),
        variantSku: col(row, 'et_title_variation_sku'),
        gtin: col(row, 'ps_gtin_code'),
        price: null,
        stock: null,
        marketPrices: {},
      }
      if (price !== '') {
        const n = toInt(price)
        if (!Number.isFinite(n) || n < MIN_PRICE || n > MAX_PRICE) {
          return err(r, `Giá "${price}" không hợp lệ (phải từ ${MIN_PRICE.toLocaleString('vi-VN')} đến ${MAX_PRICE.toLocaleString('vi-VN')}).`)
        }
        item.price = Math.round(n)
      }
      if (stock !== '') {
        const n = toInt(stock)
        if (!Number.isInteger(n) || n < 0) return err(r, `Số lượng "${stock}" không hợp lệ (phải là số nguyên >= 0).`)
        item.stock = n
      }
      for (const m of MARKETS) {
        const v = col(row, `ps_direct_listing_price.${m}`)
        if (v !== '' && Number.isFinite(Number(v))) item.marketPrices[m] = Number(v)
      }
      rows.push(item)
    }
  })

  return { kind, fileName: file.name, rows, errors }
}

// ---------------------------------------------------------------------------
// Build patches + preview
// ---------------------------------------------------------------------------

const patchKey = (r) => (r.id ? r.id : `sku:${r.parentSku}`)

// Gom dữ liệu của nhiều file (cùng một sản phẩm) thành một patch
function mergeParsed(parsedFiles) {
  const patches = new Map()
  const get = (r) => {
    const key = patchKey(r)
    if (!patches.has(key)) patches.set(key, { key, id: r.id, parentSku: r.parentSku, name: '', description: null, media: null, sales: [] })
    const p = patches.get(key)
    if (!p.parentSku && r.parentSku) p.parentSku = r.parentSku
    if (!p.name && r.name) p.name = r.name
    return p
  }
  for (const f of parsedFiles) {
    for (const r of f.rows) {
      const p = get(r)
      if (f.kind === 'basic') p.description = r.description || p.description
      else if (f.kind === 'media') p.media = r
      else p.sales.push(r)
    }
  }
  return [...patches.values()]
}

function guessCategoryId(name) {
  const n = (name || '').normalize('NFC').toLowerCase()
  const has = (id) => categories.some((c) => c.id === id)
  if (/dán tường|dan tuong|dán cửa|thanh dán|\brido\b/.test(n) && has('dan-tuong')) return 'dan-tuong'
  if (/thanh treo|thanh ray|ray trượt|pát|bát|giá đỡ|phụ kiện|dây cột|vén rèm|khoen|núm|đầu bịt|bi trượt/.test(n) && has('thanh-treo')) return 'thanh-treo'
  if (/\bore\b|đục lỗ|rèm lỗ/.test(n) && has('chong-nang')) return 'chong-nang'
  if (/gối|khăn|trải bàn/.test(n) && has('rem-khac')) return 'rem-khac'
  if (/voan|lụa|sheer/.test(n) && has('voan-lua')) return 'voan-lua'
  if (has('rem-khac')) return 'rem-khac'
  return categories[0]?.id || ''
}

function newProductBase(patch) {
  const name = patch.name || `Sản phẩm ${patch.id || patch.parentSku}`
  const now = new Date().toISOString()
  return {
    id: generateProductId(name),
    sku: '',
    name,
    shortDescription: '',
    description: '',
    categoryId: guessCategoryId(name),
    brand: '',
    tags: [],
    images: [],
    price: 0,
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
    seo: { metaTitle: '', metaDescription: '', slug: '' },
    status: 'active',
    sold: 0,
    rating: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'import',
  }
}


// Khoá sắp xếp kích thước: "Rộng 1m8 Cao 2m4" -> [1.8, 2.4], "3.2m" -> [3.2], "5cm" -> [0.05].
// Nhãn không có số (Trắng, Gỗ...) xếp cuối, theo bảng chữ cái.
function sizeKey(label) {
  const text = String(label).normalize('NFC').toLowerCase()
  const nums = []
  const rx = /(\d+)\s*m\s*(\d+)|(\d+(?:[.,]\d+)?)\s*(cm|m)?/g
  let m
  while ((m = rx.exec(text))) {
    if (m[1] !== undefined) nums.push(parseFloat(`${m[1]}.${m[2]}`))
    else {
      const n = parseFloat(m[3].replace(',', '.'))
      nums.push(m[4] === 'cm' ? n / 100 : n)
    }
  }
  return nums
}

function compareSizes(a, b) {
  const ka = sizeKey(a)
  const kb = sizeKey(b)
  if (!ka.length || !kb.length) {
    if (ka.length !== kb.length) return ka.length ? -1 : 1
    return String(a).localeCompare(String(b), 'vi')
  }
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i] ?? -1
    const y = kb[i] ?? -1
    if (x !== y) return x - y
  }
  return 0
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const splitLabel = (label) => String(label).split(' / ')
const toLabel = (variantName) => variantName.split(',').map((s) => s.trim()).join(' / ')

// Áp một patch lên sản phẩm (hoặc tạo mới) -> { product, changes, warnings }
function applyPatch(existing, patch, usedSkus) {
  const isNew = !existing
  const p = isNew ? newProductBase(patch) : structuredClone(existing)
  const changes = []
  const warnings = []
  const note = (label) => {
    if (!changes.includes(label)) changes.push(label)
  }
  const set = (field, value, label) => {
    if (!same(p[field], value)) {
      p[field] = value
      note(label)
    }
  }

  if (patch.id) set('shopeeId', patch.id, 'Mã Shopee')

  // --- basic
  if (patch.name) set('name', patch.name, 'Tên')
  if (patch.description) set('description', patch.description, 'Mô tả')
  if (patch.parentSku) {
    set('shopeeParentSku', patch.parentSku, 'SKU')
    if (p.sku !== patch.parentSku) {
      if (usedSkus.has(patch.parentSku) && !(existing && existing.sku === patch.parentSku)) {
        warnings.push(`SKU "${patch.parentSku}" đã thuộc sản phẩm khác, giữ SKU cũ.`)
      } else {
        usedSkus.delete(p.sku)
        p.sku = patch.parentSku
        note('SKU')
      }
    }
  }
  if (!p.sku) {
    const base = patch.id ? `SP-${patch.id}` : `SP-${p.id.toUpperCase()}`
    let sku = base
    let n = 2
    while (usedSkus.has(sku)) sku = `${base}-${n++}`
    p.sku = sku
    if (!isNew) note('SKU')
  }
  usedSkus.add(p.sku)

  // --- media
  const m = patch.media
  if (m) {
    if (m.category) set('shopeeCategory', m.category, 'Ngành hàng')
    if (m.images.length) set('images', m.images, `Ảnh (${m.images.length})`)
    if (m.sizeChartTemplate || m.sizeChartImage) {
      set('sizeChart', { template: m.sizeChartTemplate, image: m.sizeChartImage }, 'Size chart')
    }
  }

  // --- sales
  const sales = patch.sales
  if (sales.length) {
    const named = sales.filter((s) => s.variantName)
    const single = sales.find((s) => !s.variantName)

    if (single) {
      if (single.variantId) set('shopeeVariantId', single.variantId, 'Mã phân loại')
      if (single.price != null) set('price', single.price, 'Giá')
      if (single.stock != null) set('stock', single.stock, 'Tồn kho')
      if (single.gtin) set('gtin', single.gtin, 'GTIN')
      if (Object.keys(single.marketPrices).length) set('marketPrices', { ...p.marketPrices, ...single.marketPrices }, 'Giá quốc tế')
    }

    if (named.length) {
      const variants = p.variants
      let added = 0
      let updated = 0
      named.forEach((s, i) => {
        const label = toLabel(s.variantName)
        let v = variants.find((x) => (s.variantId && x.shopeeVariantId === s.variantId) || x.label === label)
        const before = v ? JSON.stringify(v) : null
        if (!v) {
          v = {
            id: `var-${s.variantId || Date.now()}-${i}`,
            label,
            sku: '',
            price: 0,
            stock: 0,
            image: '',
            status: 'active',
          }
          variants.push(v)
        }
        v.label = label
        if (s.variantId) v.shopeeVariantId = s.variantId
        if (s.variantSku) {
          v.sku = s.variantSku
          delete v.skuAuto
        }
        if (!v.sku) {
          v.sku = `${p.sku}-${variants.indexOf(v) + 1}` // form admin bắt buộc có SKU; không xuất ra Excel
          v.skuAuto = true
        }
        if (s.price != null) v.price = s.price
        if (s.stock != null) v.stock = s.stock
        if (s.gtin) v.gtin = s.gtin
        if (Object.keys(s.marketPrices).length) v.marketPrices = { ...v.marketPrices, ...s.marketPrices }
        if (before === null) added++
        else if (before !== JSON.stringify(v)) updated++
      })
      if (added) note(`Phân loại +${added}`)
      if (updated) note(`Phân loại ~${updated}`)
      p.hasVariants = true
      if (added || updated) {
        const prices = variants.map((v) => v.price).filter((n) => n > 0)
        set('price', prices.length ? Math.min(...prices) : p.price, 'Giá')
        set('stock', variants.reduce((sum, v) => sum + (v.stock || 0), 0), 'Tồn kho')
      }
    }
  }

  // --- thuộc tính phân loại: dựng lại từ nhãn các biến thể + tên nhóm/ảnh từ media_info
  if (p.hasVariants || (m && m.options.length)) {
    const parts = p.variants.map((v) => splitLabel(v.label))
    const groupCount = Math.max(1, ...parts.map((x) => x.length))
    const prevAttrs = p.variantAttributes || []
    const attrs = []
    for (let i = 0; i < groupCount; i++) {
      const values = []
      for (const row of parts) if (row[i] !== undefined && !values.includes(row[i])) values.push(row[i])
      const prev = prevAttrs[i]
      const prevName = prev?.name && !/^Phân loại \d+$/.test(prev.name) ? prev.name : ''
      const name = (i === 0 && m?.varName) || prevName || (i === 0 ? 'Phân loại' : 'Kích thước')
      const attr = { ...(prev || {}), name, values: values.length ? values : prev?.values || [] }
      attrs.push(attr)
    }
    if (m && m.options.length) {
      const images = { ...(attrs[0].optionImages || {}) }
      for (const o of m.options) if (o.image) images[o.name] = o.image
      // thứ tự tuỳ chọn theo media_info, các giá trị còn lại (từ biến thể) xếp sau
      const ordered = m.options.map((o) => o.name)
      attrs[0].values = [...ordered, ...attrs[0].values.filter((v) => !ordered.includes(v))]
      attrs[0].optionImages = images
      for (const v of p.variants) {
        const first = splitLabel(v.label)[0]
        if (images[first] && v.image !== images[first]) v.image = images[first]
      }
    }
    // nhóm phân loại thứ 2 trở đi (kích thước) sắp theo thứ tự số; biến thể xếp theo nhóm 1 rồi kích thước
    attrs.forEach((a, i) => {
      if (i >= 1 || /kích thước|dài/i.test(a.name)) a.values = [...a.values].sort(compareSizes)
    })
    if (attrs.length > 1) {
      const order0 = attrs[0].values
      p.variants.sort((x, y) => {
        const px = splitLabel(x.label)
        const py = splitLabel(y.label)
        const d = order0.indexOf(px[0]) - order0.indexOf(py[0])
        return d || compareSizes(px.slice(1).join(' / '), py.slice(1).join(' / '))
      })
    }
    if (!same(prevAttrs, attrs)) {
      p.variantAttributes = attrs
      if (m?.varName || m?.options.length) note('Nhóm phân loại')
    }
  }

  if (!isNew && changes.length) {
    p.updatedAt = new Date().toISOString()
    p.updatedBy = 'import'
  }
  return { product: p, changes, warnings }
}

// Xem trước: không ghi gì. options.createMissing = tạo sản phẩm chưa có.
export function buildPreview(parsedFiles, { createMissing = true } = {}) {
  const current = listProducts()
  const byShopeeId = new Map()
  const bySku = new Map()
  current.forEach((p) => {
    if (p.shopeeId) byShopeeId.set(String(p.shopeeId), p)
    bySku.set(p.sku, p)
    if (p.shopeeParentSku) bySku.set(p.shopeeParentSku, p)
  })
  const usedSkus = new Set(current.map((p) => p.sku))
  const patches = mergeParsed(parsedFiles)

  const items = []
  const nextList = [...current]
  for (const patch of patches) {
    // Sản phẩm đặt riêng/may đo đã loại khỏi danh mục: không tạo lại, không cập nhật.
    if (REMOVED_SHOPEE_IDS.has(patch.id)) {
      items.push({ key: patch.key, name: patch.name || patch.key, status: 'skipped', changes: [], warnings: ['Sản phẩm đặt riêng/may đo, không đưa vào danh mục.'] })
      continue
    }
    const existing = (patch.id && byShopeeId.get(patch.id)) || (patch.parentSku && bySku.get(patch.parentSku)) || null
    if (!existing && !createMissing) {
      items.push({ key: patch.key, name: patch.name || patch.key, status: 'skipped', changes: [], warnings: ['Không có trong hệ thống.'] })
      continue
    }
    const { product, changes, warnings } = applyPatch(existing, patch, usedSkus)
    if (existing) {
      const idx = nextList.findIndex((p) => p.id === existing.id)
      if (changes.length) nextList[idx] = product
      items.push({ key: patch.key, name: product.name, status: changes.length ? 'update' : 'unchanged', changes, warnings })
    } else {
      nextList.push(product)
      // Mỗi file Excel chỉ mang một phần thông tin: báo rõ phần nào sản phẩm mới còn thiếu.
      const missing = []
      if (patch.description == null) missing.push('mô tả (file basic_info)')
      if (!patch.media) missing.push('ảnh (file media_info)')
      if (!patch.sales.length) missing.push('phân loại, giá, tồn kho (file sales_info)')
      if (missing.length) warnings.push(`Sản phẩm mới còn thiếu: ${missing.join(', ')}. Chọn đủ cả 3 file hoặc nhập thêm sau.`)
      items.push({ key: patch.key, name: product.name, status: 'create', changes: ['Tạo mới'], warnings })
    }
  }
  return { items, nextList }
}

export function commitPreview(preview) {
  saveAllProducts(preview.nextList)
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const asCell = (v) => (typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : v)

function variantRows(p) {
  if (p.hasVariants && p.variants?.length) return p.variants
  return null
}

function firstAttrImage(p, value) {
  const fromMap = p.variantAttributes?.[0]?.optionImages?.[value]
  if (fromMap) return fromMap
  const v = (p.variants || []).find((x) => splitLabel(x.label)[0] === value && x.image)
  return v?.image || ''
}

function buildRows(kind, products) {
  const rows = []
  for (const p of products) {
    const id = p.shopeeId || ''
    const parentSku = p.shopeeId ? p.shopeeParentSku || '' : p.sku
    if (kind === 'basic') {
      rows.push({ et_title_product_id: id, et_title_parent_sku: parentSku, et_title_product_name: p.name, et_title_product_description: p.description || '' })
    } else if (kind === 'media') {
      const row = {
        et_title_product_id: id,
        et_title_parent_sku: parentSku,
        et_title_product_name: p.name,
        et_title_product_category: p.shopeeCategory || DEFAULT_CATEGORY,
        ps_item_cover_image: p.images?.[0] || '',
        ps_new_size_chart: p.sizeChart?.template || '',
        et_title_size_chart: p.sizeChart?.image || '',
      }
      for (let i = 1; i <= MAX_IMAGES; i++) row[`ps_item_image.${i}`] = p.images?.[i] || ''
      const attr = p.variantAttributes?.[0]
      if (p.hasVariants && attr) {
        row.et_title_variation_1 = attr.name
        attr.values.slice(0, MAX_OPTIONS).forEach((val, i) => {
          row[`et_title_option_${i + 1}_for_variation_1`] = val
          row[`et_title_option_image_${i + 1}_for_variation_1`] = firstAttrImage(p, val)
        })
      }
      rows.push(row)
    } else {
      const base = {
        et_title_product_id: id,
        et_title_product_name: p.name,
        et_title_parent_sku: parentSku,
      }
      const vs = variantRows(p)
      const fillMarkets = (target, src) => {
        for (const m of MARKETS) target[`ps_direct_listing_price.${m}`] = src?.marketPrices?.[m] ?? ''
      }
      if (vs) {
        vs.forEach((v, i) => {
          const row = {
            ...base,
            et_title_parent_sku: i === 0 ? parentSku : '', // mẫu gốc chỉ ghi SKU sản phẩm ở dòng đầu
            et_title_variation_id: v.shopeeVariantId || '',
            et_title_variation_name: splitLabel(v.label).join(','),
            et_title_variation_sku: v.skuAuto ? '' : v.sku || '',
            et_title_variation_price: v.price,
            ps_gtin_code: v.gtin || '',
            et_title_variation_stock: v.stock,
          }
          fillMarkets(row, v)
          rows.push(row)
        })
      } else {
        const row = {
          ...base,
          et_title_variation_id: p.shopeeVariantId || '',
          et_title_variation_name: '',
          et_title_variation_sku: '',
          et_title_variation_price: p.price,
          ps_gtin_code: p.gtin || '',
          et_title_variation_stock: p.stock,
        }
        fillMarkets(row, p)
        rows.push(row)
      }
    }
  }
  return rows
}

// Tạo file .xlsx từ mẫu gốc (giữ nguyên tiêu đề, dòng ẩn, định dạng) và điền dữ liệu từ dòng 7.
export async function exportKind(kind, products) {
  const ExcelJS = await loadExcelJS()
  const res = await fetch(`/templates/${KINDS[kind].key}.xlsx`)
  if (!res.ok) throw new Error('Không tải được file mẫu.')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await res.arrayBuffer())
  const ws = wb.worksheets[0]
  const headers = headerMap(ws)
  const rows = buildRows(kind, products)

  rows.forEach((data, i) => {
    const row = ws.getRow(FIRST_DATA_ROW + i)
    for (const [key, value] of Object.entries(data)) {
      const c = headers[key]
      if (!c || value === '' || value == null) continue
      const cell = row.getCell(c)
      const isIdCol = key === 'et_title_product_id' || key === 'et_title_variation_id'
      cell.value = isIdCol ? asCell(String(value)) : value
      cell.font = { name: 'Arial', size: 10 }
      if (typeof cell.value === 'number') cell.numFmt = key.startsWith('ps_direct') ? '0.00' : '0'
    }
    row.commit?.()
  })

  const buffer = await wb.xlsx.writeBuffer()
  return { blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), count: rows.length }
}

export function exportFileName(kind, date = new Date()) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `mass_update_${KINDS[kind].key} (${d}-${m}-${date.getFullYear()}).xlsx`
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
