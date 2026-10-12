import { describe, test, expect, beforeEach, vi } from 'vitest'

// Kho sản phẩm admin nằm trong localStorage: dựng một bản giả trong bộ nhớ cho test.
const store = new Map()
vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })
vi.stubGlobal('window', { dispatchEvent() {}, addEventListener() {} })

const { buildPreview } = await import('../data/massUpdate')
const { REMOVED_SHOPEE_IDS } = await import('../data/adminProducts')

const existing = {
  id: 'ray-1', sku: 'ray-1', shopeeParentSku: 'ray-1', shopeeId: '111', name: 'Thanh ray', description: 'Mô tả cũ', categoryId: 'thanh-treo',
  images: ['a.jpg'], price: 100000, stock: 5, hasVariants: false, variants: [], variantAttributes: [], status: 'active', updatedBy: 'admin',
}
const basic = (rows) => ({ kind: 'basic', fileName: 'basic.xlsx', rows: rows.map((r, i) => ({ row: i + 7, parentSku: '', description: '', ...r })) })
const media = (rows) => ({ kind: 'media', fileName: 'media.xlsx', rows: rows.map((r, i) => ({ row: i + 7, id: '', parentSku: '', name: '', category: '', images: [], sizeChartTemplate: '', sizeChartImage: '', varName: '', options: [], ...r })) })
const sales = (rows) => ({ kind: 'sales', fileName: 'sales.xlsx', rows: rows.map((r, i) => ({ row: i + 7, parentSku: '', name: '', variantId: '', variantName: '', variantSku: '', gtin: '', price: null, stock: null, marketPrices: {}, ...r })) })

beforeEach(() => {
  store.clear()
  store.set('clevinum_admin_products', JSON.stringify([existing]))
})

