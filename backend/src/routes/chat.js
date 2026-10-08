import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  startConversation,
  listMessages,
  postCustomerMessage,
  postAdminMessage,
  markRead,
  listConversations,
  closeConversation,
  customerStream,
  adminStream,
} from '../controllers/chat.js'
import { requirePermission } from '../middleware/auth.js'
import { chatLimiter } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import { startConversationSchema, messageSchema } from '../schemas/chat.js'

const router = Router()
const guard = requirePermission('messages')

// Public — the storefront chat widget has no login and needs these to work
// for anonymous guests. Only the admin inbox list, read receipts and close
// action expose other customers' data and need the "messages" permission.
router.post('/conversations', chatLimiter, validate(startConversationSchema), asyncHandler(startConversation))
router.get('/conversations/:id/messages', asyncHandler(listMessages))
router.get('/conversations/:id/stream', asyncHandler(customerStream))
router.post('/conversations/:id/messages', chatLimiter, validate(messageSchema), asyncHandler(postCustomerMessage))

// Admin inbox (order matters: /conversations before /conversations/:id).
router.get('/stream', guard, asyncHandler(adminStream))
router.get('/conversations', guard, asyncHandler(listConversations))
router.post('/conversations/:id/admin-messages', guard, validate(messageSchema), asyncHandler(postAdminMessage))
router.post('/conversations/:id/read', guard, asyncHandler(markRead))
router.post('/conversations/:id/close', guard, asyncHandler(closeConversation))

export default router
