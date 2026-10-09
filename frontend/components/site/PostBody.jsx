// Dựng nội dung bài viết từ văn bản thuần: dòng trống tách đoạn, dòng bắt đầu bằng "## " là tiêu đề nhỏ, dòng bắt đầu bằng "- " là danh sách.
// Không bao giờ chèn HTML do admin nhập (React tự mã hóa chữ) nên không có rủi ro XSS.
function parse(content) {
  const blocks = []
  for (const raw of String(content || '').replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const text = raw.trim()
    if (!text) continue
    if (text.startsWith('## ')) {
      blocks.push({ type: 'h2', text: text.slice(3).trim() })
    } else if (text.split('\n').every((l) => l.trim().startsWith('- '))) {
      blocks.push({ type: 'ul', items: text.split('\n').map((l) => l.trim().slice(2)) })
    } else {
      blocks.push({ type: 'p', text })
    }
  }
  return blocks
}

export default function PostBody({ content }) {
  return (
    <div className="space-y-5 text-[17px] leading-relaxed">
      {parse(content).map((b, i) =>
        b.type === 'h2' ? (
          <h2 key={i} className="pt-4 text-2xl font-bold">{b.text}</h2>
        ) : b.type === 'ul' ? (
          <ul key={i} className="list-disc space-y-1 pl-6">
            {b.items.map((it, k) => (
              <li key={k}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">{b.text}</p>
        ),
      )}
    </div>
  )
}
