// Tìm kiếm thông minh chạy ngay trên trình duyệt (danh mục chỉ vài chục sản phẩm nên trả kết quả trong vài ms):
//  - bỏ dấu + không phân biệt hoa thường ("rem ore" tìm được "Rèm đục lỗ ORE")
//  - từ đồng nghĩa / tên gọi khác ("khoen" = "ore" = "đục lỗ", "cách nhiệt" = "chống nắng"...)
//  - sửa lỗi chính tả theo từ vựng của chính cửa hàng ("rem doan tuong" -> "rem dan tuong")
//  - gợi ý khi đang gõ: sản phẩm, danh mục, từ khóa
import { categories } from './shop'

export const fold = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ') // dấu chấm/phẩy chỉ giữ trong số (1.8m)
    .replace(/\s+/g, ' ')
    .trim()

// Mỗi nhóm là các cách gọi của cùng một thứ (đã bỏ dấu). Thêm nhóm mới ở đây.
const SYNONYM_GROUPS = [
  ['ore', 'khoen', 'khoen ore', 'duc lo', 'duc lo ore', 'khoen lo', 'lo ore'],
  ['rido', 'moc', 'moc rido', 'rem moc'],
  ['dan tuong', 'dan cua', 'rem dan', 'dan'],
  ['voan', 'voan lua', 'sheer', 'rem mong'],
  ['chong nang', 'cach nhiet', 'can sang', 'chan sang', 'che nang', 'chong sang', 'cach sang', 'chong nong'],
  ['thanh treo', 'thanh rem', 'gia treo', 'thanh ngang', 'thanh treo rem'],
  ['rem', 'man', 'rem cua', 'man cua', 'curtain'],
  ['khong khoan', 'khong can khoan', 'khong dung khoan', 'khong khoan tuong'],
  ['pat', 'bat', 'gia do', 'tru do'],
  ['vai gam', 'gam'],
  ['phong ngu', 'phong ngu cua so'],
  ['ray', 'thanh ray', 'ray truot'],
  ['khan trai ban', 'khan ban', 'trai ban'],
  ['goi tua', 'goi sofa', 'goi'],
]
const GROUP_OF = new Map() // cụm từ -> nhóm
for (const g of SYNONYM_GROUPS) for (const w of g) if (!GROUP_OF.has(w)) GROUP_OF.set(w, g)

const POPULAR_KEYWORDS = ['rèm ore', 'rèm dán tường', 'rèm rido', 'rèm voan', 'thanh treo rèm', 'chống nắng']

// Khoảng cách chỉnh sửa (có hoán đổi 2 ký tự liền kề) để nhận ra gõ sai chính tả.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2 = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2.splice(0, prev2.length, ...prev)
    prev = cur
  }
  return prev[b.length]
}

const maxTypos = (len) => (len <= 3 ? 0 : len <= 5 ? 1 : 2)

// ---------------------------------------------------------------------------
// Lọc theo màu / kích thước (đọc từ tên phân loại)
// ---------------------------------------------------------------------------

export const COLOR_FILTERS = [
  { id: 'xam', label: 'Xám / Ghi', words: ['xam', 'ghi'] },
  { id: 'xanh', label: 'Xanh', words: ['xanh'] },
  { id: 'nau', label: 'Nâu', words: ['nau'] },
  { id: 'hong', label: 'Hồng', words: ['hong'] },
  { id: 'vang', label: 'Vàng / Kem', words: ['vang', 'kem'] },
  { id: 'trang', label: 'Trắng', words: ['trang'] },
  { id: 'den', label: 'Đen', words: ['den'] },
  { id: 'bac', label: 'Bạc', words: ['bac'] },
]

export const WIDTH_FILTERS = [
  { id: 'w-lt15', label: 'Rộng dưới 1.5m', test: (w) => w < 1.5 },
  { id: 'w-15-2', label: 'Rộng 1.5m – dưới 2m', test: (w) => w >= 1.5 && w < 2 },
  { id: 'w-2-25', label: 'Rộng 2m – dưới 2.5m', test: (w) => w >= 2 && w < 2.5 },
  { id: 'w-ge25', label: 'Rộng từ 2.5m', test: (w) => w >= 2.5 },
]

// "Rộng 1.8m Cao 1.5m", "Rộng 1m8 Cao 1m5", "Rông 1.6m" -> số mét chiều rộng.
function parseWidth(foldedLabel) {
  const m = foldedLabel.match(/ro[nk]g\s*(\d+(?:[.,]\d+)?)\s*m\s*(\d+)?/)
  if (!m) return null
  const base = parseFloat(m[1].replace(',', '.'))
  return m[2] ? base + Number(m[2]) / 10 ** m[2].length : base
}

// ---------------------------------------------------------------------------
// Chỉ mục
// ---------------------------------------------------------------------------

export function buildIndex(products) {
  const vocab = new Map() // từ -> số lần xuất hiện
  const addWords = (text) => {
    for (const w of text.split(' ')) if (w.length >= 2 && !/^\d/.test(w)) vocab.set(w, (vocab.get(w) || 0) + 1)
  }
  for (const c of categories) addWords(fold(c.name))
  const docs = products.map((p) => {
    const labels = (p.variants || []).map((v) => fold(v.label))
    const options = (p.options || []).flatMap((o) => o.values || []).map(fold)
    const doc = {
      product: p,
      name: fold(p.name),
      type: fold(p.type),
      variants: [...new Set([...labels, ...options])].join(' | '),
      desc: fold(String(p.description || '').slice(0, 1500)),
      id: String(p.shopeeId || ''),
      colors: new Set(),
      widths: [],
      inStock: !p.variants?.length || p.variants.some((v) => v.stock > 0),
    }
    for (const c of COLOR_FILTERS) {
      if (c.words.some((w) => new RegExp(`\\b${w}\\b`).test(doc.variants))) doc.colors.add(c.id)
    }
    for (const l of labels) {
      const w = parseWidth(l)
      if (w != null) doc.widths.push(w)
    }
    addWords(doc.name)
    addWords(doc.type)
    addWords(doc.variants.replace(/\|/g, ' '))
    return doc
  })
  return { docs, vocab }
}

