import SiteShell from '@/components/site/SiteShell'
import ContactForm from '@/components/site/ContactForm'
import { loadSite, SiteError } from '@/components/site/loadSite'

export async function generateMetadata() {
  const site = await loadSite()
  return {
    title: 'Liên hệ',
    description: site?.content.contact.intro || undefined,
  }
}

function Card({ label, children }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 font-medium">{children}</div>
    </div>
  )
}

export default async function ContactPage() {
  const site = await loadSite()
  if (!site) return <SiteError />
  const { store } = site
  const c = site.content.contact
  const phoneHref = `tel:${store.hotline.replace(/[^\d+]/g, '')}`
  const links = [
    ['Shopee', c.shopeeUrl],
    ['Zalo', c.zaloUrl],
    ['Facebook', c.facebookUrl],
  ].filter(([, url]) => url)
  return (
    <SiteShell store={store}>
      <h1 className="text-3xl font-bold">Liên hệ</h1>
      {c.intro && <p className="mt-3 max-w-2xl text-lg text-muted">{c.intro}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card label="Hotline"><a href={phoneHref} className="text-accent hover:underline">{store.hotline}</a></Card>
        {store.email && <Card label="Email"><a href={`mailto:${store.email}`} className="text-accent hover:underline">{store.email}</a></Card>}
        <Card label="Địa chỉ">{store.address}</Card>
        {c.hours && <Card label="Giờ làm việc">{c.hours}</Card>}
      </div>

      {links.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {links.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              {name}
            </a>
          ))}
        </div>
      )}

      <ContactForm />

      {c.showMap && (
        <iframe
          title={`Bản đồ ${store.name}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(store.address)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mt-8 h-80 w-full rounded-xl border border-line"
        />
      )}
    </SiteShell>
  )
}
