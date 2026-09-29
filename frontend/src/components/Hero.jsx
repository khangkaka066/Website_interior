export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-glow glow-1" />
      <div className="hero-glow glow-2" />

      <div className="container hero-inner">
        <div className="hero-text">
          <span className="hero-eyebrow">CHẤT LIỆU CAO CẤP · CURTAIN PREMIUM</span>
          <h1>
            Ánh sáng đẹp,
            <br />
            <span className="hero-accent">rèm chuẩn form.</span>
          </h1>
          <p>
            Vải rèm dày dặn, cản sáng &amp; chống tia UV vượt trội — buông rủ mềm mại,
            lên màu sang trọng dưới mọi ánh đèn.
          </p>
          <div className="hero-cta">
            <a className="btn btn-hero" href="#products">
              MUA NGAY
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-glow" />
          <div className="hero-3d-stack">
            <img className="stack-card card-back" src="/images/curtains/blue.png" alt="Rèm xanh dương" />
            <img className="stack-card card-mid" src="/images/curtains/brown.png" alt="Rèm nâu" />
            <img className="stack-card card-front" src="/images/curtains/gold.png" alt="Rèm vàng gold" />
            <img className="hero-badge-logo" src="/images/brand/logo.png" alt="Curtain Premium Quality" />
          </div>
        </div>
      </div>
    </section>
  )
}
