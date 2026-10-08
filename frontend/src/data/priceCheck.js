// Phát hiện giá không đồng nhất để báo lên dashboard khi cập nhật giá.
//
// Hai quy tắc (chênh giá khác kích thước thì BÌNH THƯỜNG, không báo):
//  1. 'size-price'  — cùng sản phẩm, cùng kích thước, cùng LOẠI rèm (Ore, Dán, Rido, Voan, 2 lớp...),
//                      bất kể màu, mà giá khác nhau.
//  2. 'sku-price'   — cùng SKU, cùng kích thước nhưng giá khác nhau (SKU dùng trùng cho 2 phân loại).
//
// Kích thước nhận diện theo thuộc tính tên "Kích thước"/"Size" của sản phẩm, nếu không có thì
// theo cột có giá trị giống kích thước (Rộng.. Cao.., 1.8m, 5cm...).

const SIZE_VALUE = /^(rộng|rông)|\d\s?m\b|\dm\d|\d\s?cm/i
const SIZE_NAME = /kích thước|kich thuoc|size/i

// '1m8' -> '1.8m', 'Rông 1.6m' -> 'rộng1.6m': các cách viết khác nhau của cùng một cỡ coi là một.
export function normSize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/rông/g, 'rộng')
    .replace(/(\d)m(\d)/g, '$1.$2m')
    .replace(/\s+/g, '')
}

// Loại rèm nằm lẫn trong tên phân loại ("Dán 2 Lớp Xám Ghi", "Rido Xanh Lá", "KHOEN LỖ ORE"...),
// nên nhận diện bằng từ khóa; màu không tham gia. Không có từ khóa nào thì so cả phần chữ còn lại
// sau khi bỏ chữ chỉ màu (vd. "PÁT ĐỠ GẮN TƯỜNG" khác "PÁT ĐỠ GẮN TRẦN").
const KIND_KEYWORDS = [
  ['ore', /ore|khoen|đục lỗ/],
  ['rido', /rido/],
  ['ray', /\bray\b/],
  ['dan', /dán/],
  ['voan', /voan/],
  ['2lop', /2 lớp|hai lớp/],
  // kiểu vải voan: trơn / hạt mưa / kẻ là các loại khác nhau, chênh giá là bình thường
  ['tron', /trơn/],
  ['hatmua', /hạt\s?mưa/],
  ['ke', /kẻ|xước/],
]
const COLOR_WORDS =
  /xám|xanh|nâu|hồng|vàng|trắng|đen|đỏ|kem|tím|bạc|ghi|đậm|nhạt|\blá\b|dương|biển|đất|phấn|tươi|óng ánh|tinh tế|ấm cúng|ngọt ngào|sang trọng|thiên nhiên|dịu mát|nhã nhặn|tinh khiết|gỗ|màu khác|cao cấp/gi

export function kindOf(text) {
  const t = String(text || '').toLowerCase()
  const found = KIND_KEYWORDS.filter(([, re]) => re.test(t)).map(([k]) => k)
  if (found.length) return found.join('+')
  return t.replace(COLOR_WORDS, '').replace(/[^a-zà-ỹ0-9+]/gi, '')
}

