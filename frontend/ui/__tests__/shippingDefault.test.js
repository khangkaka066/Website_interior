import { describe, it, expect } from 'vitest'
import { defaultShippingOption } from '../utils/useShippingQuote'

const opt = (id, carrier, fee) => ({ id, carrier, fee })

describe('hãng vận chuyển mặc định', () => {
  it('chọn sẵn Best Inc dù không phải rẻ nhất', () => {
    const options = [opt('a', 'GHTK', 20000), opt('b', 'BEST Express', 25000), opt('c', 'Viettel Post', 30000)]
    expect(defaultShippingOption(options).id).toBe('b')
    expect(defaultShippingOption([opt('x', 'Best Inc', 1)]).id).toBe('x')
  })
  it('không có Best thì lấy lựa chọn đầu (rẻ nhất), danh sách rỗng thì null', () => {
    expect(defaultShippingOption([opt('a', 'GHTK', 20000), opt('c', 'Viettel Post', 30000)]).id).toBe('a')
    expect(defaultShippingOption([])).toBeNull()
  })
  it('theo mã hãng "best", ưu tiên dòng tài khoản riêng hơn dòng Goship dù dòng riêng đắt hơn', () => {
    const options = [
      { id: 'own', carrier: 'Best Express', carrierCode: 'best', service: 'Giao hàng tiết kiệm', ownAccount: true, fee: 21000 },
      { id: 'goship', carrier: 'Best Express', carrierCode: 'best', service: 'Nhanh', ownAccount: false, fee: 18850 },
      { id: 'spx', carrier: 'SPX Express', carrierCode: 'shopee', fee: 12000 },
    ]
    expect(defaultShippingOption(options).id).toBe('own')
    expect(defaultShippingOption(options.slice(1)).id).toBe('goship') // không có dòng riêng thì dùng dòng Goship
  })
  it('có mã hãng thì không đoán theo tên (hãng khác mã nhưng tên chứa "Best" bị bỏ qua)', () => {
    expect(defaultShippingOption([{ id: 'a', carrier: 'Best Way', carrierCode: 'bestway', fee: 1 }, { id: 'b', carrier: 'GHTK', carrierCode: 'ghtk', fee: 2 }]).id).toBe('a') // không có best -> rẻ nhất
  })
  it('không nhận nhầm tên hãng chỉ chứa chữ "best" liền', () => {
    expect(defaultShippingOption([opt('a', 'GHTK', 1), opt('b', 'Bestway', 2)]).id).toBe('a')
  })
})