// ---------------------------------------------------------------------------
// Phân tích câu tìm: tách từ, gom cụm đồng nghĩa, sửa chính tả
// ---------------------------------------------------------------------------

function parseQuery(index, query) {
  const tokens = fold(query).split(' ').filter(Boolean)
  const units = []
  let corrected = false
  for (let i = 0; i < tokens.length; ) {
    let unit = null
    for (let n = Math.min(3, tokens.length - i); n >= 1 && !unit; n--) {
      const phrase = tokens.slice(i, i + n).join(' ')
      const group = GROUP_OF.get(phrase)
      if (group) {
        unit = { text: phrase, alts: [...new Set([phrase, ...group])], len: n }
      }
    }
    if (!unit) {
      let word = tokens[i]
      // Từ chưa có trong từ vựng (kể cả dạng đang gõ dở) thì thử sửa chính tả.
      const known = /\d/.test(word) || [...index.vocab.keys()].some((v) => v.startsWith(word))
      if (!known && maxTypos(word.length) > 0) {
        let best = null
        for (const [v, freq] of index.vocab) {
          const d = editDistance(word, v, maxTypos(word.length))
          if (d <= maxTypos(word.length) && (!best || d < best.d || (d === best.d && freq > best.freq))) best = { v, d, freq }
        }
        if (best) {
          word = best.v
          corrected = true
        }
      }
      unit = { text: word, alts: [word], len: 1 }
    }
    units.push(unit)
    i += unit.len
  }
  return { units, corrected, text: units.map((u) => u.text).join(' ') }
}

// Điểm khớp của một cụm với một sản phẩm (0 = không khớp).
function scoreAlt(doc, alt, useDesc) {
  const wordStart = new RegExp(`(^|[\\s|])${alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  let s = 0
  if (wordStart.test(doc.name)) s = Math.max(s, 6)
  else if (alt.length > 2 && doc.name.includes(alt)) s = Math.max(s, 4)
  if (wordStart.test(doc.type)) s = Math.max(s, 3)
  if (doc.id && doc.id === alt) s = Math.max(s, 8)
  if (wordStart.test(doc.variants)) s = Math.max(s, 3)
  if (useDesc && alt.length > 2 && wordStart.test(doc.desc)) s = Math.max(s, 1)
  return s
}

// Trả về { results: [{ product, score }], correctedQuery } — mọi cụm trong câu tìm đều phải khớp.
export function searchProducts(index, query) {
  const parsed = parseQuery(index, query)
  if (!parsed.units.length) return { results: index.docs.map((d) => ({ product: d.product, doc: d, score: 0 })), correctedQuery: null }
  // Lần 1 chỉ xét tên/loại/phân loại/mã; chỉ khi không có gì mới xét thêm mô tả (tránh mô tả dài làm kết quả loãng).
  const run = (useDesc) => {
    const out = []
    for (const doc of index.docs) {
      let total = 0
      let ok = true
      for (const u of parsed.units) {
        let best = 0
        for (const alt of u.alts) {
          let s = scoreAlt(doc, alt, useDesc)
          if (alt !== u.text) s *= 0.8 // khớp qua từ đồng nghĩa kém hơn khớp đúng từ gõ
          best = Math.max(best, s)
        }
        if (!best) {
          ok = false
          break
        }
        total += best
      }
      if (!ok) continue
      if (doc.name.includes(parsed.text)) total += 5 // cả cụm khớp liền nhau
      out.push({ product: doc.product, doc, score: total })
    }
    return out
  }
  let results = run(false)
  if (!results.length) results = run(true)
  results.sort((a, b) => b.score - a.score)
  return { results, correctedQuery: parsed.corrected ? parsed.text : null }
}

// ---------------------------------------------------------------------------
// Gợi ý khi đang gõ
// ---------------------------------------------------------------------------

export function suggest(index, query, { maxProducts = 5 } = {}) {
  const q = fold(query)
  if (!q) return { products: [], categories: [], keywords: [], correctedQuery: null }
  const { results, correctedQuery } = searchProducts(index, query)

  const parsed = parseQuery(index, query)
  const cats = categories.filter((c) => {
    const n = fold(c.name)
    return parsed.units.every((u) => u.alts.some((a) => n.includes(a)))
  })

  // Từ khóa: gợi ý nốt từ đang gõ dở bằng các từ hay gặp trong cửa hàng.
  const words = parsed.text.split(' ')
  const last = words[words.length - 1]
  const head = words.slice(0, -1).join(' ')
  const keywords = [...index.vocab]
    .filter(([w, n]) => w.length >= 3 && n >= 2 && w.length > last.length && w.startsWith(last))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => (head ? `${head} ${w}` : w))

  return {
    products: results.slice(0, maxProducts).map((r) => r.product),
    total: results.length,
    categories: cats.slice(0, 3),
    keywords,
    correctedQuery,
  }
}

export { POPULAR_KEYWORDS }
