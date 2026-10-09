// Làm sạch dữ liệu AI trả về: cắt độ dài, bỏ emoji, bỏ mục lẫn chữ nước ngoài, để giao diện luôn nhận dữ liệu gọn và an toàn.

// Mô hình miễn phí thỉnh thoảng chèn chữ Hán/Nhật/Hàn vào giữa câu tiếng Việt ("may theo尺寸"): bỏ hẳn mục đó thay vì hiện câu hỏng.
const FOREIGN_SCRIPT = /[぀-ヿ㐀-鿿가-힯]/
const tidy = (s, n) =>
  String(s || '')
    .replace(/[←-⯿️‍\u{1F000}-\u{1FFFF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)
export const plain = (s, n) => (FOREIGN_SCRIPT.test(String(s || '')) ? '' : tidy(s, n))

// Bỏ dấu + chữ thường: so sánh "Rèm Dán Tường" với "rem dan tuong" như nhau.
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim()

export const list = (v, max, len = 200) =>
  (Array.isArray(v) ? v : []).map((x) => plain(typeof x === 'string' ? x : x?.keyword ?? x?.question, len)).filter(Boolean).slice(0, max)

export const makeSlug = (s) => fold(plain(s, 100)).replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')

// Chuẩn hóa một đối tượng kết quả (đủ hoặc một phần): trường thiếu thành rỗng.
export function normalizeResult(data = {}) {
  return {
    primary: (Array.isArray(data.primary) ? data.primary : [])
      .map((k) => (typeof k === 'string' ? { keyword: k } : k))
      .map((k) => ({ keyword: plain(k?.keyword, 120), intent: plain(k?.intent, 30), note: plain(k?.note, 200) }))
      .filter((k) => k.keyword)
      .slice(0, 10),
    longTail: list(data.longTail, 20, 150),
    clusters: (Array.isArray(data.clusters) ? data.clusters : [])
      .map((c) => ({ pillar: plain(c?.pillar, 120), keywords: list(c?.keywords, 10, 120) }))
      .filter((c) => c.pillar && c.keywords.length)
      .slice(0, 4),
    pageIdeas: (Array.isArray(data.pageIdeas) ? data.pageIdeas : [])
      .map((p) => ({ keyword: plain(p?.keyword, 120), slug: makeSlug(p?.slug), why: plain(p?.why, 200) }))
      .filter((p) => p.keyword)
      .slice(0, 8),
    questions: list(data.questions, 12, 200),
    title: plain(data.title, 200), // giữ độ dài thật để bước kiểm tra báo đúng; cắt về giới hạn ở bước hoàn thiện
    metaDescription: plain(data.metaDescription, 400),
    blogIdeas: (Array.isArray(data.blogIdeas) ? data.blogIdeas : [])
      .map((b) => ({ title: plain(b?.title, 160), keyword: plain(b?.keyword, 100), type: plain(b?.type, 20) }))
      .filter((b) => b.title)
      .slice(0, 6),
  }
}
