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

const router = Router()

// Admin inbox (order matters: /conversations before /conversations/:id).
router.get('/conversations', asyncHandler(listConversations))
router.post('/conversations', asyncHandler(startConversation))
router.get('/conversations/:id/messages', asyncHandler(listMessages))
router.post('/conversations/:id/messages', asyncHandler(postMessage))
router.post('/conversations/:id/read', asyncHandler(markRead))
router.post('/conversations/:id/close', asyncHandler(closeConversation))

export default router
