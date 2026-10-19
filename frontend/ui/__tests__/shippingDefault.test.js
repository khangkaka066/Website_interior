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
  it('không nhận nhầm tên hãng chỉ chứa chữ "best" liền', () => {
    expect(defaultShippingOption([opt('a', 'GHTK', 1), opt('b', 'Bestway', 2)]).id).toBe('a')
  })
})
