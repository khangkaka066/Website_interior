// Gửi sự kiện cho Meta Pixel, TikTok Pixel và Google tag (nếu đã nạp: xem components/AdPixels.jsx). Chưa có pixel nào thì không làm gì.
// Dữ liệu gửi đi chỉ gồm mã/tên sản phẩm, số lượng, giá trị đơn và mã đơn: KHÔNG gửi tên, số điện thoại, email hay địa chỉ khách.
const CUR = 'VND'
const ids = (items = []) => items.map((i) => String(i.id))

// type: PAGE_VIEW | VIEW_CONTENT | ADD_TO_CART | CHECKOUT_START | PURCHASE
// data: { value, items: [{ id, name, price, quantity }], orderId }
export function pixelTrack(type, data = {}) {
  if (typeof window === 'undefined') return
  const { value, items = [], orderId } = data
  const { fbq, ttq, gtag } = window
  const contents = items.map((i) => ({ id: String(i.id), quantity: i.quantity || 1, price: i.price }))

  try {
    if (typeof fbq === 'function') {
      const base = { content_ids: ids(items), content_type: 'product', contents, value, currency: CUR }
      if (type === 'PAGE_VIEW') fbq('track', 'PageView')
      else if (type === 'VIEW_CONTENT') fbq('track', 'ViewContent', base)
      else if (type === 'ADD_TO_CART') fbq('track', 'AddToCart', base)
      else if (type === 'CHECKOUT_START') fbq('track', 'InitiateCheckout', { ...base, num_items: items.reduce((n, i) => n + (i.quantity || 1), 0) })
      else if (type === 'PURCHASE') fbq('track', 'Purchase', base, orderId ? { eventID: orderId } : undefined)
    }
    if (ttq && typeof ttq.track === 'function') {
      const base = { contents: items.map((i) => ({ content_id: String(i.id), content_name: i.name, quantity: i.quantity || 1, price: i.price })), content_type: 'product', value, currency: CUR }
      if (type === 'PAGE_VIEW') ttq.page()
      else if (type === 'VIEW_CONTENT') ttq.track('ViewContent', base)
      else if (type === 'ADD_TO_CART') ttq.track('AddToCart', base)
      else if (type === 'CHECKOUT_START') ttq.track('InitiateCheckout', base)
      else if (type === 'PURCHASE') ttq.track('CompletePayment', base)
    }
    if (typeof gtag === 'function') {
      const gItems = items.map((i) => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.quantity || 1 }))
      const base = { currency: CUR, value, items: gItems }
      if (type === 'PAGE_VIEW') gtag('event', 'page_view')
      else if (type === 'VIEW_CONTENT') gtag('event', 'view_item', base)
      else if (type === 'ADD_TO_CART') gtag('event', 'add_to_cart', base)
      else if (type === 'CHECKOUT_START') gtag('event', 'begin_checkout', base)
      else if (type === 'PURCHASE') gtag('event', 'purchase', { ...base, ...(orderId && { transaction_id: orderId }) })
    }
  } catch {
    // pixel lỗi không được làm hỏng trang
  }
}
