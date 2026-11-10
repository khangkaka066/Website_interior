import SiteShell from '@/components/site/SiteShell'
import Link from 'next/link'
import { BUSINESS_AREAS } from '@/ui/data/menu'
import { loadSite, SiteError } from '@/components/site/loadSite'

export async function generateMetadata() {
  const site = await loadSite()
  if (!site) return { title: 'Về chúng tôi' }
  const { about } = site.content
  return { title: about.heading, description: about.intro || undefined }
}

export default async function AboutPage() {
  const site = await loadSite()
  if (!site) return <SiteError />
  const { about } = site.content
  const paragraphs = (about.story || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <SiteShell store={site.store}>
      <h1 className="text-3xl font-bold">{about.heading}</h1>
      {about.intro && <p className="mt-3 max-w-2xl text-lg text-muted">{about.intro}</p>}

      {paragraphs.length > 0 && (
        <div className="mt-8 max-w-2xl space-y-4 leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
      )}

      {about.highlights.length > 0 && (
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {about.highlights.map((h, i) => (
            <li key={i} className="rounded-xl border border-line bg-white p-5">
              <h2 className="font-semibold text-accent">{h.title}</h2>
              <p className="mt-2 text-sm text-muted">{h.text}</p>
            </li>
          ))}
        </ul>
      )}

      <section id="linh-vuc" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-bold">Lĩnh vực hoạt động</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {BUSINESS_AREAS.map((a, i) => (
            <li key={a} className="flex gap-3 rounded-xl border border-line bg-white p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
              <span className="font-medium leading-snug">{a}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-muted">
          Cần tư vấn hoặc báo giá? <Link href="/contact" className="font-semibold text-accent hover:underline">Gửi yêu cầu cho chúng tôi</Link>.
        </p>
      </section>
    </SiteShell>
  )
}
