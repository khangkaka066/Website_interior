import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Danh sách yêu thích lưu trong trình duyệt (không cần đăng nhập): chỉ lưu mã sản phẩm.
const WishlistContext = createContext(null)
const STORAGE_KEY = 'clevinum_wishlist'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // bỏ qua: chỉ mất trạng thái yêu thích
    }
  }, [ids])

  const value = useMemo(
    () => ({
      ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      toggle: (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev])),
    }),
    [ids],
  )
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist cần nằm trong WishlistProvider')
  return ctx
}
