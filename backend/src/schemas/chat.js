import { z } from 'zod'
import { text, optionalText } from './common.js'

export const startConversationSchema = z
  .object({
    name: optionalText('tên', 100),
    phone: optionalText('số điện thoại', 20),
  })
  .refine((d) => d.name, { message: 'Vui lòng nhập tên của bạn.', path: ['name'] })

export const messageSchema = z.object({
  content: text('tin nhắn', 2000),
})

export const quickReplySchema = z.object({
  label: text('tên nút', 40),
  text: text('nội dung câu trả lời', 2000),
})
