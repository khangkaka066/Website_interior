import { getToken } from '../api'

// Lịch sử chat lưu trên trình duyệt được TÁCH THEO TÀI KHOẢN: mỗi tài khoản (hoặc khách vãng lai) một bộ khóa riêng, nên đổi tài khoản trên
// cùng máy thì cuộc chat của người trước không hiện ra. Đăng xuất / đăng nhập thì xóa khóa tương ứng (xem auth.js). Mọi thao tác bọc try/catch
// vì trình duyệt có thể chặn localStorage (chế độ riêng tư).
export const AUTH_EVENT = 'clevinum:auth' // phát ra mỗi khi đăng nhập / đăng xuất để khung chat đổi sang đúng tài khoản

const KEYS = { id: 'clevinum_chat_conversation_id', token: 'clevinum_chat_token', seen: 'clevinum_chat_last_seen' }
const SESSION_KEY = 'clevinum_session' // cùng khóa với auth.js (không import để tránh vòng lặp)
const GUEST = 'guest'

// 'u_<id tài khoản>' khi đang đăng nhập, 'guest' khi chưa.
export function chatScope() {
  try {
    const user = JSON.parse(sessionStorage.getItem(SESSION_KEY))
    return user?.id && getToken() ? `u_${user.id}` : GUEST
  } catch {
    return GUEST
  }
}

const key = (name, scope) => `${KEYS[name]}:${scope}`
const get = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const set = (k, v) => {
  try {
    if (v === null || v === undefined) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    // không lưu được: khung chat vẫn chạy trong phiên này
  }
}

export const readChat = (scope) => ({ id: get(key('id', scope)), token: get(key('token', scope)) })
export const readSeen = (scope) => get(key('seen', scope))
export const writeSeen = (scope, v) => set(key('seen', scope), v)
export function writeChat(scope, { id, token }) {
  set(key('id', scope), id)
  set(key('token', scope), token)
}

// Xóa sạch dữ liệu chat của một tài khoản (hoặc của khách vãng lai) trên máy này.
export function clearChatStorage(scope) {
  for (const name of Object.keys(KEYS)) set(key(name, scope), null)
}

// Khóa cũ (trước khi tách theo tài khoản) không biết thuộc ai: khách vãng lai thì chuyển sang khóa 'guest', đang đăng nhập thì bỏ. Chạy một lần.
export function migrateLegacyChat(scope) {
  const legacy = Object.fromEntries(Object.entries(KEYS).map(([name, k]) => [name, get(k)]))
  if (!legacy.id && !legacy.token) return
  if (scope === GUEST && !get(key('id', GUEST))) {
    set(key('id', GUEST), legacy.id)
    set(key('token', GUEST), legacy.token)
    set(key('seen', GUEST), legacy.seen)
  }
  for (const k of Object.values(KEYS)) set(k, null)
}
