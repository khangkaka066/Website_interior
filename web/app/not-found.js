import Link from 'next/link'

export const metadata = { title: 'Không tìm thấy trang', robots: { index: false } }

export default function NotFound() {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <h1>Không tìm thấy trang</h1>
      <p>
        <Link href="/">Về trang chủ</Link>
      </p>
    </div>
  )
}
