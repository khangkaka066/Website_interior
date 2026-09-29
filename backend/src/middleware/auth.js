import { prisma } from '../lib/prisma.js'
import { verifyToken } from '../lib/auth.js'

// Attaches req.user when a valid Bearer token is present; never rejects by
// itself, so public routes can stay mounted on the same router and just
// read req.user when it's there (e.g. to no-op differently for guests).
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next()

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (user) req.user = user
  } catch {
    // Invalid/expired token — treat as anonymous rather than erroring, the
    // routes that need auth enforce it themselves via requireRole.
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' })
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Bạn không có quyền truy cập.' })
    next()
  }
}

export function requireMainAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' })
  if (req.user.role !== 'ADMIN' || req.user.adminRole !== 'MAIN_ADMIN') {
    return res.status(403).json({ error: 'Chỉ Main Admin mới có quyền thực hiện thao tác này.' })
  }
  next()
}

// MAIN_ADMIN always passes. SUPPORT_ADMIN passes only if the feature's
// SupportPermission row is enabled. Any other role is rejected.
export function requirePermission(key) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' })
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Bạn không có quyền truy cập.' })
    if (req.user.adminRole === 'MAIN_ADMIN') return next()

    const perm = await prisma.supportPermission.findUnique({ where: { key } })
    if (perm?.enabledForSupport) return next()
    return res.status(403).json({ error: 'Tài khoản của bạn chưa được cấp quyền cho mục này.' })
  }
}
