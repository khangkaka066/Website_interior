import { createContext, useContext, useState, useEffect, useMemo } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'clevinum_cart'

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function lineKey(item) {
  return `${item.productId}__${item.size || ''}`
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  function addItem(product, { size, quantity = 1 } = {}) {
    setItems((prev) => {
      const key = lineKey({ productId: product.id, size })
      const existing = prev.find((it) => lineKey(it) === key)
      if (existing) {
        return prev.map((it) => (lineKey(it) === key ? { ...it, quantity: it.quantity + quantity } : it))
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          size: size || null,
          quantity,
        },
      ]
    })
  }

  function updateQuantity(key, quantity) {
    setItems((prev) => (quantity <= 0 ? prev.filter((it) => lineKey(it) !== key) : prev.map((it) => (lineKey(it) === key ? { ...it, quantity } : it))))
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((it) => lineKey(it) !== key))
  }

  function clear() {
    setItems([])
  }

  const totalCount = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items])
  const totalPrice = useMemo(() => items.reduce((sum, it) => sum + it.price * it.quantity, 0), [items])

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear, totalCount, totalPrice, lineKey }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