describe('buildPreview', () => {
  test('khớp theo Mã Sản phẩm -> cập nhật, ô trống giữ nguyên dữ liệu cũ', () => {
    const { items, nextList } = buildPreview([basic([{ id: '111', name: 'Thanh ray mới', description: '' }])])
    expect(items[0].status).toBe('update')
    const p = nextList.find((x) => x.id === 'ray-1')
    expect(p.name).toBe('Thanh ray mới')
    expect(p.description).toBe('Mô tả cũ')
    expect(p.images).toEqual(['a.jpg'])
  })

  test('không có thay đổi thì báo unchanged và không đổi danh sách', () => {
    const { items, nextList } = buildPreview([basic([{ id: '111', name: 'Thanh ray' }])])
    expect(items[0].status).toBe('unchanged')
    expect(nextList).toHaveLength(1)
  })

  test('mã chưa có -> tạo mới, kèm cảnh báo còn thiếu ảnh/phân loại', () => {
    const { items, nextList } = buildPreview([basic([{ id: '222', name: 'Sản phẩm mới', description: 'abc' }])])
    expect(items[0].status).toBe('create')
    expect(items[0].warnings.join(' ')).toMatch(/thiếu.*ảnh.*media_info/)
    expect(items[0].warnings.join(' ')).toMatch(/sales_info/)
    expect(nextList).toHaveLength(2)
  })

  test('tắt tạo mới thì bỏ qua mã chưa có', () => {
    const { items, nextList } = buildPreview([basic([{ id: '222', name: 'Mới' }])], { createMissing: false })
    expect(items[0].status).toBe('skipped')
    expect(nextList).toHaveLength(1)
  })

  test('sản phẩm đặt riêng/may đo bị bỏ qua, không bị tạo lại', () => {
    const removedId = [...REMOVED_SHOPEE_IDS][0]
    const { items, nextList } = buildPreview([basic([{ id: removedId, name: 'Bộ rèm ĐẶT MAY RIÊNG' }])])
    expect(items[0].status).toBe('skipped')
    expect(items[0].warnings.join(' ')).toMatch(/đặt riêng/)
    expect(nextList).toHaveLength(1)
  })

  test('chỉ nhập sales_info vẫn cập nhật được giá phân loại của sản phẩm đã có', () => {
    const { items, nextList } = buildPreview([sales([{ id: '111', variantName: 'Trắng', variantSku: 'r-w', price: 120000, stock: 9 }])])
    expect(items[0].status).toBe('update')
    const p = nextList.find((x) => x.id === 'ray-1')
    expect(p.images).toEqual(['a.jpg']) // phần không có trong file được giữ nguyên
    expect(p.name).toBe('Thanh ray')
    expect(p.variants.some((v) => v.price === 120000)).toBe(true)
  })

  describe('sản phẩm chỉ có ở một số file vẫn được nhập, không bị loại', () => {
    const only = (list) => list.filter((i) => i.status === 'create')

    test('chỉ có trong file media (không có ở basic/sales) -> vẫn tạo, kèm cảnh báo chưa có giá', () => {
      const { items, nextList } = buildPreview([media([{ id: '301', name: 'Chỉ có ảnh', images: ['x.jpg'] }])])
      expect(only(items)).toHaveLength(1)
      const p = nextList.find((x) => x.shopeeId === '301')
      expect(p.images).toEqual(['x.jpg'])
      expect(items[0].warnings.join(' ')).toMatch(/chưa hiện trên website/)
    })

    test('mỗi file chứa một sản phẩm khác nhau -> cả 3 đều được tạo', () => {
      const { items, nextList } = buildPreview([
        basic([{ id: '401', name: 'Chỉ basic', description: 'mô tả' }]),
        media([{ id: '402', name: 'Chỉ media', images: ['m.jpg'] }]),
        sales([{ id: '403', name: 'Chỉ sales', price: 50000, stock: 3 }]),
      ])
      expect(only(items)).toHaveLength(3)
      expect(nextList).toHaveLength(4)
      expect(nextList.find((x) => x.shopeeId === '403').price).toBe(50000)
    })

    test('file này ghi Mã sản phẩm, file kia chỉ có SKU -> ghép thành MỘT sản phẩm, không tạo trùng', () => {
      const { items, nextList } = buildPreview([
        basic([{ id: '501', parentSku: 'RAY-501', name: 'Thanh ray 501', description: 'mô tả' }]),
        media([{ parentSku: 'ray-501', name: '', images: ['r.jpg'] }]), // chỉ có SKU, khác chữ hoa/thường
        sales([{ id: '501', parentSku: '', name: 'Thanh ray 501', price: 90000, stock: 4 }]),
      ])
      expect(only(items)).toHaveLength(1)
      expect(nextList).toHaveLength(2)
      const p = nextList.find((x) => x.shopeeId === '501')
      expect(p.description).toBe('mô tả')
      expect(p.images).toEqual(['r.jpg'])
      expect(p.price).toBe(90000)
    })

    test('SKU xuất hiện trước, Mã sản phẩm xuất hiện ở file sau -> vẫn ghép một sản phẩm', () => {
      const { items, nextList } = buildPreview([
        media([{ parentSku: 'RAY-601', images: ['a.jpg'] }]),
        sales([{ id: '601', parentSku: 'RAY-601', name: 'Ray 601', price: 70000, stock: 1 }]),
      ])
      expect(only(items)).toHaveLength(1)
      const p = nextList.find((x) => x.shopeeId === '601')
      expect(p.images).toEqual(['a.jpg'])
      expect(p.price).toBe(70000)
    })

    test('dòng không có Mã lẫn SKU nhưng có tên -> không bị loại, ghép theo tên với file khác', () => {
      const { items, nextList } = buildPreview([
        basic([{ name: 'Rèm không mã', description: 'có mô tả' }]),
        media([{ name: 'Rèm  KHÔNG mã', images: ['z.jpg'] }]), // khác khoảng trắng/hoa thường
      ])
      expect(only(items)).toHaveLength(1)
      const p = nextList.find((x) => x.name === 'Rèm không mã')
      expect(p.description).toBe('có mô tả')
      expect(p.images).toEqual(['z.jpg'])
    })

    test('hai sản phẩm khác Mã nhưng trùng tên KHÔNG bị gộp nhầm', () => {
      const { items } = buildPreview([basic([{ id: '701', name: 'Cùng tên' }, { id: '702', name: 'Cùng tên' }])])
      expect(only(items)).toHaveLength(2)
    })

    test('hai sản phẩm có Mã khác nhau nhưng SKU giống nhau không bị gộp nhầm', () => {
      const { items } = buildPreview([basic([{ id: '801', parentSku: 'DUP', name: 'A' }]), sales([{ id: '802', parentSku: 'DUP', name: 'B', price: 1000, stock: 1 }])])
      expect(only(items)).toHaveLength(2)
    })
  })
})
