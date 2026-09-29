import { useState, useEffect, useCallback, useRef } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { formatDateTime } from '../../utils/format'

const LIST_POLL_MS = 5000
const THREAD_POLL_MS = 3000

export default function MessagesInbox() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get('/chat/conversations')
      setConversations(data.items)
      if (!activeId && data.items.length > 0) setActiveId(data.items[0].id)
    } finally {
      setLoading(false)
    }
  }, [activeId])

  useEffect(() => {
    loadConversations()
    const id = setInterval(loadConversations, LIST_POLL_MS)
    return () => clearInterval(id)
  }, [loadConversations])

  const loadThread = useCallback(async () => {
    if (!activeId) return
    const data = await api.get(`/chat/conversations/${activeId}/messages`)
    setMessages(data.messages)
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    loadThread()
    api.post(`/chat/conversations/${activeId}/read`, { by: 'admin' }).then(loadConversations)
    const id = setInterval(loadThread, THREAD_POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function handleSend() {
    if (!draft.trim() || !activeId) return
    setSending(true)
    const content = draft.trim()
    setDraft('')
    try {
      await api.post(`/chat/conversations/${activeId}/messages`, { content, sender: 'ADMIN' })
      await loadThread()
    } finally {
      setSending(false)
    }
  }

  const active = conversations.find((c) => c.id === activeId)

  return (
    <AdminLayout activeNav="messages" pageTitle="Tin nhắn">
      <div className="msg-layout">
        <div className="msg-list">
          {loading ? (
            <p className="dash-empty-state" style={{ padding: '20px' }}>Đang tải...</p>
          ) : conversations.length === 0 ? (
            <p className="dash-empty-state" style={{ padding: '20px' }}>Chưa có cuộc trò chuyện nào.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`msg-list-item ${activeId === c.id ? 'msg-list-item-active' : ''}`}
                onClick={() => setActiveId(c.id)}
              >
                <div className="msg-list-item-top">
                  <strong>{c.guestName}</strong>
                  {c.unreadCount > 0 && <span className="dash-nav-badge">{c.unreadCount}</span>}
                </div>
                <span className="msg-list-preview">{c.lastMessage?.content || 'Chưa có tin nhắn'}</span>
                <span className="msg-list-time">{formatDateTime(c.lastMessageAt)}</span>
              </button>
            ))
          )}
        </div>

        <div className="msg-thread">
          {!active ? (
            <div className="msg-thread-empty">Chọn một cuộc trò chuyện để xem</div>
          ) : (
            <>
              <div className="msg-thread-head">
                <div>
                  <strong>{active.guestName}</strong>
                  {active.guestPhone && <span> · {active.guestPhone}</span>}
                </div>
                <span className={`order-status-badge ${active.status === 'OPEN' ? 'status-delivered' : 'status-cancelled'}`}>
                  {active.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                </span>
              </div>

              <div className="msg-thread-body" ref={scrollRef}>
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble ${m.sender === 'ADMIN' ? 'chat-bubble-me' : 'chat-bubble-admin'}`}>
                    {m.content}
                  </div>
                ))}
              </div>

              <div className="msg-thread-input">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Nhập câu trả lời..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <button className="dash-btn" onClick={handleSend} disabled={sending || !draft.trim()}>
                  Gửi
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
