import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const TOKEN_TTL = '7d'

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, adminRole: user.adminRole || null },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  )
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    adminRole: user.adminRole || null,
    customerId: user.customerId || null,
    createdAt: user.createdAt,
  }
}
