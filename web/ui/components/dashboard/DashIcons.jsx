'use client'

function Svg({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  )
}

export function RevenueIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.5-2.2s2.5.8 2.5 2c0 1.6-2 1.8-2.5 2.2c-1 .6-2.5 1-2.5 2.5s1.2 2.5 2.5 2.5s2.5-.8 2.5-2.2" />
    </Svg>
  )
}

export function OrdersIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16l-1.5 11.2a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8L4 7Z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </Svg>
  )
}

export function AovIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 12 12 3l9 9-9 9-9-9Z" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  )
}

export function CustomersIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M16 14.7c2.4.4 4 2.1 4.6 5.3" />
    </Svg>
  )
}

export function ConversionIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 17 10 7l4 6 6-9" />
      <path d="M14 4h6v6" />
    </Svg>
  )
}

export function TrendUpIcon(props) {
  return (
    <Svg {...props} size={14}>
      <path d="M4 16 10 8l4 4 6-8" />
      <path d="M14 4h6v6" />
    </Svg>
  )
}

export function TrendDownIcon(props) {
  return (
    <Svg {...props} size={14}>
      <path d="M4 8 10 16l4-4 6 8" />
      <path d="M14 20h6v-6" />
    </Svg>
  )
}

export function AlertIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </Svg>
  )
}

export function SparkleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      <circle cx="12" cy="12" r="2.4" />
    </Svg>
  )
}

export function TruckIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7.5" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </Svg>
  )
}
