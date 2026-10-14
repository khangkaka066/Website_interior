import { describe, test, expect, beforeEach } from 'vitest'
import { chatScope, readChat, writeChat, readSeen, writeSeen, clearChatStorage, migrateLegacyChat } from '../utils/chatStorage'

// Giả lập localStorage / sessionStorage (môi trường kiểm thử chạy trong Node, không có trình duyệt).
const store = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }
}
const login = (id) => {
  sessionStorage.setItem('clevinum_session', JSON.stringify({ id, role: 'CUSTOMER' }))
  localStorage.setItem('clevinum_token', 'jwt')
}

beforeEach(() => {
  globalThis.localStorage = store()
  globalThis.sessionStorage = store()
})

describe('lịch sử chat theo tài khoản', () => {
  test('khách vãng lai là "guest", đăng nhập là "u_<id>"; thiếu token thì vẫn là khách', () => {
    expect(chatScope()).toBe('guest')
    sessionStorage.setItem('clevinum_session', JSON.stringify({ id: 'user_123' }))
    expect(chatScope()).toBe('guest') // có phiên nhưng không có token
    localStorage.setItem('clevinum_token', 'jwt')
    expect(chatScope()).toBe('u_user_123')
  })

  test('hai tài khoản và khách không thấy dữ liệu của nhau', () => {
    writeChat('u_user_123', { id: 'conv-A', token: 'tok-A' })
    writeChat('u_user_456', { id: 'conv-B', token: 'tok-B' })
    writeChat('guest', { id: 'conv-G', token: 'tok-G' })
    expect(readChat('u_user_123')).toEqual({ id: 'conv-A', token: 'tok-A' })
    expect(readChat('u_user_456')).toEqual({ id: 'conv-B', token: 'tok-B' })
    expect(readChat('guest')).toEqual({ id: 'conv-G', token: 'tok-G' })
    expect(readChat('u_user_789')).toEqual({ id: null, token: null })
  })

  test('xóa dữ liệu của một tài khoản không đụng tài khoản khác', () => {
    writeChat('u_user_123', { id: 'conv-A', token: 'tok-A' })
    writeSeen('u_user_123', 'm1')
    writeChat('u_user_456', { id: 'conv-B', token: 'tok-B' })
    clearChatStorage('u_user_123')
    expect(readChat('u_user_123')).toEqual({ id: null, token: null })
    expect(readSeen('u_user_123')).toBeNull()
    expect(readChat('u_user_456').id).toBe('conv-B')
  })

  test('đăng xuất đúng tài khoản: scope tính trước khi xóa phiên', () => {
    login('user_123')
    writeChat(chatScope(), { id: 'conv-A', token: 'tok-A' })
    const scope = chatScope()
    clearChatStorage(scope)
    sessionStorage.removeItem('clevinum_session')
    localStorage.removeItem('clevinum_token')
    expect(chatScope()).toBe('guest')
    expect(readChat(scope).id).toBeNull()
  })

  test('khóa cũ (chưa tách tài khoản): chuyển cho khách vãng lai, bỏ nếu đang đăng nhập', () => {
    localStorage.setItem('clevinum_chat_conversation_id', 'old-conv')
    localStorage.setItem('clevinum_chat_token', 'old-tok')
    migrateLegacyChat('guest')
    expect(readChat('guest')).toEqual({ id: 'old-conv', token: 'old-tok' })
    expect(localStorage.getItem('clevinum_chat_conversation_id')).toBeNull()

    localStorage.setItem('clevinum_chat_conversation_id', 'old-conv-2')
    localStorage.setItem('clevinum_chat_token', 'old-tok-2')
    migrateLegacyChat('u_user_123')
    expect(readChat('u_user_123').id).toBeNull() // không biết của ai nên không gán cho tài khoản
    expect(localStorage.getItem('clevinum_chat_token')).toBeNull()
  })

  test('localStorage bị chặn thì không văng lỗi', () => {
    globalThis.localStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
    expect(() => writeChat('guest', { id: 'x', token: 'y' })).not.toThrow()
    expect(readChat('guest')).toEqual({ id: null, token: null })
    expect(() => clearChatStorage('guest')).not.toThrow()
  })
})
