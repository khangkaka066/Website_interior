import 'dotenv/config'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { prisma } from '../src/lib/prisma.js'
import { applyProductChanges } from '../src/lib/productStore.js'

// Khôi phục BẢNG SẢN PHẨM từ một bản sao lưu (xem scripts/backup.js).
//   node scripts/restore-products.js backups/clevinum-....json.gz            -> chỉ xem sẽ đổi gì (không ghi)
//   node scripts/restore-products.js backups/clevinum-....json.gz --apply    -> ghi vào database
// Chỉ thêm/ghi đè các sản phẩm CÓ TRONG bản sao lưu và khác bản hiện tại; sản phẩm chỉ có ở hiện tại (mới thêm sau đó) được giữ nguyên.
// Nên chạy `npm run backup` ngay trước khi --apply để có đường lui.
const [file, ...flags] = process.argv.slice(2)
if (!file) {
  console.error('Cách dùng: node scripts/restore-products.js <file .json.gz> [--apply]')
  process.exit(1)
}
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)))
const saved = (dump.tables.product || []).map((r) => r.data)
const current = new Map((await prisma.product.findMany()).map((r) => [r.id, r.data]))

// Sản phẩm bị xóa rồi nhập lại có mã (id) mới nhưng cùng Mã Shopee: khôi phục bản cũ sẽ trùng Mã Shopee, nên bỏ qua và giữ bản hiện tại.
const shopeeOwner = new Map([...current.values()].filter((p) => p.shopeeId).map((p) => [String(p.shopeeId), p.id]))
const clash = (p) => p.shopeeId && shopeeOwner.has(String(p.shopeeId)) && shopeeOwner.get(String(p.shopeeId)) !== p.id
const skipped = saved.filter((p) => !current.has(p.id) && clash(p))
const differing = saved.filter((p) => !clash(p) && (!current.has(p.id) || JSON.stringify(current.get(p.id)) !== JSON.stringify(p)))
const missing = differing.filter((p) => !current.has(p.id))
console.log(`Bản sao lưu ${dump.createdAt}: ${saved.length} sản phẩm | sẽ khôi phục: ${differing.length} (trong đó ${missing.length} đang bị thiếu)`)
if (skipped.length) console.log(`Bỏ qua ${skipped.length} sản phẩm đã được nhập lại với mã mới: ${skipped.map((p) => p.name.slice(0, 40)).join('; ')}`)
const fields = new Map()
for (const p of differing) {
  const cur = current.get(p.id)
  if (!cur) continue
  for (const k of new Set([...Object.keys(p), ...Object.keys(cur)])) if (JSON.stringify(p[k]) !== JSON.stringify(cur[k])) fields.set(k, (fields.get(k) || 0) + 1)
}
if (fields.size) console.log('Trường khác nhau:', Object.fromEntries([...fields].sort((a, b) => b[1] - a[1])))

if (flags.includes('--apply')) {
  await applyProductChanges({ upserts: differing, deletes: [] })
  console.log(`Đã khôi phục ${differing.length} sản phẩm.`)
} else {
  console.log('Chưa ghi gì. Thêm --apply để khôi phục.')
}
process.exit()
