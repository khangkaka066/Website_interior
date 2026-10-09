'use client'

import { useMemo } from 'react'
import { create } from 'zustand'

// Giỏ hàng (Zustand). Lưu trong localStorage; máy chủ luôn render giỏ rỗng và trình duyệt nạp lại sau khi mở trang
// (hydrate), nên HTML từ server và lần vẽ đầu tiên của trình duyệt giống nhau, không bị lệch.
const STORAGE_KEY = 'clevinum_cart'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    // Bỏ các dòng rèm may đo còn sót từ phiên cũ (tính năng "Xem thử rèm" đã gỡ, đặt hàng sẽ báo sản phẩm không tồn tại).
    return Array.isArray(raw) ? raw.filter((it) => it?.productId !== 'custom-curtain') : []
  } catch {
    return []
  }
}

export function lineKey(item) {
  return `${item.productId}__${item.size || ''}`
}

export const useCartStore = create((set, get) => ({
  items: [],
  hydrated: false,

  hydrate() {
    if (get().hydrated) return
    set({ items: load(), hydrated: true })
    // Từ đây mới ghi ngược vào localStorage (ghi sớm hơn sẽ xóa mất giỏ cũ bằng giỏ rỗng).
    useCartStore.subscribe((s) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s.items))
      } catch {
        // bỏ qua: chỉ mất việc nhớ giỏ hàng
      }
    })
    // Tab khác (hoặc trang cấu hình rèm) đổi giỏ thì cập nhật theo.
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) set({ items: load() })
    })
  },

  addItem(product, { size, quantity = 1, price, image } = {}) {
    set((state) => {
      const key = lineKey({ productId: product.id, size })
      if (state.items.some((it) => lineKey(it) === key)) {
        return { items: state.items.map((it) => (lineKey(it) === key ? { ...it, quantity: it.quantity + quantity } : it)) }
      }
      return {
        items: [
          ...state.items,
          { productId: product.id, name: product.name, image: image || product.image, price: price ?? product.price, size: size || null, quantity },
        ],
      }
    })
  },

  updateQuantity(key, quantity) {
    set((state) => ({
      items: quantity <= 0 ? state.items.filter((it) => lineKey(it) !== key) : state.items.map((it) => (lineKey(it) === key ? { ...it, quantity } : it)),
    }))
  },

  removeItem(key) {
    set((state) => ({ items: state.items.filter((it) => lineKey(it) !== key) }))
  },

  clear() {
    set({ items: [] })
  },
}))

// Cùng giao diện với CartContext cũ nên các trang không phải sửa.
export function useCart() {
  const items = useCartStore((s) => s.items)
  const hydrated = useCartStore((s) => s.hydrated)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clear = useCartStore((s) => s.clear)
  const totalCount = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items])
  const totalPrice = useMemo(() => items.reduce((sum, it) => sum + it.price * it.quantity, 0), [items])
  // hydrated: đã nạp giỏ từ localStorage (trước đó `items` rỗng chỉ vì chưa nạp, không phải giỏ trống thật)
  return { items, hydrated, addItem, updateQuantity, removeItem, clear, totalCount, totalPrice, lineKey }
}
