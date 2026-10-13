import { createHmac, timingSafeEqual } from 'node:crypto'

// Token bí mật của khách cho từng cuộc trò chuyện (giống "thẻ từ": biết số phòng mà không có thẻ thì không vào được).
// Tính bằng HMAC-SHA256 từ mã cuộc trò chuyện + JWT_SECRET nên không cần lưu thêm gì trong database và không đoán được.
// Chỉ khách (trình duyệt đã tạo cuộc trò chuyện) giữ token; admin vào bằng quyền "messages" như cũ.
export const CHAT_TOKEN_HEADER = 'x-chat-token'

// Cuộc trò chuyện tạo trước thời điểm này chưa có token. Cho chúng vẫn truy cập bằng mã cũ (và được cấp token khi vào lại)
// để khách đang chat không mất lịch sử. Đặt CHAT_LEGACY_ACCESS=off khi đã qua đủ lâu để tắt hẳn đường cũ.
const LEGACY_BEFORE = new Date(process.env.CHAT_TOKEN_SINCE || '2026-10-13T02:01:35Z')

function secret() {
  const key = process.env.JWT_SECRET
  if (key) return key
  // Production đã bắt buộc có JWT_SECRET khi khởi động (index.js); khóa cố định này chỉ để chạy dev/test.
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET chưa cấu hình')
  return 'dev-only-chat-secret'
}

export function chatTokenFor(conversationId) {
  return createHmac('sha256', secret()).update(`chat-conversation:${conversationId}`).digest('base64url')
}

export function isValidChatToken(conversationId, token) {
  if (typeof token !== 'string' || !token) return false
  const expected = Buffer.from(chatTokenFor(conversationId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function isLegacyConversation(conversation) {
  return process.env.CHAT_LEGACY_ACCESS !== 'off' && conversation.createdAt < LEGACY_BEFORE
}

// Khách có được xem / gửi tin trong cuộc trò chuyện này không.
export function canAccessConversation(conversation, token) {
  return isValidChatToken(conversation.id, token) || isLegacyConversation(conversation)
}
