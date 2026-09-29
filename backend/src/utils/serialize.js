// Prisma returns Decimal instances and BigInt-free numbers; Express's default
// JSON serializer doesn't know how to stringify a Decimal, so convert every
// Decimal field to a plain number before sending a response.
export function toPlain(value) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(toPlain)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') return value.toNumber()
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = toPlain(val)
    }
    return out
  }
  return value
}
