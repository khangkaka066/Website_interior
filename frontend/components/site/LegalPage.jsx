import SiteShell from '@/components/site/SiteShell'

export const CONTACT_EMAIL = 'clevi.interior@gmail.com'
export const LEGAL_UPDATED = '12/10/2026'

// Trang pháp lý (chính sách bảo mật, điều khoản): tiêu đề + các mục có đánh số, nội dung tĩnh.
export default function LegalPage({ title, intro, sections }) {
  return (
    <SiteShell>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">Cập nhật lần cuối: {LEGAL_UPDATED}</p>
      <p className="mt-6 max-w-3xl leading-relaxed">{intro}</p>
      <div className="mt-8 max-w-3xl space-y-8">
        {sections.map((s, i) => (
          <section key={s.title}>
            <h2 className="text-xl font-semibold">
              {i + 1}. {s.title}
            </h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="mt-3 leading-relaxed">{p}</p>
            ))}
            {s.items && (
              <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-relaxed">
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Cần hỏi thêm? Email <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent underline">{CONTACT_EMAIL}</a> hoặc xem trang{' '}
        <a href="/contact" className="font-semibold text-accent underline">Liên hệ</a>.
      </p>
    </SiteShell>
  )
}
