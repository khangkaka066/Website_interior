import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { prisma } from '../src/lib/prisma.js'

// Sao lưu toàn bộ dữ liệu: mọi bảng trong database (JSON) + cài đặt cửa hàng, nén thành một file trong backend/backups/.
// Chạy tay:  npm run backup   — hoặc đặt lịch (cron / GitHub Actions / Render cron job), ví dụ mỗi ngày 2h sáng.
// File chứa dữ liệu nhạy cảm (mật khẩu đã băm, đơn hàng, khách hàng, tài khoản ngân hàng): giữ riêng tư, copy ra
// nơi khác (ổ ngoài / cloud) theo quy tắc 3-2-1 — 3 bản, 2 loại nơi lưu, 1 bản ngoài máy chủ.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'backups')
const KEEP = Number(process.env.BACKUP_KEEP) || 14 // giữ bao nhiêu bản gần nhất

const models = Object.keys(prisma).filter((k) => !k.startsWith('$') && !k.startsWith('_') && typeof prisma[k]?.findMany === 'function')
const replacer = (_k, v) => (typeof v === 'bigint' ? v.toString() : v) // Date tự thành chuỗi ISO, Decimal có toJSON

const dump = { createdAt: new Date().toISOString(), tables: {} }
for (const m of models) dump.tables[m] = await prisma[m].findMany()
try {
  dump.settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'storage/settings.json'), 'utf8'))
} catch {
  dump.settings = null // chưa có file cài đặt
}

fs.mkdirSync(OUT, { recursive: true, mode: 0o700 })
const stamp = dump.createdAt.replace(/[:.]/g, '-')
const file = path.join(OUT, `clevinum-${stamp}.json.gz`)
fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(dump, replacer)), { mode: 0o600 })

const old = fs.readdirSync(OUT).filter((f) => /^clevinum-.*\.json\.gz$/.test(f)).sort().reverse().slice(KEEP)
for (const f of old) fs.unlinkSync(path.join(OUT, f))

const rows = Object.values(dump.tables).reduce((n, t) => n + t.length, 0)
console.log(`Đã sao lưu ${rows} dòng từ ${models.length} bảng -> ${path.relative(ROOT, file)} (giữ ${KEEP} bản gần nhất)`)
await prisma.$disconnect()
