import Header from '../components/Header'
import Hero from '../components/Hero'
import CategoryGrid from '../components/CategoryGrid'
import ProductSection from '../components/ProductSection'
import DealOfTheDay from '../components/DealOfTheDay'
import ProductColumns from '../components/ProductColumns'
import Perks from '../components/Perks'
import InstagramGrid from '../components/InstagramGrid'
import Footer from '../components/Footer'
import { useSeo } from '../useSeo'

export default function Storefront() {
  useSeo({
    description: 'CLEVINUM — rèm cửa chất lượng cao, giá xưởng: rèm ore, rèm dán tường, rèm voan, thanh treo và phụ kiện. Giao hàng toàn quốc.',
    image: `${window.location.origin}/images/curtains/room-blue.webp`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'CLEVINUM',
      url: window.location.origin,
      logo: `${window.location.origin}/images/brand/logo.png`,
    },
  })
  return (
    <>
      <Header />
      <main>
        <Hero />
        <CategoryGrid />
        <ProductSection />
        <DealOfTheDay />
        <ProductColumns />
        <Perks />
        <InstagramGrid />
      </main>
      <Footer />
    </>
  )
}
