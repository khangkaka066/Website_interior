import { instagramImages } from '../data/shop'

export default function InstagramGrid() {
  return (
    <section className="container instagram-section">
      <h2 className="section-title">#Clevinum</h2>
      <div className="instagram-grid">
        {instagramImages.map((src, i) => (
          <div className="instagram-tile" key={i}>
            <img src={src} alt="Clevinum curtain" />
          </div>
        ))}
      </div>
    </section>
  )
}
