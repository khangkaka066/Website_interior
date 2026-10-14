import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { publishChat, openStream, ADMIN_CHANNEL, customerChannel } from '../lib/chatEvents.js'
import { CHAT_TOKEN_HEADER, chatTokenFor, isValidChatToken, canAccessConversation } from '../lib/chatToken.js'

// --- Customer-facing -------------------------------------------------------

export async function startConversation(req, res) {
  const { name, phone } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Vui lòng nhập tên của bạn.' })

  // Đang đăng nhập bằng tài khoản khách đã có hồ sơ: gắn cuộc trò chuyện vào hồ sơ để đăng nhập lại (kể cả máy khác) lấy lại được lịch sử.
  // customerId lấy từ phiên đăng nhập ở máy chủ, không nhận từ client.
  const customerId = req.user?.role === 'CUSTOMER' && req.user.customerId ? req.user.customerId : null
  const conversation = await prisma.conversation.create({
    data: { guestName: name, guestPhone: phone || null, ...(customerId && { customerId }) },
  })
  publishChat(conversation.id, { type: 'conversation' }) // admin thấy cuộc trò chuyện mới ngay
  // `token` chỉ được trả đúng lúc này: trình duyệt giữ nó và gửi kèm (header X-Chat-Token) mỗi lần đọc / gửi tin.
  res.status(201).json({ ...toPlain(conversation), token: chatTokenFor(conversation.id) })
}

// Cuộc trò chuyện gần nhất của tài khoản đang đăng nhập (kèm token để mở lại ở trình duyệt này). Dữ liệu theo tài khoản ở máy chủ là nguồn đúng:
// đổi tài khoản trên cùng trình duyệt thì khung chat nạp lại từ đây, không dùng dữ liệu của tài khoản trước.
export async function myConversation(req, res) {
  res.set('Cache-Control', 'no-store')
  const customerId = req.user?.role === 'CUSTOMER' ? req.user.customerId : null
  if (!customerId) return res.json({ conversation: null })
  const conversation = await prisma.conversation.findFirst({ where: { customerId, status: 'OPEN' }, orderBy: { lastMessageAt: 'desc' } })
  if (!conversation) return res.json({ conversation: null })
  const messages = await prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' } })
  res.json({ conversation: toPlain(conversation), token: chatTokenFor(conversation.id), messages: toPlain(messages) })
}

// Lấy cuộc trò chuyện cho khách nếu mã và token khớp. Sai token và không tìm thấy trả cùng một lỗi 404
// để người ngoài không dò được mã nào có thật.
async function loadCustomerConversation(req, res) {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
  if (!conversation || !canAccessConversation(conversation, req.get(CHAT_TOKEN_HEADER))) {
    res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' })
    return null
  }
  return conversation
}

export async function listMessages(req, res) {
  const conversation = await loadCustomerConversation(req, res)
  if (!conversation) return

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  })
  const body = { conversation: toPlain(conversation), messages: toPlain(messages) }
  // Cuộc trò chuyện cũ (tạo trước khi có token) vào bằng mã: cấp token để trình duyệt chuyển sang dùng token.
  if (!isValidChatToken(conversation.id, req.get(CHAT_TOKEN_HEADER))) body.token = chatTokenFor(conversation.id)
  res.json(body)
}

// Route công khai: người gửi luôn là CUSTOMER, bỏ qua `sender` client gửi lên.
export async function postCustomerMessage(req, res) {
  const conversation = await loadCustomerConversation(req, res)
  if (!conversation) return
  return createMessage(req, res, 'CUSTOMER', conversation)
}

// Route có quyền "messages": người gửi luôn là ADMIN.
export function postAdminMessage(req, res) {
  return createMessage(req, res, 'ADMIN')
}

async function createMessage(req, res, sender, preloaded) {
  const { content } = req.body || {}
  if (!content || !content.trim()) return res.status(400).json({ error: 'Tin nhắn không được để trống.' })
  if (content.length > 2000) return res.status(400).json({ error: 'Tin nhắn quá dài.' })

  const conversation = preloaded || (await prisma.conversation.findUnique({ where: { id: req.params.id } }))
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

  publishChat(conversation.id, { type: 'message', sender })
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
  publishChat(conversation.id, { type: 'read', by })
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
  publishChat(conversation.id, { type: 'closed' })
  res.json(toPlain(updated))
}

// --- Thời gian thực (SSE) -----------------------------------------------------------------------

// Khách theo dõi cuộc trò chuyện của mình (cần mã + token, giống như API lấy tin nhắn).
export async function customerStream(req, res) {
  const conversation = await loadCustomerConversation(req, res)
  if (!conversation) return
  if (!openStream(req, res, customerChannel(conversation.id))) {
    return res.status(429).json({ error: 'Quá nhiều kết nối, vui lòng thử lại sau.' })
  }
}

// Admin (quyền "messages") theo dõi mọi cuộc trò chuyện.
export function adminStream(req, res) {
  if (!openStream(req, res, ADMIN_CHANNEL)) return res.status(429).json({ error: 'Quá nhiều kết nối, vui lòng thử lại sau.' })
}

// --- Câu trả lời nhanh (dùng chung cho nhân viên có quyền "messages") ---------

const MAX_QUICK_REPLIES = 50
const quickReplyView = ({ id, label, text }) => ({ id, label, text })

export async function listQuickReplies(req, res) {
  const rows = await prisma.quickReply.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  res.json({ items: rows.map(quickReplyView) })
}

export async function createQuickReply(req, res) {
  if ((await prisma.quickReply.count()) >= MAX_QUICK_REPLIES) {
    return res.status(400).json({ error: `Tối đa ${MAX_QUICK_REPLIES} câu trả lời nhanh, hãy xóa bớt câu cũ.` })
  }
  const last = await prisma.quickReply.aggregate({ _max: { position: true } })
  const row = await prisma.quickReply.create({ data: { ...req.body, position: (last._max.position ?? 0) + 1 } })
  res.status(201).json(quickReplyView(row))
}

export async function updateQuickReply(req, res) {
  const row = await prisma.quickReply.update({ where: { id: req.params.id }, data: req.body }).catch((e) => (e.code === 'P2025' ? null : Promise.reject(e)))
  if (!row) return res.status(404).json({ error: 'Không tìm thấy câu trả lời.' })
  res.json(quickReplyView(row))
}

export async function deleteQuickReply(req, res) {
  const { count } = await prisma.quickReply.deleteMany({ where: { id: req.params.id } })
  if (!count) return res.status(404).json({ error: 'Không tìm thấy câu trả lời.' })
  res.json({ ok: true })
}
