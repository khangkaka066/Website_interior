import { aiInsights } from '../../data/dashboardDemo'
import { SparkleIcon, TrendUpIcon, AlertIcon } from './DashIcons'

const ICONS = {
  positive: TrendUpIcon,
  warning: AlertIcon,
  anomaly: AlertIcon,
}

export default function AiInsights() {
  return (
    <div className="ai-insights">
      <div className="ai-insights-head">
        <span className="ai-insights-icon">
          <SparkleIcon size={22} />
        </span>
        <div>
          <h3>AI Insights</h3>
          <span className="dash-tag">dữ liệu minh họa — chưa tích hợp AI thật</span>
        </div>
      </div>
      <ul className="ai-insights-list">
        {aiInsights.map((insight) => {
          const Icon = ICONS[insight.type]
          return (
            <li key={insight.id} className={`ai-insight-item ai-insight-${insight.type}`}>
              <Icon />
              <span>{insight.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
