import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'

const STORAGE_KEY = 'clevinum_chat_conversation_id'
const SEEN_KEY = 'clevinum_chat_last_seen'
const POLL_MS = 5000

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [messages, setMessages] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [draft, setDraft] = useState('')
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [hasUnread, setHasUnread] = useState(false)
  const scrollRef = useRef(null)

  const load = useCallback(async () => {
    if (!conversationId) return
    try {
      const data = await api.get(`/chat/conversations/${conversationId}/messages`)
      setMessages(data.messages)

      const lastAdminMsg = [...data.messages].reverse().find((m) => m.sender === 'ADMIN')
      const lastSeen = localStorage.getItem(SEEN_KEY)
      if (lastAdminMsg && lastAdminMsg.id !== lastSeen) {
        setHasUnread(!open)
      }
    } catch {
      // Backend offline — fail silently, widget just stays quiet.
    }
  }, [conversationId, open])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => {
    if (open && messages.length > 0) {
      const lastAdminMsg = [...messages].reverse().find((m) => m.sender === 'ADMIN')
      if (lastAdminMsg) localStorage.setItem(SEEN_KEY, lastAdminMsg.id)
      setHasUnread(false)
    }
  }, [open, messages])

  async function handleStart() {
    if (!name.trim()) {
      setError('Vui lòng nhập tên của bạn.')
      return
    }
    setStarting(true)
    setError('')
    try {
      const conv = await api.post('/chat/conversations', { name: name.trim(), phone: phone.trim() })
      localStorage.setItem(STORAGE_KEY, conv.id)
      setConversationId(conv.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  async function handleSend() {
    if (!draft.trim() || !conversationId) return
    setSending(true)
    const content = draft.trim()
    setDraft('')
    try {
      await api.post(`/chat/conversations/${conversationId}/messages`, { content, sender: 'CUSTOMER' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-panel-head">
            <div>
              <strong>Clevinum hỗ trợ</strong>
              <span>Thường phản hồi trong vài phút</span>
            </div>
            <button className="chat-panel-close" onClick={() => setOpen(false)} aria-label="Đóng chat">
              ✕
            </button>
          </div>

          {!conversationId ? (
            <div className="chat-intake">
              <p>Để lại thông tin để đội ngũ Clevinum hỗ trợ bạn nhanh nhất.</p>
              <input
                className="chat-input"
                placeholder="Tên của bạn *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="chat-input"
                placeholder="Số điện thoại (không bắt buộc)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {error && <p className="chat-error">{error}</p>}
              <button className="btn btn-accent chat-start-btn" onClick={handleStart} disabled={starting}>
                {starting ? 'Đang kết nối...' : 'Bắt đầu trò chuyện'}
              </button>
            </div>
          ) : (
            <>
              <div className="chat-messages" ref={scrollRef}>
                {messages.length === 0 ? (
                  <p className="chat-empty">Gửi tin nhắn đầu tiên cho chúng tôi nhé!</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`chat-bubble ${m.sender === 'CUSTOMER' ? 'chat-bubble-me' : 'chat-bubble-admin'}`}>
                      {m.content}
                    </div>
                  ))
                )}
              </div>
              {error && <p className="chat-error">{error}</p>}
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  placeholder="Nhập tin nhắn..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="btn btn-accent" onClick={handleSend} disabled={sending || !draft.trim()}>
                  Gửi
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button className="chat-bubble-btn" onClick={() => setOpen((o) => !o)} aria-label="Mở chat hỗ trợ">
        {hasUnread && <span className="chat-unread-dot" />}
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}
