export function generateOrderNumber() {
  const n = Math.floor(10000 + Math.random() * 90000)
  return `ORD-${n}`
}

export function generateTrackingId(carrierCode) {
  const n = Math.floor(100000000 + Math.random() * 900000000)
  return `${carrierCode}${n}`
}
