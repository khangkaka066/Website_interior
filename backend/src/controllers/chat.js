import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'

// --- Customer-facing -------------------------------------------------------

export async function startConversation(req, res) {
  const { name, phone, conversationId } = req.body || {}

  if (conversationId) {
    const existing = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (existing) return res.json(toPlain(existing))
  }

  if (!name) return res.status(400).json({ error: 'Vui lòng nhập tên của bạn.' })

  const conversation = await prisma.conversation.create({
    data: { guestName: name, guestPhone: phone || null },
  })
  res.status(201).json(toPlain(conversation))
}

export async function listMessages(req, res) {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
  if (!conversation) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' })

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ conversation: toPlain(conversation), messages: toPlain(messages) })
}

export async function postMessage(req, res) {
  const { content, sender } = req.body || {}
  if (!content || !content.trim()) return res.status(400).json({ error: 'Tin nhắn không được để trống.' })
  if (!['CUSTOMER', 'ADMIN'].includes(sender)) return res.status(400).json({ error: 'Người gửi không hợp lệ.' })

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
  if (!conversation) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' })

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        conversationId: conversation.id,
        sender,
        content: content.trim(),
        readByAdmin: sender === 'ADMIN',
        readByCustomer: sender === 'CUSTOMER',
      },
    })
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: m.createdAt, status: 'OPEN' },
    })
    return m
  })

  res.status(201).json(toPlain(message))
}

export async function markRead(req, res) {
  const { by } = req.body || {}
  if (!['admin', 'customer'].includes(by)) return res.status(400).json({ error: 'Tham số không hợp lệ.' })

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
  if (!conversation) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' })

  if (by === 'admin') {
    await prisma.message.updateMany({
      where: { conversationId: conversation.id, sender: 'CUSTOMER', readByAdmin: false },
      data: { readByAdmin: true },
    })
  } else {
    await prisma.message.updateMany({
      where: { conversationId: conversation.id, sender: 'ADMIN', readByCustomer: false },
      data: { readByCustomer: true },
    })
  }
  res.json({ ok: true })
}

// --- Admin-facing ------------------------------------------------------------

export async function listConversations(req, res) {
  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { messages: { where: { sender: 'CUSTOMER', readByAdmin: false } } } },
    },
  })

  const items = conversations.map((c) => ({
    ...toPlain(c),
    lastMessage: c.messages[0] ? toPlain(c.messages[0]) : null,
    unreadCount: c._count.messages,
    messages: undefined,
    _count: undefined,
  }))

  res.json({ items })
}

export async function closeConversation(req, res) {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
  if (!conversation) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' })

  const updated = await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'CLOSED' } })
  res.json(toPlain(updated))
}
