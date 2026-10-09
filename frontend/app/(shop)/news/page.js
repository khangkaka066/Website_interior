import Link from 'next/link'
import { fetchPosts } from '@/lib/server'

export const metadata = {
  title: 'Tin tức',
  description: 'Tin tức, mẹo chọn rèm và xu hướng trang trí cửa sổ từ CLEVINUM.',
  alternates: { canonical: '/news' },
}

const fmt = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default async function NewsPage() {
  const posts = (await fetchPosts()) || []
  return (
    <main className="tw-reset mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Tin tức</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Mẹo chọn rèm, xu hướng trang trí cửa sổ và ưu đãi mới nhất từ CLEVINUM.</p>

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
    </main>
  )
}
