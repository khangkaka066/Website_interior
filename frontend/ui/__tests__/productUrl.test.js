import { describe, it, expect } from 'vitest'
import { slugify, productParam, productPath, findProductByParam } from '../utils/productUrl'

describe('địa chỉ riêng của sản phẩm', () => {
  it('bỏ dấu tiếng Việt, đ -> d, nối bằng gạch ngang', () => {
    expect(slugify('Rèm đục lỗ ORE vải gấm (8 màu)')).toBe('rem-duc-lo-ore-vai-gam-8-mau')
    expect(slugify('  ĐẸP!!!  ')).toBe('dep')
  })
  it('cắt ở ranh giới từ, không vượt 60 ký tự', () => {
    const s = slugify('Rèm cửa sổ cao cấp chống nắng cản sáng giá xưởng giao hàng toàn quốc nhiều màu nhiều kích thước')
    expect(s.length).toBeLessThanOrEqual(60)
    expect(s.endsWith('-')).toBe(false)
  })
  it('mã đứng cuối; thiếu tên thì chỉ còn mã', () => {
    expect(productPath({ id: 'sp123', name: 'Rèm ore' })).toBe('/san-pham/rem-ore-sp123')
    expect(productParam({ id: 'sp123', name: '' })).toBe('sp123')
  })
  it('tra được bằng mã cũ, bằng tên-mã, và bằng tên cũ + mã', () => {
    const list = [{ id: 'sp1', name: 'A' }, { id: 'sp11', name: 'B' }, { id: 'lh-do-go', name: 'Đồ gỗ' }]
    expect(findProductByParam(list, 'sp1').id).toBe('sp1')
    expect(findProductByParam(list, 'b-sp11').id).toBe('sp11')
    expect(findProductByParam(list, 'ten-cu-sp1').id).toBe('sp1')
    expect(findProductByParam(list, 'do-go-lh-do-go').id).toBe('lh-do-go')
    expect(findProductByParam(list, 'khong-co')).toBeUndefined()
  })
})
