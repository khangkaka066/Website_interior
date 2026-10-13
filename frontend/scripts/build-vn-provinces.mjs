// Tạo public/data/vn-provinces.json (bản gọn) từ dataset của thanglequoc/vietnamese-provinces-database.
// Dùng: node scripts/build-vn-provinces.mjs <đường-dẫn-full_json_generated_data_vn_units.json>
// Tải file nguồn: https://github.com/thanglequoc/vietnamese-provinces-database/blob/master/json/full_json_generated_data_vn_units.json
import { readFileSync, writeFileSync } from 'node:fs'

const src = process.argv[2]
if (!src) {
  console.error('Thiếu đường dẫn file nguồn.')
  process.exit(1)
}

const provinces = JSON.parse(readFileSync(src, 'utf8'))
// [[mã tỉnh, tên tỉnh, [[mã phường/xã, tên phường/xã], ...]], ...] — hành chính 2 cấp, không có quận/huyện.
const compact = provinces.map((p) => [p.Code, p.FullName, p.Wards.map((w) => [w.Code, w.FullName])])

writeFileSync(new URL('../public/data/vn-provinces.json', import.meta.url), JSON.stringify(compact))
console.log(`${compact.length} tỉnh/thành, ${compact.reduce((n, p) => n + p[2].length, 0)} phường/xã`)
