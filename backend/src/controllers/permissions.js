import { prisma } from '../lib/prisma.js'
import { PERMISSION_DEFS } from '../constants/permissions.js'
import { invalidatePermissions } from '../lib/authCache.js'

export async function listPermissions(req, res) {
  const rows = await prisma.supportPermission.findMany()
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))

  // Always return every defined permission, even ones not yet seeded in the DB.
  const items = PERMISSION_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    enabledForSupport: byKey[def.key]?.enabledForSupport ?? def.defaultEnabled,
  }))
  res.json({ items })
}

export async function updatePermission(req, res) {
  const { key } = req.params
  const { enabledForSupport } = req.body || {}
  const def = PERMISSION_DEFS.find((p) => p.key === key)
  if (!def) return res.status(404).json({ error: 'Không tìm thấy quyền này.' })

  const updated = await prisma.supportPermission.upsert({
    where: { key },
    update: { enabledForSupport: !!enabledForSupport },
    create: { key, label: def.label, enabledForSupport: !!enabledForSupport },
  })
  invalidatePermissions()
  res.json({ key: updated.key, label: updated.label, enabledForSupport: updated.enabledForSupport })
}
