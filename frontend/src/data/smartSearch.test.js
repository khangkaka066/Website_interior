import { describe, test, expect } from 'vitest'
import { fold, buildIndex, searchProducts, suggest, COLOR_FILTERS, WIDTH_FILTERS } from './smartSearch'

const P = (id, name, extra = {}) => ({ id, name, type: 'Rèm cửa', categoryId: 'chong-nang', price: 100000, shopeeId: `9${id}`, description: '', variants: [], options: [], ...extra })
const products = [
  P('1', 'Rèm đục lỗ ORE vải gấm chống nắng', { variants: [{ label: 'Xám đậm / Rộng 1.6m Cao 1.8m', price: 1, stock: 5 }, { label: 'Nâu đất / Rộng 2.8m Cao 2m', price: 1, stock: 0 }] }),
  P('2', 'Rèm dán tường 2 lớp cao cấp'),
  P('3', 'Rèm móc RIDO vải gấm dày'),
  P('4', 'Rèm Voan trắng lụa che mờ', { variants: [{ label: 'Trắng / Rộng 1m8 Cao 2m', price: 1, stock: 0 }] }),
  P('5', 'Thanh treo rèm cao cấp đầy đủ phụ kiện', { type: 'Phụ kiện rèm' }),
  P('6', 'Dây cột vén rèm nhiều màu sắc', { description: 'Phụ kiện buộc rèm gọn gàng, có móc ore' }),
]
const index = buildIndex(products)
const ids = (q) => searchProducts(index, q).results.map((r) => r.product.id)

describe('fold', () => {
  test('bỏ dấu, hạ chữ thường, đ -> d', () => {
    expect(fold('Rèm ĐỤC LỖ')).toBe('rem duc lo')
    expect(fold('  Giá   xưởng!! ')).toBe('gia xuong')
  })
  test('giữ dấu chấm trong số đo, bỏ ở cuối câu', () => {
    expect(fold('Rộng 1.8m.')).toBe('rong 1.8m')
  })
})

describe('tìm kiếm', () => {
  test('không dấu vẫn tìm được', () => expect(ids('rem ore')).toContain('1'))
  test('mọi từ phải khớp (AND)', () => {
    expect(ids('rem ore').includes('2')).toBe(false)
    expect(ids('rem rido')).toEqual(['3'])
  })
  test('tên khớp xếp trước khớp mô tả', () => {
    // sp 1 có "ore" trong tên, sp 6 chỉ có trong mô tả -> mô tả chỉ dùng khi tên/loại/phân loại không có kết quả
    expect(ids('ore')).toEqual(['1'])
  })
  test('rơi xuống tìm trong mô tả khi không có gì khớp ở tên', () => {
    expect(ids('buộc rèm gọn')).toEqual(['6'])
  })
  test('tìm theo Mã Shopee', () => expect(ids('95')).toContain('5'))
  test('không có kết quả', () => expect(ids('xyzxyz')).toEqual([]))
  test('câu tìm rỗng trả về tất cả', () => expect(ids('')).toHaveLength(products.length))
})

describe('từ đồng nghĩa', () => {
  test('khoen / đục lỗ = ore', () => {
    expect(ids('khoen')).toContain('1')
    expect(ids('duc lo')).toContain('1')
  })
  test('cách nhiệt / chắn sáng = chống nắng', () => {
    expect(ids('cach nhiet')).toContain('1')
    expect(ids('can sang')).toContain('1')
  })
})

describe('sửa lỗi chính tả', () => {
  test('gõ sai được sửa theo từ vựng của shop', () => {
    const r = searchProducts(index, 'vooan')
    expect(r.correctedQuery).toBe('voan')
    expect(r.results.map((x) => x.product.id)).toContain('4')
  })
  test('hoán đổi ký tự', () => {
    expect(searchProducts(index, 'rem doan').correctedQuery).toBeTruthy()
    expect(searchProducts(index, 'rdio').correctedQuery).toBe('rido')
  })
  test('từ đúng không bị sửa; từ ngắn không bị sửa bừa', () => {
    expect(searchProducts(index, 'rem ore').correctedQuery).toBeNull()
    expect(searchProducts(index, 'abc').correctedQuery).toBeNull()
  })
})

describe('gợi ý khi gõ', () => {
  test('trả sản phẩm, danh mục và từ khóa', () => {
    const s = suggest(index, 'rem')
    expect(s.products.length).toBeGreaterThan(0)
    expect(s.products.length).toBeLessThanOrEqual(5)
    expect(s.total).toBeGreaterThan(0)
  })
  test('rỗng thì không gợi ý gì', () => expect(suggest(index, '  ')).toMatchObject({ products: [], categories: [], keywords: [] }))
})

describe('dữ liệu lọc', () => {
  const doc = (id) => index.docs.find((d) => d.product.id === id)
  test('màu theo tên phân loại', () => {
    expect(doc('1').colors.has('xam')).toBe(true)
    expect(doc('1').colors.has('nau')).toBe(true)
    expect(doc('4').colors.has('trang')).toBe(true)
  })
  test('chiều rộng, kể cả viết 1m8', () => {
    expect(doc('1').widths).toEqual([1.6, 2.8])
    expect(doc('4').widths).toEqual([1.8])
  })
  test('nhóm chiều rộng', () => {
    const bucket = (id) => WIDTH_FILTERS.filter((w) => doc(id).widths.some(w.test)).map((w) => w.id)
    expect(bucket('1')).toEqual(['w-15-2', 'w-ge25'])
  })
  test('còn hàng: có ít nhất một phân loại còn, hoặc không có phân loại', () => {
    expect(doc('1').inStock).toBe(true)
    expect(doc('4').inStock).toBe(false)
    expect(doc('2').inStock).toBe(true)
  })
  test('có đủ bộ lọc màu', () => expect(COLOR_FILTERS.length).toBeGreaterThanOrEqual(6))
})
