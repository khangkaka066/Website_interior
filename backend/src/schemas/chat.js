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
