// Chuỗi query khoảng thời gian cho /analytics/*. "Tùy chỉnh" gửi dateFrom/dateTo (đầu ngày → cuối ngày, giờ máy khách).
const RANGE_API = { today: 'today', '7d': '7d', '30d': '30d', month: 'month' }

export function rangeQuery(range, dates) {
  if (range === 'custom' && dates?.from && dates?.to) {
    const from = new Date(`${dates.from}T00:00:00`)
    const to = new Date(`${dates.to}T23:59:59.999`)
    return `range=custom&dateFrom=${encodeURIComponent(from.toISOString())}&dateTo=${encodeURIComponent(to.toISOString())}`
  }
  return `range=${RANGE_API[range] || '30d'}`
}
