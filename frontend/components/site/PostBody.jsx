import Link from 'next/link'

// Dựng nội dung bài viết từ văn bản thuần với vài ký hiệu markdown: dòng trống tách đoạn, "## " / "### " là tiêu đề nhỏ,
// "- " là danh sách, "1. " là danh sách số, "![alt](url)" một mình trên dòng là ảnh, bảng dùng dấu "|".
// Trong dòng: **đậm**, [chữ](url). Chỉ nhận đường dẫn nội bộ ("/...") hoặc http(s) nên không có link javascript:.
// Không bao giờ chèn HTML do admin nhập (React tự mã hóa chữ) nên không có rủi ro XSS.
const SAFE_URL = /^(\/(?!\/)|https?:\/\/)\S*$/

const isRow = (l) => l.trim().startsWith('|') && l.trim().endsWith('|')
const cells = (l) => l.trim().slice(1, -1).split('|').map((c) => c.trim())

function parse(content) {
  const blocks = []
  for (const raw of String(content || '').replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const text = raw.trim()
    if (!text) continue
    const lines = text.split('\n').map((l) => l.trim())
    const img = text.match(/^!\[([^\]]*)\]\((\S+?)\)$/)
    if (text.startsWith('### ')) {
      blocks.push({ type: 'h3', text: text.slice(4).trim() })
    } else if (text.startsWith('## ')) {
      blocks.push({ type: 'h2', text: text.slice(3).trim() })
    } else if (img && SAFE_URL.test(img[2])) {
      blocks.push({ type: 'img', alt: img[1], src: img[2] })
    } else if (lines.length >= 2 && lines.every(isRow)) {
      const rows = lines.map(cells).filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)))
      blocks.push({ type: 'table', head: rows[0], rows: rows.slice(1) })
    } else if (lines.every((l) => l.startsWith('- '))) {
      blocks.push({ type: 'ul', items: lines.map((l) => l.slice(2)) })
    } else if (lines.every((l) => /^\d+\.\s/.test(l))) {
      blocks.push({ type: 'ol', items: lines.map((l) => l.replace(/^\d+\.\s+/, '')) })
    } else {
      blocks.push({ type: 'p', text })
    }
  }
  return blocks
}

// Tách **đậm** và [chữ](url) thành phần tử React; phần còn lại giữ nguyên là chữ.
function inline(text) {
  const out = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\S+?)\)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      out.push(<strong key={m.index}>{m[1]}</strong>)
    } else if (SAFE_URL.test(m[3])) {
      const cls = 'font-medium underline underline-offset-2'
      out.push(
        m[3].startsWith('/') ? (
          <Link key={m.index} href={m[3]} className={cls}>{m[2]}</Link>
        ) : (
          <a key={m.index} href={m[3]} className={cls} target="_blank" rel="noopener noreferrer">{m[2]}</a>
        ),
      )
    } else {
      out.push(m[0])
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function PostBody({ content }) {
  return (
    <div className="space-y-5 text-[17px] leading-relaxed">
      {parse(content).map((b, i) => {
        switch (b.type) {
          case 'h2':
            return <h2 key={i} className="pt-4 text-2xl font-bold">{b.text}</h2>
          case 'h3':
            return <h3 key={i} className="pt-2 text-xl font-bold">{b.text}</h3>
          case 'img':
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={b.src} alt={b.alt} loading="lazy" className="mx-auto h-auto max-w-full rounded-lg" />
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[15px]">
                  <thead>
                    <tr>
                      {b.head.map((c, k) => (
                        <th key={k} className="border border-neutral-300 bg-neutral-100 px-3 py-2 font-semibold">{inline(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, k) => (
                      <tr key={k}>
                        {r.map((c, j) => (
                          <td key={j} className="border border-neutral-300 px-3 py-2">{inline(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.items.map((it, k) => (
                  <li key={k}>{inline(it)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 pl-6">
                {b.items.map((it, k) => (
                  <li key={k}>{inline(it)}</li>
                ))}
              </ol>
            )
          default:
            return <p key={i} className="whitespace-pre-line">{inline(b.text)}</p>
        }
      })}
    </div>
  )
}
