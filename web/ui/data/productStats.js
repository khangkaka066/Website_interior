// Thống kê sản phẩm đang bán và phát hiện các sản phẩm trùng/na ná nhau (để so lệch giá).

const STOP = new Set([
  'rèm', 'cửa', 'sổ', 'cao', 'cấp', 'loại', 'giá', 'xưởng', 'nhiều', 'màu', 'sắc', 'phòng', 'ngủ', 'và', 'cho',
  'kèm', 'các', 'đủ', 'của', 'là', 'có', 'với', 'size', 'kích', 'thước', 'the', 'phụ', 'kiện', 'cái', 'mét',
])

const norm = (s) => String(s || '').normalize('NFC').toLowerCase()

// Bỏ phần trong ngoặc (màu/số lượng) để gom các bản đăng của cùng một mặt hàng
export function nameTokens(name) {
  const base = norm(name).replace(/\([^)]*\)/g, ' ')
  return new Set(
    base
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t)),
  )
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

const priceRange = (p) => {
  const prices = p.hasVariants && p.variants?.length ? p.variants.map((v) => v.price).filter((n) => n > 0) : []
  if (!prices.length) return { min: p.price || 0, max: p.price || 0 }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

const isSelling = (p) => p.status === 'active'

export function summarizeProduct(p) {
  const { min, max } = priceRange(p)
  const variantCount = p.hasVariants ? p.variants?.length || 0 : 0
  return {
    id: p.id,
    shopeeId: p.shopeeId || '',
    sku: p.sku,
    name: p.name,
    image: p.images?.[0] || '',
    categoryId: p.categoryId,
    status: p.status,
    min,
    max,
    variantCount,
    stock: p.stock || 0,
    tokens: nameTokens(p.name),
    variants: p.hasVariants ? p.variants || [] : [],
  }
}

// Hai sản phẩm được coi là "cùng một mặt hàng" khi tên rất giống nhau, hoặc khi bán cùng các phân loại
// (trùng nhãn màu/kích thước) — tín hiệu mạnh hơn tên vì mỗi bản đăng thường đặt tên khác nhau.
const NAME_THRESHOLD = 0.6
const LABEL_MIN_SHARED = 4
const LABEL_MIN_RATIO = 0.5
const LABEL_MIN_NAME_SIM = 0.25 // tránh gom nhầm các mặt hàng khác nhau chỉ vì cùng bảng màu (Đỏ, Xanh...)

function labelSet(item) {
  return new Set(item.variants.map((v) => norm(v.label)))
}

function areSame(a, b, labelsA, labelsB) {
  const nameSim = jaccard(a.tokens, b.tokens)
  if (nameSim >= NAME_THRESHOLD) return true
  if (nameSim >= LABEL_MIN_NAME_SIM && labelsA.size && labelsB.size) {
    let shared = 0
    for (const l of labelsA) if (labelsB.has(l)) shared++
    if (shared >= LABEL_MIN_SHARED && shared / Math.min(labelsA.size, labelsB.size) >= LABEL_MIN_RATIO) return true
  }
  return false
}

export function groupSimilar(items) {
  const labels = items.map(labelSet)
  const parent = items.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (find(i) !== find(j) && areSame(items[i], items[j], labels[i], labels[j])) parent[find(j)] = find(i)
    }
  }
  const groups = new Map()
  items.forEach((it, i) => {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(it)
  })
  return [...groups.values()]
}

// Cùng một nhãn phân loại nhưng giá khác nhau giữa các sản phẩm trong nhóm.
function variantMismatches(group) {
  const byLabel = new Map()
  for (const it of group) {
    for (const v of it.variants) {
      const key = norm(v.label)
      if (!byLabel.has(key)) byLabel.set(key, [])
      byLabel.get(key).push({ productId: it.id, price: v.price })
    }
  }
  let mismatched = 0
  let shared = 0
  for (const rows of byLabel.values()) {
    if (new Set(rows.map((r) => r.productId)).size < 2) continue
    shared++
    if (new Set(rows.map((r) => r.price)).size > 1) mismatched++
  }
  return { shared, mismatched }
}

export function buildProductStats(products) {
  const selling = products.filter(isSelling).map(summarizeProduct)
  const groups = groupSimilar(selling)
    .filter((g) => g.length > 1)
    .map((g, i) => {
      const members = [...g].sort((a, b) => a.min - b.min)
      const lowest = members[0].min
      const highest = members[members.length - 1].min
      const spread = highest - lowest
      return {
        key: `g${i}`,
        title: members[0].name,
        members: members.map((m) => ({ ...m, diffPct: lowest > 0 ? Math.round(((m.min - lowest) / lowest) * 100) : 0 })),
        lowest,
        highest,
        spread,
        spreadPct: lowest > 0 ? Math.round((spread / lowest) * 100) : 0,
        ...variantMismatches(members),
      }
    })
    .sort((a, b) => b.spreadPct - a.spreadPct)

  const inGroup = new Set(groups.flatMap((g) => g.members.map((m) => m.id)))
  return {
    selling,
    groups,
    totals: {
      products: selling.length,
      variants: selling.reduce((s, p) => s + p.variantCount, 0),
      stock: selling.reduce((s, p) => s + p.stock, 0),
      duplicateGroups: groups.length,
      duplicateProducts: inGroup.size,
      priceMismatchGroups: groups.filter((g) => g.spread > 0).length,
      hidden: products.filter((p) => p.status === 'hidden').length,
      draft: products.filter((p) => p.status === 'draft').length,
    },
    inGroup,
  }
}
