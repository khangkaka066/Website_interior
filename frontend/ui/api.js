// Mặc định gọi cùng origin (/api) và để Vite proxy sang backend (xem vite.config.js): mở bằng link công khai/ngrok/điện thoại
// vẫn gọi được API. Chỉ đặt VITE_API_BASE_URL khi backend nằm ở domain khác (lúc deploy).
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
const TOKEN_KEY = 'clevinum_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // Lỗi không phải JSON (ví dụ proxy cắt vì quá lâu) thì kèm mã lỗi để dễ tìm nguyên nhân.
    const err = new Error(data?.error || `Đã có lỗi xảy ra, vui lòng thử lại (mã ${res.status}).`)
    err.status = res.status
    err.data = data // phần JSON server trả về (ví dụ jobId của phân tích đang chạy)
    throw err
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
