'use client'

import { useEffect, useState } from 'react'
import { shopInfo as defaults } from './data/shop'
import { api } from './api'

// Thông tin cửa hàng + nội dung trang liên hệ lấy từ Cài đặt (dashboard). Header và Footer dùng chung:
// chỉ gọi API một lần cho cả trang; lỗi mạng thì dùng bản mặc định trong data/shop.js.
let pending = null
function load() {
  if (!pending) {
    pending = api.get('/shop/content').catch(() => {
      pending = null // lần sau thử lại
      return null
    })
  }
  return pending
}

export function useShopInfo() {
  const [live, setLive] = useState(null)
  useEffect(() => {
    let alive = true
    load().then((d) => alive && d && setLive(d))
    return () => {
      alive = false
    }
  }, [])
  return { shopInfo: { ...defaults, ...(live?.store || {}) }, contact: live?.content?.contact }
}
