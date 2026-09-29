import { prisma } from '../lib/prisma.js'
import { publicUser } from '../lib/auth.js'

export async function listUsers(req, res) {
  const { role, search = '' } = req.query
  const where = {}
  if (role) where.role = role
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } })
  res.json({ items: users.map(publicUser) })
}

export async function updateUserRole(req, res) {
  const { role, adminRole } = req.body || {}
  if (!['CUSTOMER', 'ADMIN'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' })
  if (role === 'ADMIN' && !['MAIN_ADMIN', 'SUPPORT_ADMIN'].includes(adminRole)) {
    return res.status(400).json({ error: 'Cần chọn Main Admin hoặc Support Admin.' })
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' })

  if (target.id === req.user.id && role !== 'ADMIN') {
    return res.status(400).json({ error: 'Không thể tự hạ quyền của chính mình.' })
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role, adminRole: role === 'ADMIN' ? adminRole : null },
  })
  res.json({ user: publicUser(updated) })
}
