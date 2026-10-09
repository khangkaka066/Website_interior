import { api } from './api'

const SESSION_KEY = 'clevinum_session_id'
const UTM_KEY = 'clevinum_utm'

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// Capture UTM params from the current URL the first time they appear, and
// keep them for the rest of the session so later actions (add to cart,
// checkout) still attribute back to the campaign that brought the visitor.
function captureUtm() {
  const params = new URLSearchParams(window.location.search)
  const source = params.get('utm_source')
  const medium = params.get('utm_medium')
  const campaign = params.get('utm_campaign')
  if (source || medium || campaign) {
    const utm = { utmSource: source || null, utmMedium: medium || null, utmCampaign: campaign || null }
    localStorage.setItem(UTM_KEY, JSON.stringify(utm))
    return utm
  }
  try {
    const raw = localStorage.getItem(UTM_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getAttribution() {
  return captureUtm()
}

export function trackEvent(type, extra = {}) {
  const utm = captureUtm()
  api
    .post('/analytics/events', {
      sessionId: getSessionId(),
      type,
      path: window.location.pathname,
      ...utm,
      ...extra,
    })
    .catch(() => {
      // Analytics must never break the shopping experience.
    })
}
