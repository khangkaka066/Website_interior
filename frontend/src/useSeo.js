import { useEffect } from 'react'

const SITE = 'CLEVINUM'

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// Đặt tiêu đề, mô tả, Open Graph (chia sẻ Facebook/Zalo), canonical và dữ liệu có cấu trúc (JSON-LD) cho từng trang.
// noindex: trang riêng tư (giỏ hàng, thanh toán, tra cứu đơn...) không cho Google lập chỉ mục.
export function useSeo({ title, description, image, jsonLd, noindex = false } = {}) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : ''
  const type = jsonLd?.['@type']
  useEffect(() => {
    const full = title ? `${title} | ${SITE}` : `${SITE} — Rèm Việt Giá Sỉ`
    const prevTitle = document.title
    document.title = full
    const url = window.location.origin + window.location.pathname
    setMeta('name', 'description', description)
    setMeta('property', 'og:type', type === 'Product' ? 'product' : 'website')
    setMeta('property', 'og:site_name', SITE)
    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', image)
    setMeta('property', 'og:url', url)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : '')

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    let script = null
    if (ld) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = ld.replace(/</g, '\\u003c') // không để dữ liệu sản phẩm đóng thẻ script sớm
      document.head.appendChild(script)
    }
    return () => {
      document.title = prevTitle
      script?.remove()
    }
  }, [title, description, image, ld, type, noindex])
}
