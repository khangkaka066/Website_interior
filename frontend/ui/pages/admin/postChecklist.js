// Checklist SEO cho một bài viết, tính ngay trên trình duyệt từ các trường của bài (không gọi API).
// Mỗi mục trả về { id, label, status: 'pass' | 'warn' | 'fail', detail }. Ngưỡng là quy ước biên tập của shop,
// không phải quy định của Google; mục “warn” là gợi ý, không chặn việc duyệt.
const words = (t) => (t.match(/[^\W\d_]+/gu) || []).length

export function buildChecklist(post) {
  const title = (post.title || '').trim()
  const excerpt = (post.excerpt || '').trim()
  const content = post.content || ''
  const slug = post.slug || ''
  const h2 = (content.match(/^## .+$/gm) || []).length
  const internal = (content.match(/\]\(\/[^)\s]*\)/g) || []).length
  const external = (content.match(/\]\(https?:\/\/[^)\s]+\)/g) || []).length
  const images = [...content.matchAll(/!\[([^\]]*)\]\([^)\s]+\)/g)]
  const noAlt = images.filter((m) => !m[1].trim()).length
  const firstPara = content.split(/\n{2,}/).find((p) => p.trim() && !p.startsWith('#')) || ''
  const total = words(content)

  const range = (n, okLo, okHi) => (n >= okLo && n <= okHi ? 'pass' : n > 0 ? 'warn' : 'fail')
  const items = [
    { id: 'title', label: 'Tiêu đề 30–65 ký tự', status: range(title.length, 30, 65), detail: `${title.length} ký tự` },
    { id: 'excerpt', label: 'Mô tả ngắn 70–160 ký tự (dùng làm meta description)', status: range(excerpt.length, 70, 160), detail: `${excerpt.length} ký tự` },
    { id: 'cover', label: 'Có ảnh bìa (dùng khi chia sẻ)', status: post.coverUrl ? 'pass' : 'fail', detail: post.coverUrl ? 'Đã có' : 'Chưa có' },
    { id: 'slug', label: 'Đường dẫn ngắn (≤ 60 ký tự)', status: slug && slug.length <= 60 ? 'pass' : slug ? 'warn' : 'fail', detail: slug ? `${slug.length} ký tự` : 'Chưa có' },
    { id: 'length', label: 'Độ dài từ 800 từ', status: total >= 800 ? 'pass' : total >= 500 ? 'warn' : 'fail', detail: `${total} từ` },
    { id: 'h2', label: 'Có ít nhất 3 tiêu đề nhỏ (##)', status: h2 >= 3 ? 'pass' : h2 > 0 ? 'warn' : 'fail', detail: `${h2} tiêu đề` },
    { id: 'lead', label: 'Đoạn mở đầu trả lời ngay, tối đa 60 từ', status: words(firstPara) > 0 && words(firstPara) <= 60 ? 'pass' : 'warn', detail: `${words(firstPara)} từ` },
    { id: 'internal', label: 'Có ít nhất 3 link nội bộ', status: internal >= 3 ? 'pass' : internal > 0 ? 'warn' : 'fail', detail: `${internal} link` },
    { id: 'external', label: 'Có link dẫn nguồn ngoài', status: external > 0 ? 'pass' : 'warn', detail: external ? `${external} link` : 'Chưa có nguồn ngoài (tăng độ tin cậy)' },
    { id: 'alt', label: 'Mọi ảnh trong bài có mô tả (alt)', status: images.length === 0 ? 'warn' : noAlt === 0 ? 'pass' : 'fail', detail: images.length ? `${images.length - noAlt}/${images.length} ảnh có alt` : 'Bài chưa có ảnh' },
    { id: 'faq', label: 'Có mục câu hỏi thường gặp hoặc tóm tắt', status: /^## .*(câu hỏi|tóm tắt|kết luận)/im.test(content) ? 'pass' : 'warn', detail: '' },
  ]
  const counts = items.reduce((a, i) => ({ ...a, [i.status]: (a[i.status] || 0) + 1 }), {})
  return { items, passed: counts.pass || 0, failed: counts.fail || 0, total: items.length }
}
