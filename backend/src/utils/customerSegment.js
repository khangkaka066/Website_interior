// Segments are derived on read from order stats, never stored — so they can
// never go stale relative to the orders that define them.
const VIP_THRESHOLD = 5000000
const HIGH_VALUE_THRESHOLD = 2000000
const NEW_WINDOW_DAYS = 30
const AT_RISK_WINDOW_DAYS = 90

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

export function classifySegment({ orderCount, totalSpent, lastOrderAt, createdAt }, now = new Date()) {
  if (orderCount === 0) {
    return daysBetween(now, new Date(createdAt)) <= NEW_WINDOW_DAYS ? 'NEW' : 'INACTIVE'
  }
  if (lastOrderAt && daysBetween(now, new Date(lastOrderAt)) > AT_RISK_WINDOW_DAYS) {
    return 'AT_RISK'
  }
  if (totalSpent >= VIP_THRESHOLD) {
    return 'VIP'
  }
  if (totalSpent >= HIGH_VALUE_THRESHOLD) {
    return 'HIGH_VALUE'
  }
  if (orderCount >= 2) {
    return 'RETURNING'
  }
  return 'NEW'
}

export const SEGMENTS = ['NEW', 'RETURNING', 'VIP', 'HIGH_VALUE', 'AT_RISK', 'INACTIVE']
