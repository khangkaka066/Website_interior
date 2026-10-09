import { prisma } from './prisma.js'

// Mỗi request API đều phải tra tài khoản (và quyền của support admin) trong database; database ở xa nên mỗi lần tra tốn ~100ms.
// Giữ kết quả trong bộ nhớ vài giây. Mọi chỗ sửa tài khoản / quyền gọi invalidate* nên thay đổi có hiệu lực ngay trên server này;
// nhiều server cùng chạy thì chậm nhất sau TTL này.
const TTL_MS = 15_000
const MAX_ENTRIES = 500

const users = new Map() // id -> { at, user }
const perms = new Map() // key -> { at, enabled }

const fresh = (e) => e && Date.now() - e.at < TTL_MS

export async function getUserCached(id) {
  const hit = users.get(id)
  if (fresh(hit)) return hit.user
  const user = await prisma.user.findUnique({ where: { id } })
  if (users.size >= MAX_ENTRIES) users.clear()
  users.set(id, { at: Date.now(), user })
  return user
}

export async function isPermissionEnabledCached(key) {
  const hit = perms.get(key)
  if (fresh(hit)) return hit.enabled
  const perm = await prisma.supportPermission.findUnique({ where: { key } })
  const enabled = !!perm?.enabledForSupport
  perms.set(key, { at: Date.now(), enabled })
  return enabled
}

export const invalidateUser = (id) => (id ? users.delete(id) : users.clear())
export const invalidatePermissions = () => perms.clear()
