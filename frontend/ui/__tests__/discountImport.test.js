import { describe, test, expect } from 'vitest'
import { normHeader, parsePrice, rowsFromMatrix, parseCsv } from '../data/discountImport'

const HEAD = ['Tên sản phẩm', 'Mã sản phẩm', 'Tên phân loại hàng', 'Mã phân loại hàng', 'Ngành hàng', 'Ngành hàng con', 'Ngành hàng cấp 3', 'Doanh số', 'Giá Gốc', 'Giá đang hiển thị', 'Kho hàng']

describe('đọc file giảm giá', () => {
  test('chuẩn hóa tiêu đề: bỏ dấu, hoa/thường, khoảng trắng', () => {
    expect(normHeader('  Giá   ĐANG hiển thị ')).toBe('gia dang hien thi')
    expect(normHeader('Mã phân loại hàng')).toBe('ma phan loai hang')
  })
  test('đọc giá từ số, chuỗi có đ/dấu chấm/dấu phẩy', () => {
    expect(parsePrice(59294)).toBe(59294)
    expect(parsePrice('59.294đ')).toBe(59294)
    expect(parsePrice('1,234,567')).toBe(1234567)
    expect(parsePrice('')).toBe('')
  })
  test('lấy đúng cột theo tên, bỏ qua dòng trống và dòng trên tiêu đề', () => {
    const { rows, missing } = rowsFromMatrix([
      ['Báo cáo giá'],
      HEAD,
      ['Rèm A', 26331538658, 'Xám / 2m', 396395613449, 'Nhà cửa', '', '', 5, 100000, 79000, 10],
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['Rèm B', '123', '', '', 'Nhà cửa', '', '', 0, '90.000đ', '72.000đ', 3],
    ])
    expect(missing).toEqual([])
    expect(rows).toEqual([
      { row: 3, productCode: '26331538658', variantCode: '396395613449', listPrice: 100000, salePrice: 79000 },
      { row: 5, productCode: '123', variantCode: '', listPrice: 90000, salePrice: 72000 },
    ])
  })
  test('báo lỗi khi thiếu cột giá hoặc cột mã', () => {
    expect(() => rowsFromMatrix([['Mã sản phẩm', 'Giá Gốc']])).toThrow(/Giá đang hiển thị/)
    expect(() => rowsFromMatrix([['Giá Gốc', 'Giá đang hiển thị']])).toThrow(/Mã phân loại hàng/)
  })
  test('CSV: ngoặc kép, dấu phẩy trong ô, BOM, dấu chấm phẩy', () => {
    const csv = '﻿Mã sản phẩm,Mã phân loại hàng,Giá Gốc,Giá đang hiển thị\r\n1,"2",""100,000"",90000\r\n'
    expect(parseCsv(csv)[0]).toEqual(['Mã sản phẩm', 'Mã phân loại hàng', 'Giá Gốc', 'Giá đang hiển thị'])
    const semi = parseCsv('Mã sản phẩm;Mã phân loại hàng;Giá Gốc;Giá đang hiển thị\n1;2;100000;90000')
    expect(rowsFromMatrix(semi).rows).toEqual([{ row: 2, productCode: '1', variantCode: '2', listPrice: 100000, salePrice: 90000 }])
  })
})
