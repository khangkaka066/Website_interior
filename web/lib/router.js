'use client'

// Lớp tương thích để mã giao diện viết cho react-router chạy được trên Next (app router).
// Chỉ có các API thực sự được dùng trong dự án: Link, Navigate, useNavigate, useParams, useLocation, useSearchParams.
import { useCallback, useEffect } from 'react'
import NextLink from 'next/link'
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation'

export function Link({ to, href, replace, state: _state, ...props }) {
  return <NextLink href={to ?? href ?? '#'} replace={replace} {...props} />
}

export function useNavigate() {
  const router = useRouter()
  return useCallback(
    (to, opts = {}) => {
      if (typeof to === 'number') return to < 0 ? router.back() : router.forward()
      return opts.replace ? router.replace(to) : router.push(to)
    },
    [router],
  )
}

export function Navigate({ to, replace }) {
  const router = useRouter()
  useEffect(() => {
    if (replace) router.replace(to)
    else router.push(to)
  }, [router, to, replace])
  return null
}

export function useParams() {
  return useNextParams() || {}
}

// `state.from` (nơi khách bị chuyển đi đăng nhập) được giữ trên địa chỉ dưới dạng ?from=
export function useLocation() {
  const pathname = usePathname()
  const searchParams = useNextSearchParams()
  const search = searchParams?.toString() || ''
  return {
    pathname,
    search: search ? `?${search}` : '',
    hash: typeof window === 'undefined' ? '' : window.location.hash,
    state: { from: searchParams?.get('from') || undefined },
  }
}

// Giống react-router: trả về [searchParams, setSearchParams].
export function useSearchParams() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useNextSearchParams()
  const set = useCallback(
    (next, opts = {}) => {
      const value = typeof next === 'function' ? next(new URLSearchParams(params?.toString())) : next
      const qs = new URLSearchParams(value).toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      if (opts.replace) router.replace(url)
      else router.push(url)
    },
    [router, pathname, params],
  )
  return [params ?? new URLSearchParams(), set]
}
