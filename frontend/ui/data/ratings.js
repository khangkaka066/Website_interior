'use client'

import { useEffect, useState } from 'react'
import { api } from '../api'

// Điểm sao trung bình của mọi sản phẩm ({ [productId]: { average, count } }), lấy một lần cho cả trang và dùng chung cho mọi thẻ sản phẩm.
let cache = null
let inflight = null
const listeners = new Set()

function load() {
  if (cache || inflight) return
  inflight = api
    .get('/shop/ratings')
    .then((data) => {
      cache = data && typeof data === 'object' ? data : {}
      listeners.forEach((fn) => fn(cache))
    })
    .catch(() => {
      cache = {} // lỗi thì thôi không hiện sao, không chặn trang
    })
    .finally(() => {
      inflight = null
    })
}

export function useRatings() {
  const [ratings, setRatings] = useState(cache || {})
  useEffect(() => {
    listeners.add(setRatings)
    if (cache) setRatings(cache)
    else load()
    return () => listeners.delete(setRatings)
  }, [])
  return ratings
}
