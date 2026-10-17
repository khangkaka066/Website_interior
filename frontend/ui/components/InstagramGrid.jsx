'use client'

import { instagramImages } from '../data/shop'
import Words from './Words'

export default function InstagramGrid() {
  return (
    <section className="container instagram-section">
      <h2 className="section-title"><Words text="#Clevinum" /></h2>
      <div className="instagram-grid">
        {instagramImages.map((src, i) => (
          <div className="instagram-tile" key={i}>
            <img src={src} alt="Clevinum curtain" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
    </section>
  )
}
