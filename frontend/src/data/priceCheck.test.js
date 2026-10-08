import { describe, test, expect } from 'vitest'
import { findPriceConflicts, normSize, kindOf, issueSignature } from './priceCheck'

const product = (id, variants, extra = {}) => ({
  id, name: `SP ${id}`, hasVariants: true,
  variantAttributes: [{ name: 'Màu Sắc', values: [] }, { name: 'Kích thước', values: [] }],
  variants: variants.map(([label, price, sku], i) => ({ id: `${id}-${i}`, label, price, sku })), ...extra,
})

describe('normSize', () => {
  test('các cách viết cùng một cỡ coi là một', () => {
    expect(normSize('Rộng 1m8 Cao 1m5')).toBe(normSize('Rông 1.8m Cao 1.5m'))
    expect(normSize('1m8')).toBe('1.8m')
  })
})

describe('kindOf (loại rèm)', () => {
  test('nhận loại từ từ khóa, bỏ qua màu', () => {
    expect(kindOf('Dán 2 Lớp Xám Ghi')).toBe(kindOf('Dán 2 Lớp Vàng Kem'))
    expect(kindOf('Rido Xanh Lá')).toBe('rido')
    expect(kindOf('KHOEN LỖ ORE')).toBe(kindOf('ĐỤC LỖ ORE'))
  })
  test('voan trơn / hạt mưa / kẻ là các loại khác nhau', () => {
    const set = new Set(['Khoen ORE Voan Trơn', 'ORE Voan Xám Hạt Mưa', 'DÁN TRẮNG KẺ HẠT CC'].map(kindOf))
    expect(set.size).toBe(3)
    expect(kindOf('ORE VoanTrắng HạtMưa')).toBe(kindOf('ORE Voan Xám Hạt Mưa'))
  })
  test('ore khác dán khác rido', () => {
    expect(new Set([kindOf('ORE Xám'), kindOf('Dán Xám'), kindOf('Rido Xám')]).size).toBe(3)
  })
})

describe('findPriceConflicts', () => {
  test('cùng sản phẩm, cùng cỡ, cùng loại, khác màu mà lệch giá -> cảnh báo', () => {
    const p = product('a', [['Xám / Rộng 1m Cao 2m', 100], ['Nâu / Rộng 1m Cao 2m', 100], ['Xanh / Rộng 1m Cao 2m', 150]])
    const { issues, totals } = findPriceConflicts([p])
    expect(totals.size).toBe(1)
    expect(issues[0].type).toBe('size-price')
    expect(issues[0].common.price).toBe(100)
    expect([...issues[0].oddIds]).toEqual(['a-2'])
  })
  test('cùng giá thì không cảnh báo', () => {
    const p = product('a', [['Xám / Rộng 1m Cao 2m', 100], ['Nâu / Rộng 1m Cao 2m', 100]])
    expect(findPriceConflicts([p]).issues).toEqual([])
  })
  test('khác kích thước lệch giá là bình thường', () => {
    const p = product('a', [['Xám / Rộng 1m Cao 2m', 100], ['Xám / Rộng 2m Cao 2m', 200]])
    expect(findPriceConflicts([p]).issues).toEqual([])
  })
  test('khác loại rèm (ORE vs Dán) cùng cỡ lệch giá không bị báo', () => {
    const p = product('a', [['ORE Xám / Rộng 1m Cao 2m', 100], ['Dán Xám / Rộng 1m Cao 2m', 150]])
    expect(findPriceConflicts([p]).issues).toEqual([])
  })
  test('voan trơn và hạt mưa không bị báo', () => {
    const p = product('a', [['Khoen ORE Voan Trơn / Rộng 2.8m Cao 2.7m', 712489], ['ORE Voan Xám Hạt Mưa / Rộng 2.8m Cao 2.7m', 930597]])
    expect(findPriceConflicts([p]).issues).toEqual([])
  })
  test('trùng SKU, cùng cỡ, giá khác -> báo mức error', () => {
    const a = product('a', [['Xám / Rộng 1m Cao 2m', 100, 'SKU1']])
    const b = product('b', [['Nâu / Rộng 1m Cao 2m', 300, 'SKU1']])
    const { issues, totals } = findPriceConflicts([a, b])
    expect(totals.sku).toBe(1)
    expect(issues[0].severity).toBe('error')
  })
  test('sản phẩm không có phân loại bị bỏ qua', () => {
    expect(findPriceConflicts([{ id: 'x', name: 'x', hasVariants: false, variants: [], price: 5 }]).issues).toEqual([])
  })
  test('chữ ký đổi khi giá đổi (để cảnh báo đã bỏ qua hiện lại)', () => {
    const mk = (price) => findPriceConflicts([product('a', [['Xám / Rộng 1m Cao 2m', 100], ['Nâu / Rộng 1m Cao 2m', price]])]).issues[0]
    expect(issueSignature(mk(150))).not.toBe(issueSignature(mk(160)))
    expect(issueSignature(mk(150))).toBe(issueSignature(mk(150)))
  })
})
