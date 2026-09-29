import { conversionFunnel } from '../../data/dashboardDemo'

export default function ConversionFunnel() {
  const first = conversionFunnel[0].value

  return (
    <div className="dash-card dash-card-wide">
      <div className="dash-card-head">
        <h3>Phễu chuyển đổi</h3>
        <span className="dash-tag">dữ liệu minh họa</span>
      </div>
      <div className="funnel">
        {conversionFunnel.map((step, i) => {
          const widthPct = Math.max(18, (step.value / first) * 100)
          const rate = i === 0 ? 100 : Math.round((step.value / first) * 100)
          return (
            <div className="funnel-row" key={step.id}>
              <div className="funnel-bar-track">
                <div className="funnel-bar" style={{ width: `${widthPct}%` }}>
                  <span className="funnel-value">{step.value.toLocaleString('vi-VN')}</span>
                </div>
              </div>
              <div className="funnel-meta">
                <span className="funnel-label">{step.label}</span>
                <span className="funnel-rate">{rate}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
