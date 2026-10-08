import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { slugify } from '../schemas/admin.js'

// --- Công khai: chỉ bài đã xuất bản -----------------------------------------------------------------
const PUBLIC_LIST = { id: true, slug: true, title: true, excerpt: true, coverUrl: true, publishedAt: true }

export async function listPublicPosts(req, res) {
  const posts = await prisma.post.findMany({
    where: { status: 'published', publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: PUBLIC_LIST,
  })
  res.json(toPlain(posts))
}

export async function getPublicPost(req, res) {
  const post = await prisma.post.findFirst({
    where: { slug: req.params.slug, status: 'published', publishedAt: { lte: new Date() } },
    select: { ...PUBLIC_LIST, content: true, updatedAt: true },
  })
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
  res.json(toPlain(post))
}

// --- Quản trị ---------------------------------------------------------------------------------------
export async function listPosts(req, res) {
  const posts = await prisma.post.findMany({
    orderBy: [{ createdAt: 'desc' }],
    select: { ...PUBLIC_LIST, status: true, createdAt: true, updatedAt: true },
  })
  res.json(toPlain(posts))
}

export async function getPost(req, res) {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
  res.json(toPlain(post))
}

// Tạo đường dẫn không trùng: tên-bài, tên-bài-2, tên-bài-3...
async function uniqueSlug(base, ignoreId) {
  const root = slugify(base) || 'bai-viet'
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`
    const found = await prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!found || found.id === ignoreId) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}

export async function createPost(req, res) {
  const { title, slug, excerpt, content, coverUrl, status } = req.body
  const post = await prisma.post.create({
    data: {
      title,
      slug: await uniqueSlug(slug || title),
      excerpt,
      content,
      coverUrl: coverUrl || null,
      status,
      publishedAt: status === 'published' ? new Date() : null,
    },
  })
  res.status(201).json(toPlain(post))
}

export async function updatePost(req, res) {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
  const { title, slug, excerpt, content, coverUrl, status } = req.body
  const data = {}
  if (title !== undefined) data.title = title
  if (slug !== undefined && slug !== post.slug) data.slug = await uniqueSlug(slug, post.id)
  if (excerpt !== undefined) data.excerpt = excerpt
  if (content !== undefined) data.content = content
  if (coverUrl !== undefined) data.coverUrl = coverUrl || null
  if (status !== undefined) {
    data.status = status
    // Ngày đăng đặt lần đầu khi xuất bản và giữ nguyên khi sửa/xuất bản lại; chuyển về nháp thì ẩn khỏi website.
    if (status === 'published' && !post.publishedAt) data.publishedAt = new Date()
  }
  const updated = await prisma.post.update({ where: { id: post.id }, data })
  res.json(toPlain(updated))
}

export async function deletePost(req, res) {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
  await prisma.post.delete({ where: { id: post.id } })
  res.json({ ok: true })
}
