import { getCodeInfo, normCode } from './productStore.js'

// Nhập giảm giá từ file Excel: mỗi dòng có Mã phân loại hàng (hoặc Mã sản phẩm nếu sản phẩm không có phân loại), Giá Gốc và Giá đang hiển thị
// (giá đã áp mã giảm). Phần trăm giảm được tính ngược = 1 - giá hiển thị / giá gốc. Website hiện giá gốc gạch ngang, giá giảm và % giảm;
// giá bán đúng bằng "Giá đang hiển thị" trong file (không bị lệch do làm tròn %).
export const MAX_IMPORT_ROWS = 5000
const MAX_PERCENT = 90

const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : NaN
}
const idText = (v) => String(v ?? '').trim().replace(/\.0+$/, '')

// rows: [{ row, productCode, variantCode, listPrice, salePrice }]; existingRules: danh sách đang lưu.
// Trả về { results, rules, summary }: results từng dòng (ok | clear | none | error), rules là danh sách mới nếu áp dụng.
export function analyzeImport(rows, existingRules = [], lookup = getCodeInfo) {
  const results = []
  const seen = new Map() // target -> số dòng
  const apply = new Map() // target -> rule mới (ok)
  const cleared = new Set()

  const existingByTarget = new Map()
  for (const r of existingRules) {
    const info = lookup(r.code ?? r.variantId ?? r.sku)
    if (info) existingByTarget.set(info.target, r)
  }

  for (const raw of rows) {
    const productCode = idText(raw.productCode)
    const variantCode = idText(raw.variantCode)
    const listPrice = money(raw.listPrice)
    const salePrice = money(raw.salePrice)
    const base = { row: raw.row, productCode, variantCode, listPrice: Number.isNaN(listPrice) ? null : listPrice, salePrice: Number.isNaN(salePrice) ? null : salePrice }
    const fail = (message) => results.push({ ...base, status: 'error', message })

    if (!variantCode && !productCode) { fail('Thiếu Mã phân loại hàng và Mã sản phẩm.'); continue }

    let info
    if (variantCode) {
      info = lookup(variantCode)
      if (!info || info.kind !== 'variant') { fail(`Không tìm thấy mã phân loại "${variantCode}" trong kho sản phẩm.`); continue }
      if (productCode && !info.productCodes.includes(normCode(productCode))) { fail(`Mã phân loại "${variantCode}" không thuộc sản phẩm "${productCode}".`); continue }
    } else {
      info = lookup(productCode)
      if (!info) { fail(`Không tìm thấy mã sản phẩm "${productCode}" trong kho sản phẩm.`); continue }
      if (info.kind === 'product' && info.hasVariants) { fail('Sản phẩm có nhiều phân loại: cần điền Mã phân loại hàng.'); continue }
    }
    const code = variantCode || productCode
    const common = { ...base, code, name: info.name, label: info.label || null, catalogPrice: info.price }

    if (!(listPrice > 0) || !(salePrice > 0)) { results.push({ ...common, status: 'error', message: 'Thiếu hoặc sai Giá Gốc / Giá đang hiển thị.' }); continue }
    if (salePrice > listPrice) { results.push({ ...common, status: 'error', message: 'Giá đang hiển thị cao hơn Giá Gốc.' }); continue }
    if (seen.has(info.target)) { results.push({ ...common, status: 'error', message: `Trùng với dòng ${seen.get(info.target)} trong file.` }); continue }

    const percent = Math.round((1 - salePrice / listPrice) * 100)
    if (percent > MAX_PERCENT) { results.push({ ...common, percent, status: 'error', message: `Giảm ${percent}% vượt mức tối đa ${MAX_PERCENT}%.` }); continue }
    seen.set(info.target, raw.row)
    const warning = info.price !== listPrice ? `Giá trong kho (${info.price.toLocaleString('vi-VN')}đ) khác Giá Gốc trong file; sẽ lấy giá theo file.` : undefined

    if (percent < 1) {
      // Không còn giảm giá (giá hiển thị = giá gốc): bỏ quy tắc cũ của chính phân loại này nếu có.
      if (existingByTarget.has(info.target)) {
        cleared.add(info.target)
        results.push({ ...common, percent: 0, status: 'clear', message: 'Không còn giảm giá: sẽ bỏ giảm giá hiện có.' })
      } else {
        results.push({ ...common, percent: 0, status: 'none', message: 'Không giảm giá, bỏ qua.' })
      }
      continue
    }
    apply.set(info.target, { code, percent, originalPrice: listPrice, salePrice })
    results.push({ ...common, percent, status: 'ok', ...(warning && { warning }) })
  }

  const kept = existingRules.filter((r) => {
    const info = lookup(r.code ?? r.variantId ?? r.sku)
    return !info || !(apply.has(info.target) || cleared.has(info.target))
  })
  const rules = [...kept, ...apply.values()]
  const count = (st) => results.filter((r) => r.status === st).length
  return { results, rules, summary: { total: results.length, ok: count('ok'), clear: count('clear'), none: count('none'), error: count('error') } }
}
