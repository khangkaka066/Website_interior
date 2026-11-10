import SiteShell from '@/components/site/SiteShell'
import { loadSite, SiteError } from '@/components/site/loadSite'

export async function generateMetadata() {
  const site = await loadSite()
  return {
    title: 'Câu hỏi thường gặp',
    description: 'Giải đáp các câu hỏi thường gặp về đặt hàng, giao hàng và đổi trả.',
  }
}

export default async function FaqPage() {
  const site = await loadSite()
  if (!site) return <SiteError />
  const { faq } = site.content
  // dữ liệu có cấu trúc để Google hiện câu hỏi/đáp trong kết quả tìm kiếm
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <SiteShell store={site.store}>
      <h1 className="text-3xl font-bold">Câu hỏi thường gặp</h1>
      {faq.length === 0 ? (
        <p className="mt-6 text-muted">Chưa có câu hỏi nào.</p>
      ) : (
        <div className="mt-8 max-w-3xl space-y-3">
          {faq.map((f, i) => (
            <details key={i} className="group rounded-xl border border-line bg-white p-5">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-accent transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      )}
      <p className="mt-10 text-sm text-muted">
        Chưa tìm thấy câu trả lời? <a href="/contact" className="font-semibold text-accent underline">Liên hệ chúng tôi</a>.
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </SiteShell>
  )
}
