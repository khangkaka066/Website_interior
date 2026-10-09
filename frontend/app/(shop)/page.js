import Storefront from '@/ui/pages/Storefront'
import { loadSite } from '@/components/site/loadSite'

export const metadata = { alternates: { canonical: '/' } }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Địa chỉ, điện thoại, email lấy từ Dashboard > Cài đặt (admin sửa thì Google thấy theo, cập nhật trong vòng 1 phút).
export default async function HomePage() {
  const site = await loadSite()
  const store = site?.store
  const sameAs = [site?.content?.contact?.shopeeUrl, site?.content?.contact?.facebookUrl, site?.content?.contact?.zaloUrl].filter(Boolean)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Store',
      '@id': `${SITE_URL}/#organization`,
      name: store?.name || 'CLEVINUM',
      url: SITE_URL,
      logo: `${SITE_URL}/images/brand/logo.png`,
      image: `${SITE_URL}/images/curtains/room-blue.webp`,
      description: store?.tagline || 'Rèm cửa chất lượng cao, giá xưởng, giao hàng toàn quốc.',
      ...(store?.hotline && { telephone: store.hotline }),
      ...(store?.email && { email: store.email }),
      ...(store?.address && { address: { '@type': 'PostalAddress', streetAddress: store.address, addressCountry: 'VN' } }),
      ...(site?.content?.contact?.hours && { openingHours: site.content.contact.hours }),
      priceRange: '₫₫',
      areaServed: 'VN',
      ...(sameAs.length && { sameAs }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: store?.name || 'CLEVINUM',
      inLanguage: 'vi-VN',
      publisher: { '@id': `${SITE_URL}/#organization` },
      // Ô tìm kiếm ngay trên kết quả Google (sitelinks search box).
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/products?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    },
  ]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Storefront />
    </>
  )
}
