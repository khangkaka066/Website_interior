import Link from 'next/link'
import { redirect } from 'next/navigation'
import { fetchPosts } from '@/lib/server'

const PER_PAGE = 9 // mỗi trang 9 bài (lưới 3 cột x 3 hàng); bài thứ 10 trở đi sang trang 2

// ?page=2 -> 2. Giá trị lạ (chữ, số âm, số thập phân) coi như trang 1.
const parsePage = (raw) => {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}
const pageHref = (n) => (n <= 1 ? '/news' : `/news?page=${n}`)

export async function generateMetadata({ searchParams }) {
  const page = parsePage((await searchParams).page)
  return {
    title: page > 1 ? `Tin tức - Trang ${page}` : 'Tin tức',
    description: 'Tin tức, mẹo chọn rèm và xu hướng trang trí cửa sổ từ CLEVINIUM.',
    // Mỗi trang tự là bản chuẩn của chính nó; trang 1 luôn là /news (không có ?page=1).
    alternates: { canonical: pageHref(page) },
  }
}

const fmt = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

function Pagination({ page, totalPages }) {
  if (totalPages <= 1) return null
  const item = 'inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-line px-3 text-sm font-semibold'
  return (
    <nav aria-label="Phân trang tin tức" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={pageHref(page - 1)} rel="prev" className={`${item} bg-white hover:border-accent hover:text-accent`}>
          ← Trước
        </Link>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
        n === page ? (
          <span key={n} aria-current="page" className={`${item} border-accent bg-accent text-white`}>{n}</span>
        ) : (
          <Link key={n} href={pageHref(n)} aria-label={`Trang ${n}`} className={`${item} bg-white hover:border-accent hover:text-accent`}>{n}</Link>
        ),
      )}
      {page < totalPages && (
        <Link href={pageHref(page + 1)} rel="next" className={`${item} bg-white hover:border-accent hover:text-accent`}>
          Sau →
        </Link>
      )}
    </nav>
  )
}

export default async function NewsPage({ searchParams }) {
  const all = (await fetchPosts()) || []
  const page = parsePage((await searchParams).page)
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE))
  if (page > totalPages) redirect(pageHref(totalPages)) // ví dụ /news?page=9 khi chỉ có 2 trang: về trang cuối thay vì hiện trang trống
  const posts = all.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  return (
    <main className="tw-reset mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Tin tức</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Mẹo chọn rèm, xu hướng trang trí cửa sổ và ưu đãi mới nhất từ CLEVINIUM.</p>

      {posts.length === 0 ? (
        <div className="mt-10 rounded-xl border border-line bg-white p-8 text-center">
          <p className="text-muted">Chuyên mục đang được chuẩn bị, chưa có bài viết nào.</p>
          <Link href="/products" className="btn btn-accent mt-5 inline-flex">
            Xem sản phẩm
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/news/${p.slug}`} className="group block h-full overflow-hidden rounded-xl border border-line bg-white transition hover:shadow-lg">
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                ) : (
                  <div className="aspect-[16/10] w-full bg-cream" />
                )}
                <div className="p-5">
                  <time className="text-xs font-semibold uppercase tracking-wide text-muted" dateTime={p.publishedAt}>
                    {fmt(p.publishedAt)}
                  </time>
                  <h2 className="mt-2 text-lg font-bold leading-snug group-hover:text-accent">{p.title}</h2>
                  {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} />
    </main>
  )
}
