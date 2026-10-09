import Link from 'next/link'
import { notFound } from 'next/navigation'
import PostBody from '@/components/site/PostBody'
import { fetchPost } from '@/lib/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const fmt = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export async function generateMetadata({ params }) {
  const { slug } = await params
  const post = await fetchPost(slug)
  if (!post) return { title: 'Không tìm thấy bài viết', robots: { index: false } }
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `/news/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.excerpt || undefined, images: post.coverUrl ? [post.coverUrl] : undefined, publishedTime: post.publishedAt },
  }
}

export default async function PostPage({ params }) {
  const { slug } = await params
  const post = await fetchPost(slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverUrl ? [post.coverUrl] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${SITE_URL}/news/${post.slug}`,
    publisher: { '@type': 'Organization', name: 'CLEVINUM' },
  }
  return (
    <main className="tw-reset mx-auto w-full max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Link href="/news" className="text-sm font-semibold text-accent hover:underline">← Tất cả tin tức</Link>
      <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
      <time className="mt-3 block text-sm text-muted" dateTime={post.publishedAt}>{fmt(post.publishedAt)}</time>
      {post.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverUrl} alt="" className="mt-6 w-full rounded-xl object-cover" />
      )}
      <div className="mt-8">
        <PostBody content={post.content} />
      </div>
      <div className="mt-12 rounded-xl border border-line bg-white p-6 text-center">
        <p className="font-semibold">Cần tư vấn chọn rèm?</p>
        <Link href="/contact" className="btn btn-accent mt-4 inline-flex">Liên hệ CLEVINUM</Link>
      </div>
    </main>
  )
}
