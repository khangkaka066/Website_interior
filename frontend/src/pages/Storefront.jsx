import Header from '../components/Header'
import Hero from '../components/Hero'
import CategoryGrid from '../components/CategoryGrid'
import ProductSection from '../components/ProductSection'
import DealOfTheDay from '../components/DealOfTheDay'
import ProductColumns from '../components/ProductColumns'
import Testimonials from '../components/Testimonials'
import Perks from '../components/Perks'
import InstagramGrid from '../components/InstagramGrid'
import Footer from '../components/Footer'

export default function Storefront() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <CategoryGrid />
        <ProductSection />
        <DealOfTheDay />
        <ProductColumns />
        <Testimonials />
        <Perks />
        <InstagramGrid />
      </main>
      <Footer />
    </>
  )
}
