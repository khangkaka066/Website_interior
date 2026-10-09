// Đọc file giảm giá (Excel .xlsx hoặc .csv) có các cột: Tên sản phẩm, Mã sản phẩm, Tên phân loại hàng, Mã phân loại hàng, Ngành hàng...,
// Doanh số, Giá Gốc, Giá đang hiển thị, Kho hàng. Chỉ lấy Mã sản phẩm, Mã phân loại hàng, Giá Gốc, Giá đang hiển thị gửi lên server;
// việc đối chiếu với kho sản phẩm và tính % giảm do server làm.

// Bỏ dấu, chữ thường, gộp khoảng trắng: "Giá  Gốc" / "GIÁ GỐC" / "gia goc" đều thành "gia goc".
export const normHeader = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const COLUMNS = {
  productCode: (h) => h === 'ma san pham',
  variantCode: (h) => h.startsWith('ma phan loai'),
  listPrice: (h) => h === 'gia goc',
  salePrice: (h) => h === 'gia dang hien thi',
}
const LABELS = { productCode: 'Mã sản phẩm', variantCode: 'Mã phân loại hàng', listPrice: 'Giá Gốc', salePrice: 'Giá đang hiển thị' }

const cleanId = (v) => String(v ?? '').trim().replace(/\.0+$/, '')

// "59.294đ", "1,234,567", 59294 -> số nguyên (đồng); rỗng/không đọc được -> ''.
export function parsePrice(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : ''
  const digits = String(v ?? '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : ''
}

// matrix: mảng các dòng (mảng ô). Tìm dòng tiêu đề trong 15 dòng đầu rồi đọc các dòng dưới nó.
export function rowsFromMatrix(matrix) {
  let headerAt = -1
  let cols = {}
  for (let i = 0; i < Math.min(matrix.length, 15) && headerAt < 0; i++) {
    const heads = matrix[i].map(normHeader)
    const found = {}
    for (const [key, test] of Object.entries(COLUMNS)) {
      const idx = heads.findIndex(test)
      if (idx >= 0) found[key] = idx
    }
    if (found.listPrice !== undefined && found.salePrice !== undefined) {
      headerAt = i
      cols = found
    }
  }
  if (headerAt < 0) throw new Error('Không tìm thấy dòng tiêu đề có cột “Giá Gốc” và “Giá đang hiển thị”.')
  if (cols.variantCode === undefined && cols.productCode === undefined) throw new Error('File cần có cột “Mã phân loại hàng” hoặc “Mã sản phẩm”.')
  const missing = Object.keys(LABELS).filter((k) => cols[k] === undefined).map((k) => LABELS[k])

  const rows = []
  for (let i = headerAt + 1; i < matrix.length; i++) {
    const line = matrix[i]
    const get = (k) => (cols[k] === undefined ? '' : line[cols[k]])
    const row = { row: i + 1, productCode: cleanId(get('productCode')), variantCode: cleanId(get('variantCode')), listPrice: parsePrice(get('listPrice')), salePrice: parsePrice(get('salePrice')) }
    if (!row.productCode && !row.variantCode && row.listPrice === '' && row.salePrice === '') continue // dòng trống
    rows.push(row)
  }
  return { rows, missing }
}

// CSV có ngoặc kép; tự nhận dấu phân cách , ; hoặc tab theo dòng đầu.
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '')
  const first = src.split(/\r?\n/, 1)[0]
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]
  const out = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      out.push(row); row = []
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row) }
  return out
}

const cellValue = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
    if ('result' in v) return v.result ?? ''
    if ('text' in v) return v.text ?? ''
    if (v instanceof Date) return v.toISOString()
  }
  return v
}

export async function parseDiscountFile(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('File quá lớn (tối đa 10MB).')
  let matrix
  if (/\.csv$/i.test(file.name)) {
    matrix = parseCsv(await file.text())
  } else {
    const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
    const ws = wb.worksheets[0]
    if (!ws) throw new Error('File không có sheet nào.')
    matrix = []
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      const cells = []
      row.eachCell({ includeEmpty: true }, (cell, c) => { cells[c - 1] = cellValue(cell.value) })
      matrix[r - 1] = Array.from(cells, (x) => x ?? '')
    })
    for (let i = 0; i < matrix.length; i++) matrix[i] ||= []
  }
  return rowsFromMatrix(matrix)
}
