'use client'

import { create } from 'zustand'

// Danh sách yêu thích (Zustand), lưu trong trình duyệt, không cần đăng nhập: chỉ lưu mã sản phẩm. Cách nạp giống giỏ hàng.
const STORAGE_KEY = 'clevinum_wishlist'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export const useWishlistStore = create((set, get) => ({
  ids: [],
  hydrated: false,

  hydrate() {
    if (get().hydrated) return
    set({ ids: load(), hydrated: true })
    useWishlistStore.subscribe((s) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s.ids))
      } catch {
        // bỏ qua: chỉ mất trạng thái yêu thích
      }
    })
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) set({ ids: load() })
    })
  },

  toggle(id) {
    set((state) => ({ ids: state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [id, ...state.ids] }))
  },
}))

export function useWishlist() {
  const ids = useWishlistStore((s) => s.ids)
  const toggle = useWishlistStore((s) => s.toggle)
  return { ids, count: ids.length, has: (id) => ids.includes(id), toggle }
}
