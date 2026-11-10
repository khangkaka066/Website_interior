import Link from 'next/link'
import { notFound } from 'next/navigation'
import PostBody from '@/components/site/PostBody'
import SaleProductsPanel from '@/components/site/SaleProductsPanel'
import { fetchPost } from '@/lib/server'
import { SITE_URL } from '@/lib/site'

const fmt = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export async function generateMetadata({ params }) {
  const { slug } = await params
  const post = await fetchPost(slug)
  if (!post) return { title: 'Không tìm thấy bài viết', robots: { index: false } }
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `/tin-tuc/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.excerpt || undefined, images: post.coverUrl ? [post.coverUrl] : undefined, publishedTime: post.publishedAt },
  }
}

export default async function PostPage({ params }) {
  const { slug } = await params
  const post = await fetchPost(slug)
  if (!post) notFound()

  const url = `${SITE_URL}/tin-tuc/${post.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || undefined,
        image: post.coverUrl ? [post.coverUrl.startsWith('http') ? post.coverUrl : SITE_URL + post.coverUrl] : undefined,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        inLanguage: 'vi-VN',
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: 'CLEVINIUM', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'CLEVINIUM', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/brand/logo.png` } },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Tin tức', item: `${SITE_URL}/tin-tuc` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  }
  return (
    <main className="tw-reset mx-auto w-full max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Link href="/tin-tuc" className="text-sm font-semibold text-accent hover:underline">← Tất cả tin tức</Link>
      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
          <time className="mt-3 block text-sm text-muted" dateTime={post.publishedAt}>{fmt(post.publishedAt)}</time>
          {post.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverUrl} alt="" className="mt-6 aspect-video w-full rounded-xl object-cover" />
          )}
          <div className="mt-8">
            <PostBody content={post.content} />
          </div>
          <div className="mt-12 rounded-xl border border-line bg-white p-6 text-center">
            <p className="font-semibold">Cần tư vấn chọn rèm?</p>
            <Link href="/lien-he" className="btn btn-accent mt-4 inline-flex">Liên hệ CLEVINIUM</Link>
          </div>
        </article>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SaleProductsPanel />
        </div>
      </div>
    </main>
  )
}
