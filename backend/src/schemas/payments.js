import { z } from 'zod'
import { optionalText, text } from './common.js'

export const confirmPaymentSchema = z.object({
  transactionId: optionalText('mã giao dịch', 100),
  note: optionalText('ghi chú', 300),
})
export const failPaymentSchema = z.object({ note: text('lý do', 300) })
export const refundPaymentSchema = z.object({ note: text('lý do hoàn tiền', 300) })
