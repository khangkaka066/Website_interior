// Hiển thị tin nhắn chat: địa chỉ http(s) thành link bấm được (mở tab mới), phần còn lại giữ nguyên là chữ thường.
// Dựng bằng phần tử React (không dùng innerHTML) nên nội dung khách gõ không chèn được mã HTML.
const URL_RE = /https?:\/\/[^\s<>"]+/gi
const TRAILING = /[.,;:!?)\]}'"]+$/ // dấu câu cuối câu không thuộc link

export default function LinkifiedText({ text }) {
  const parts = []
  let last = 0
  for (const m of String(text ?? '').matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, '')
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noopener noreferrer" className="chat-link">
        {url}
      </a>,
    )
    last = m.index + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
