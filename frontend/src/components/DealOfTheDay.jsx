import { useEffect, useMemo, useState } from 'react'
import { products } from '../data/shop'

function getTargetDate() {
  const target = new Date()
  target.setHours(target.getHours() + 47, target.getMinutes() + 12, target.getSeconds() + 5)
  return target
}

function useCountdown(target) {
  const [remaining, setRemaining] = useState(target.getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, target.getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  const day = Math.floor(remaining / (1000 * 60 * 60 * 24))
  const hrs = Math.floor((remaining / (1000 * 60 * 60)) % 24)
  const min = Math.floor((remaining / (1000 * 60)) % 60)
  const sec = Math.floor((remaining / 1000) % 60)
  return { day, hrs, min, sec }
}

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function DealOfTheDay() {
  const target = useMemo(getTargetDate, [])
  const { day, hrs, min, sec } = useCountdown(target)
  const deal = products.reduce((a, b) => (b.discount > a.discount ? b : a), products[0])

  return (
    <section className="deal-banner" id="deal">
      <div className="container deal-inner">
        <div className="deal-visual">
          <img src={deal.image} alt={deal.name} />
        </div>
        <div className="deal-content">
          <span className="eyebrow">ƯU ĐÃI TRONG NGÀY</span>
          <h2>Ưu đãi tốt đến mức khó tin.</h2>
          <p className="deal-product-name">
            {deal.name} — chỉ còn {formatPrice(deal.price)}{' '}
            <span className="badge badge-discount">-{deal.discount}%</span>
          </p>
          <div className="countdown">
            <Tile value={day} label="Ngày" />
            <Tile value={hrs} label="Giờ" />
            <Tile value={min} label="Phút" />
            <Tile value={sec} label="Giây" />
          </div>
          <a className="btn btn-accent" href="#products">
            MUA NGAY
          </a>
        </div>
      </div>
    </section>
  )
}

function Tile({ value, label }) {
  return (
    <div className="countdown-tile">
      <strong>{String(value).padStart(2, '0')}</strong>
      <span>{label}</span>
    </div>
  )
}