function sizeIndex(product, partsList) {
  const attrs = product.variantAttributes || []
  const byName = attrs.findIndex((a) => SIZE_NAME.test(a.name || ''))
  if (byName >= 0) return byName
  const n = Math.max(0, ...partsList.map((p) => p.length))
  let best = -1
  let bestScore = 0
  for (let i = 0; i < n; i++) {
    const score = partsList.filter((p) => p[i] && SIZE_VALUE.test(p[i])).length
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

function buildRows(products) {
  const rows = []
  for (const p of products) {
    const variants = p.variants || []
    if (!p.hasVariants || variants.length === 0) continue
    const partsList = variants.map((v) => String(v.label || '').split(' / ').map((t) => t.trim()))
    const si = sizeIndex(p, partsList)
    variants.forEach((v, i) => {
      const parts = partsList[i]
      const price = Number(v.price)
      if (!Number.isFinite(price)) return
      rows.push({
        productId: p.id,
        productName: p.name,
        shopeeId: p.shopeeId || '',
        variantId: v.id,
        label: v.label,
        sku: String(v.sku || '').trim(),
        price,
        sizeText: si >= 0 ? parts[si] || '' : '',
        size: si >= 0 ? normSize(parts[si]) : '',
        other: parts.filter((_, k) => k !== si).join(' / '),
      })
    })
  }
  return rows
}

// Giá xuất hiện nhiều nhất trong nhóm (nếu có một mức rõ ràng nhiều hơn mức khác).
function commonPrice(rows) {
  const count = new Map()
  for (const r of rows) count.set(r.price, (count.get(r.price) || 0) + 1)
  const sorted = [...count].sort((a, b) => b[1] - a[1])
  if (sorted.length < 2 || sorted[0][1] === sorted[1][1]) return null
  return { price: sorted[0][0], count: sorted[0][1] }
}

// Chữ ký của một cảnh báo: đổi giá thì chữ ký đổi, nên cảnh báo đã "bỏ qua" sẽ hiện lại.
export function issueSignature(issue) {
  return issue.rows
    .map((r) => `${r.variantId}:${r.price}`)
    .sort()
    .join('|')
}

export function findPriceConflicts(products) {
  const rows = buildRows(products)
  const issues = []
  const sizeGroupKeys = new Map() // variantId -> khóa nhóm kích thước (để không báo trùng ở quy tắc 2)

  // Quy tắc 1: cùng sản phẩm + cùng kích thước + cùng loại rèm (không quan tâm màu) mà giá khác
  const groups = new Map()
  for (const r of rows) {
    if (!r.size) continue
    const key = `${r.productId}|${r.size}|${kindOf(r.other)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
    sizeGroupKeys.set(r.variantId, key)
  }
  for (const [key, g] of groups) {
    if (new Set(g.map((x) => x.price)).size < 2) continue
    const common = commonPrice(g)
    issues.push({
      id: `size|${key}`,
      type: 'size-price',
      severity: 'warn',
      productId: g[0].productId,
      productName: g[0].productName,
      sizeText: g[0].sizeText,
      rows: g,
      common,
      oddIds: new Set(common ? g.filter((x) => x.price !== common.price).map((x) => x.variantId) : g.map((x) => x.variantId)),
    })
  }

  // Quy tắc 2: cùng SKU + cùng kích thước nhưng giá khác
  const bySku = new Map()
  for (const r of rows) {
    if (!r.sku || !r.size) continue
    const key = `${r.sku}|${r.size}`
    if (!bySku.has(key)) bySku.set(key, [])
    bySku.get(key).push(r)
  }
  for (const [key, g] of bySku) {
    if (g.length < 2 || new Set(g.map((x) => x.price)).size < 2) continue
    const inOneSizeGroup = new Set(g.map((x) => sizeGroupKeys.get(x.variantId))).size === 1
    if (inOneSizeGroup) continue // đã báo ở quy tắc 1
    issues.push({
      id: `sku|${key}`,
      type: 'sku-price',
      severity: 'error',
      productId: g[0].productId,
      productName: [...new Set(g.map((x) => x.productName))].length > 1 ? 'SKU dùng cho nhiều sản phẩm' : g[0].productName,
      sku: g[0].sku,
      sizeText: g[0].sizeText,
      rows: g,
      common: commonPrice(g),
      oddIds: new Set(g.map((x) => x.variantId)),
    })
  }

  issues.sort((a, b) => (a.severity === b.severity ? a.productName.localeCompare(b.productName, 'vi') : a.severity === 'error' ? -1 : 1))
  return {
    issues,
    totals: {
      all: issues.length,
      size: issues.filter((i) => i.type === 'size-price').length,
      sku: issues.filter((i) => i.type === 'sku-price').length,
    },
  }
}
