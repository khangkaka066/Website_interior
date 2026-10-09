'use client'

export const input =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent'
export const btnPrimary =
  'rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60'
export const btnGhost = 'rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:border-accent'

export function Notice({ kind = 'error', children }) {
  if (!children) return null
  const tone = kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
  return (
    <p className={`rounded-lg px-4 py-3 text-sm ${tone}`} role={kind === 'ok' ? 'status' : 'alert'}>
      {children}
    </p>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

export const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
export const when = (d) => new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
export const fullAddress = (a) => [a.addressLine, a.ward, a.district, a.province].filter(Boolean).join(', ')
