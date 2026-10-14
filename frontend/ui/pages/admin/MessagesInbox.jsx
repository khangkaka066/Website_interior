'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { formatDateTime, formatCurrency } from '../../utils/format'
import { openEventStream } from '../../utils/eventStream'
import LinkifiedText from '../../components/LinkifiedText'

const FALLBACK_POLL_MS = 30000 // dự phòng; cập nhật chính đến qua luồng thời gian thực

// Bỏ dấu + hạ chữ thường để tìm "rem" ra cả "Rèm".
const fold = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
const productLink = (id) => `${window.location.origin}/products/${encodeURIComponent(id)}`

// Tin nhắn mẫu có sẵn. {ten} được thay bằng tên khách. Nhân viên có thể lưu thêm mẫu riêng (lưu trong trình duyệt này).
const DEFAULT_REPLIES = [
  { id: 'd1', label: 'Chào khách', text: 'Chào {ten}, em có thể hỗ trợ gì cho mình ạ?' },
  { id: 'd2', label: 'Hỏi nhu cầu', text: 'Anh/chị cho em biết kích thước cửa, vị trí lắp đặt và màu sắc mong muốn để em tư vấn mẫu phù hợp nhé ạ.' },
  { id: 'd3', label: 'Xin số điện thoại', text: 'Anh/chị để lại số điện thoại để bên em gọi tư vấn và báo giá chi tiết nhanh hơn nhé ạ.' },
  { id: 'd4', label: 'Xin địa chỉ', text: 'Anh/chị cho em xin địa chỉ nhận hàng để em kiểm tra phí vận chuyển giúp mình nhé ạ.' },
  { id: 'd5', label: 'Chờ chút', text: 'Anh/chị vui lòng đợi em ít phút để kiểm tra giúp mình nhé ạ.' },
  { id: 'd6', label: 'Cảm ơn', text: 'Cảm ơn anh/chị đã quan tâm. Cần hỗ trợ thêm anh/chị cứ nhắn cho em nhé ạ!' },
]
const REPLIES_KEY = 'clevinum_quick_replies'

function loadCustomReplies() {
  try {
    const list = JSON.parse(localStorage.getItem(REPLIES_KEY) || '[]')
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string' && typeof r.text === 'string') : []
  } catch {
    return []
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Trình duyệt chặn clipboard (http, không phải localhost): dùng cách cũ.
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    el.remove()
  }
}

export default function MessagesInbox() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)
  const draftRef = useRef(null)
  const [products, setProducts] = useState([])
  const [productQuery, setProductQuery] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [customReplies, setCustomReplies] = useState([])

  useEffect(() => setCustomReplies(loadCustomReplies()), [])

  function saveCustomReplies(list) {
    setCustomReplies(list)
    try {
      localStorage.setItem(REPLIES_KEY, JSON.stringify(list))
    } catch {
      // trình duyệt chặn lưu: mẫu vẫn dùng được trong phiên này
    }
  }

  // Chèn mẫu vào ô soạn (không tự gửi) để nhân viên chỉnh lại trước khi gửi.
  function applyReply(r) {
    const text = r.text.replaceAll('{ten}', active?.guestName || 'anh/chị')
    setDraft((d) => (d.trim() ? `${d.trimEnd()}\n${text}` : text))
    draftRef.current?.focus()
  }

  function saveDraftAsReply() {
    const text = draft.trim()
    if (!text || customReplies.some((r) => r.text === text)) return
    saveCustomReplies([...customReplies, { id: `c${Date.now()}`, label: text.length > 22 ? `${text.slice(0, 22)}…` : text, text }])
  }

  useEffect(() => {
    api.get('/shop/products').then(setProducts).catch(() => {})
  }, [])

  const shownProducts = (() => {
    const q = fold(productQuery).trim()
    const list = q ? products.filter((p) => fold(`${p.name} ${p.sku || ''} ${p.id}`).includes(q)) : products
    return list.slice(0, 50)
  })()

  async function handleCopy(p) {
    await copyText(productLink(p.id))
    setCopiedId(p.id)
    setTimeout(() => setCopiedId((cur) => (cur === p.id ? null : cur)), 1500)
  }

  // Chèn "Tên sản phẩm + link" vào ô trả lời để gửi luôn.
  function handleInsert(p) {
    setDraft((d) => `${d}${d && !d.endsWith('\n') ? '\n' : ''}${p.name}: ${productLink(p.id)}`)
    draftRef.current?.focus()
  }

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
    const id = setInterval(loadConversations, FALLBACK_POLL_MS)
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
    const id = setInterval(loadThread, FALLBACK_POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Thời gian thực: khách nhắn là danh sách và cuộc trò chuyện đang mở cập nhật ngay.
  const live = useRef({})
  live.current = { activeId, loadConversations, loadThread }
  useEffect(
    () =>
      openEventStream('/chat/stream', (ev) => {
        const { activeId: open, loadConversations: reloadList, loadThread: reloadThread } = live.current
        reloadList()
        if (ev.type === 'open' || ev.conversationId === open) {
          reloadThread()
          // Đang xem đúng cuộc trò chuyện có tin mới của khách: đánh dấu đã đọc để không hiện chưa đọc.
          if (open && ev.type === 'message' && ev.sender === 'CUSTOMER' && ev.conversationId === open) {
            api.post(`/chat/conversations/${open}/read`, { by: 'admin' }).then(reloadList)
          }
        }
      }),
    [],
  )

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function handleSend() {
    if (!draft.trim() || !activeId) return
    setSending(true)
    const content = draft.trim()
    setDraft('')
    try {
      await api.post(`/chat/conversations/${activeId}/admin-messages`, { content })
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
                    <LinkifiedText text={m.content} />
                  </div>
                ))}
              </div>

              <div className="msg-quick-replies">
                {[...DEFAULT_REPLIES, ...customReplies].map((r) => (
                  <span key={r.id} className="msg-quick-chip">
                    <button type="button" title={r.text} onClick={() => applyReply(r)}>{r.label}</button>
                    {r.id.startsWith('c') && (
                      <button type="button" className="msg-quick-del" aria-label={`Xóa mẫu ${r.label}`} onClick={() => saveCustomReplies(customReplies.filter((x) => x.id !== r.id))}>×</button>
                    )}
                  </span>
                ))}
                <button type="button" className="msg-quick-save" onClick={saveDraftAsReply} disabled={!draft.trim()} title="Lưu nội dung đang soạn thành mẫu">
                  + Lưu câu đang soạn
                </button>
              </div>

              <div className="msg-thread-input">
                <textarea
                  ref={draftRef}
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

        <aside className="msg-products">
          <div className="msg-products-head">
            <strong>Link sản phẩm</strong>
            <input
              type="search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Tìm tên / mã sản phẩm..."
            />
          </div>
          <div className="msg-products-list">
            {shownProducts.length === 0 ? (
              <p className="dash-empty-state" style={{ padding: '16px' }}>{products.length ? 'Không có sản phẩm khớp.' : 'Đang tải...'}</p>
            ) : (
              shownProducts.map((p) => (
                <div key={p.id} className="msg-product">
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="msg-product-noimg" />}
                  <div className="msg-product-info">
                    <span className="msg-product-name" title={p.name}>{p.name}</span>
                    <span className="msg-product-price">{formatCurrency(p.price)}</span>
                    <div className="msg-product-actions">
                      <button type="button" onClick={() => handleCopy(p)}>{copiedId === p.id ? 'Đã copy ✓' : 'Copy link'}</button>
                      {active && <button type="button" onClick={() => handleInsert(p)}>Chèn vào chat</button>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
