import { z } from 'zod'
import { text, optionalText } from './common.js'

export const startConversationSchema = z
  .object({
    name: optionalText('tên', 100),
    phone: optionalText('số điện thoại', 20),
    conversationId: optionalText('mã cuộc trò chuyện', 100),
  })
  .refine((d) => d.conversationId || d.name, { message: 'Vui lòng nhập tên của bạn.', path: ['name'] })

export const messageSchema = z.object({
  content: text('tin nhắn', 2000),
})
