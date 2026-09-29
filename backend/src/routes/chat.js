import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  startConversation,
  listMessages,
  postMessage,
  markRead,
  listConversations,
  closeConversation,
} from '../controllers/chat.js'
import { requirePermission } from '../middleware/auth.js'

const router = Router()
const guard = requirePermission('messages')

// Public — the storefront chat widget has no login and needs these to work
// for anonymous guests. Only the admin inbox list, read receipts and close
// action expose other customers' data and need the "messages" permission.
router.post('/conversations', asyncHandler(startConversation))
router.get('/conversations/:id/messages', asyncHandler(listMessages))
router.post('/conversations/:id/messages', asyncHandler(postMessage))

// Admin inbox (order matters: /conversations before /conversations/:id).
router.get('/conversations', guard, asyncHandler(listConversations))
router.post('/conversations/:id/read', guard, asyncHandler(markRead))
router.post('/conversations/:id/close', guard, asyncHandler(closeConversation))

export default router
