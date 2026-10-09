import Storefront from '@/ui/pages/Storefront'

export const metadata = { alternates: { canonical: '/' } }

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CLEVINUM',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/images/brand/logo.png`,
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Storefront />
    </>
  )
}
