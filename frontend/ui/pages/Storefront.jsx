'use client'

import Hero from '../components/Hero'
import Showcase from '../components/Showcase'
import CategoryGrid from '../components/CategoryGrid'
import ProductSection from '../components/ProductSection'
import DealOfTheDay from '../components/DealOfTheDay'
import ProductColumns from '../components/ProductColumns'
import CollectionScroll from '../components/CollectionScroll'
import Perks from '../components/Perks'
import InstagramGrid from '../components/InstagramGrid'

export default function Storefront() {
  return (
    <>
      <main>
        <Hero />
        <CategoryGrid />
        <Showcase />
        <ProductSection />
        <DealOfTheDay />
        <ProductColumns />
        <CollectionScroll />
        <Perks />
        <InstagramGrid />
      </main>
    </>
  )
}
