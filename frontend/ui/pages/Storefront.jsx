'use client'

import Hero from '../components/Hero'
import CategoryGrid from '../components/CategoryGrid'
import ProductSection from '../components/ProductSection'
import DealOfTheDay from '../components/DealOfTheDay'
import ProductColumns from '../components/ProductColumns'
import Perks from '../components/Perks'
import InstagramGrid from '../components/InstagramGrid'

export default function Storefront() {
  return (
    <>
      <main>
        <Hero />
        <CategoryGrid />
        <ProductSection />
        <DealOfTheDay />
        <ProductColumns />
        <Perks />
        <InstagramGrid />
      </main>
    </>
  )
}
