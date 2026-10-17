'use client'

import { shopInfo } from '../data/shop'
import CountUp from './CountUp'

export default function Perks() {
  return (
    <section className="container perks">
      {shopInfo.stats.map((s) => (
        <div className="perk" key={s.label}>
          <span className="perk-icon"><CountUp value={s.value} /></span>
          <div>
            <strong>{s.label}</strong>
            <span className="text-muted">{s.sub}</span>
          </div>
        </div>
      ))}
    </section>
  )
}
