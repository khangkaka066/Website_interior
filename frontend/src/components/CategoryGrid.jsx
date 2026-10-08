import { categories } from '../data/shop'

export default function CategoryGrid() {
  const [tall, big, ...rest] = categories

  return (
    <section className="container category-grid">
      <a className={`cat-card cat-tall bg-${tall.bg} photo-${tall.photoStyle}`} href={`#${tall.id}`}>
        <img className="cat-photo" src={tall.image} alt={tall.name} loading="lazy" decoding="async" />
        <div className="cat-card-scrim" />
        <div className="cat-card-body">
          <h4>{tall.name}</h4>
          <span className="cat-link">XEM THÊM →</span>
        </div>
      </a>

      <a className={`cat-card cat-big bg-${big.bg} photo-${big.photoStyle}`} href={`#${big.id}`}>
        <img className="cat-photo" src={big.image} alt={big.name} loading="lazy" decoding="async" />
        <div className="cat-card-scrim" />
        <div className="cat-card-body">
          <h3>{big.name}</h3>
          <span className="cat-link">XEM THÊM →</span>
        </div>
      </a>

      <div className="cat-stack">
        {rest.map((c) => (
          <a key={c.id} className={`cat-card cat-small bg-${c.bg} photo-${c.photoStyle}`} href={`#${c.id}`}>
            <img className="cat-photo" src={c.image} alt={c.name} loading="lazy" decoding="async" />
            <div className="cat-card-scrim" />
            <div className="cat-card-body">
              <h4>{c.name}</h4>
              <span className="cat-link">XEM THÊM →</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
