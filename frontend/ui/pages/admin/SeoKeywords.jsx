'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'

const muted = { fontSize: '12px', color: 'var(--dash-text-muted, #888)' }
const TOPIC_IDEAS = ['rèm dán tường', 'rèm ore chống nắng', 'rèm voan lụa', 'thanh treo rèm', 'rèm cửa phòng ngủ', 'bảng hiệu đèn LED', 'đồ gỗ trang trí nội thất']

function copy(text) {
  try {
    return navigator.clipboard.writeText(text)
  } catch {
    return Promise.resolve()
  }
}

function Chip({ text, onCopied, copied }) {
  return (
    <button
      type="button" className="dash-btn-outline" title="Bấm để chép" style={{ margin: '0 6px 6px 0', textAlign: 'left' }}
      onClick={() => copy(text).then(() => onCopied(text))}
    >
      {text}{copied === text ? ' ✓' : ''}
    </button>
  )
}

function Counter({ text, max }) {
  const over = text.length > max
  return <span style={{ ...muted, color: over ? 'var(--dash-danger)' : undefined }}>{text.length}/{max} ký tự</span>
}

const JOB_KEY = 'clevinum_seo_job' // mã việc đang chạy, để tải lại trang vẫn tiếp tục chờ được
const POLL_MS = 2000
const TIPS = [
  'Đang phân tích ý định tìm kiếm của khách (mua hàng, so sánh, tìm hiểu)…',
  'Đang nhóm từ khóa thành các cụm chủ đề…',
  'Đang tìm từ khóa dài, ít cạnh tranh…',
  'Đang soạn tiêu đề và mô tả theo chuẩn SEO…',
  'Đang nghĩ các câu hỏi khách hay gõ trên Google…',
  'Mô hình miễn phí có thể mất 30–90 giây, bạn cứ để trang mở nhé.',
]

const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

// Hiệu ứng chờ: vòng xoay + thanh chạy + đồng hồ + bước AI đang làm (lấy từ server) + câu gợi ý đổi mỗi 5 giây. Không có giới hạn thời gian.
function Waiting({ stage, elapsedMs, onCancel, cancelling }) {
  const tip = TIPS[Math.floor(elapsedMs / 5000) % TIPS.length]
  return (
    <div className="dash-card ai-wait" style={{ padding: '24px', marginBottom: '16px', textAlign: 'center' }} role="status" aria-live="polite">
      <div className="ai-spinner" aria-hidden="true" />
      <p style={{ fontWeight: 600, marginTop: '14px' }}>{stage || 'AI đang phân tích…'}</p>
      <div className="ai-bar" aria-hidden="true"><span /></div>
      <p style={{ ...muted, marginTop: '10px' }} key={tip} className="ai-tip">{tip}</p>
      <p style={{ marginTop: '10px', fontVariantNumeric: 'tabular-nums' }}>Đã chờ <strong>{mmss(elapsedMs)}</strong></p>
      <button type="button" className="dash-btn-outline" style={{ marginTop: '12px' }} onClick={onCancel} disabled={cancelling}>
        {cancelling ? 'Đang hủy…' : 'Hủy phân tích'}
      </button>
    </div>
  )
}

// Gợi ý từ khóa SEO bằng AI (OpenRouter) theo sản phẩm hoặc chủ đề. Là gợi ý chứ không phải số liệu lượt tìm thật: nên kiểm tra thêm bằng
// Google Keyword Planner / Search Console trước khi đầu tư viết nội dung.
export default function SeoKeywords() {
  const [status, setStatus] = useState(null) // { configured, model }
  const [mode, setMode] = useState('product')
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('')
  const [productId, setProductId] = useState('')
  const [topic, setTopic] = useState('')
  const [job, setJob] = useState(null) // { id, stage, startedAt (ms, theo đồng hồ trình duyệt) } khi đang phân tích
  const [elapsed, setElapsed] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [out, setOut] = useState(null)
  const [copied, setCopied] = useState('')
  const [recent, setRecent] = useState(null) // số phút trước của kết quả đang hiện (khi là kết quả cũ lấy lại từ server)
  const alive = useRef(true)
  const busy = !!job

  const clearJob = useCallback(() => {
    try { sessionStorage.removeItem(JOB_KEY) } catch {}
    setJob(null)
    setCancelling(false)
  }, [])

  // Hỏi trạng thái việc đang chạy mỗi 2 giây tới khi xong/lỗi/hủy. Mỗi lần hỏi là một yêu cầu ngắn nên không bao giờ bị cắt bởi thời gian chờ.
  useEffect(() => {
    if (!job?.id) return undefined
    let timer
    const tick = async () => {
      try {
        const v = await api.get(`/seo/jobs/${job.id}`)
        if (!alive.current) return
        if (v.status === 'running') {
          setJob((j) => (j && j.id === v.id ? { ...j, stage: v.stage, startedAt: Date.now() - v.elapsedMs } : j))
          timer = setTimeout(tick, POLL_MS)
        } else {
          if (v.status === 'done') setOut(v.data)
          else if (v.status === 'error') setError(v.error || 'Có lỗi khi phân tích.')
          clearJob()
        }
      } catch (err) {
        if (!alive.current) return
        // Mất mạng thoáng qua thì thử lại; việc không còn tồn tại (backend khởi động lại / hết hạn) thì dừng.
        if (/Không tìm thấy phân tích/.test(err.message)) { setError(err.message); clearJob() } else timer = setTimeout(tick, POLL_MS * 2)
      }
    }
    tick()
    return () => clearTimeout(timer)
  }, [job?.id, clearJob])

  // Đồng hồ đếm giờ chờ (cập nhật mỗi 0,5 giây, tính từ lúc việc bắt đầu thật trên server).
  useEffect(() => {
    if (!job) { setElapsed(0); return undefined }
    const t = setInterval(() => setElapsed(Date.now() - job.startedAt), 500)
    return () => clearInterval(t)
  }, [job])

  useEffect(() => {
    alive.current = true
    // Mở lại trang giữa lúc đang phân tích: tiếp tục chờ việc cũ. Mã việc lưu theo từng tab, nên mở tab/trình duyệt khác thì hỏi server xem
    // người này có việc đang chạy (hoặc vừa xong) không, để luôn thấy được và không bị kẹt ở thông báo "đang có một phân tích đang chạy".
    let saved = null
    try { saved = sessionStorage.getItem(JOB_KEY) } catch {}
    if (saved) setJob({ id: saved, stage: 'Đang tiếp tục phân tích…', startedAt: Date.now() })
    else {
      api.get('/seo/jobs/current').then(({ job: cur }) => {
        if (!alive.current || !cur) return
        if (cur.status === 'running') {
          try { sessionStorage.setItem(JOB_KEY, cur.id) } catch {}
          setJob({ id: cur.id, stage: cur.stage, startedAt: Date.now() - cur.elapsedMs })
        } else if (cur.status === 'done') {
          setOut(cur.data)
          setRecent(Math.round((cur.finishedAgoMs || 0) / 60000))
        }
      }).catch(() => {})
    }
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    api.get('/seo/status').then(setStatus).catch((e) => setError(e.message))
    api.get('/shop/products').then((list) => Array.isArray(list) && setProducts(list.map((p) => ({ id: p.id, name: p.name })))).catch(() => {})
  }, [])

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products).slice(0, 40)
  }, [products, filter])

  async function run(e) {
    e.preventDefault()
    setError('')
    setOut(null)
    setRecent(null)
    if (mode === 'product' && !productId) return setError('Hãy chọn một sản phẩm.')
    if (mode === 'topic' && topic.trim().length < 2) return setError('Hãy nhập chủ đề cần tìm từ khóa.')
    try {
      const v = await api.post('/seo/keywords', mode === 'product' ? { productId } : { topic: topic.trim() })
      try { sessionStorage.setItem(JOB_KEY, v.id) } catch {}
      setJob({ id: v.id, stage: v.stage, startedAt: Date.now() })
    } catch (err) {
      // Đang có một phân tích khác chạy (mở từ tab khác...): gắn vào đó để xem tiến trình / hủy, thay vì chỉ báo lỗi.
      if (err.status === 429 && err.data?.jobId) {
        try { sessionStorage.setItem(JOB_KEY, err.data.jobId) } catch {}
        setJob({ id: err.data.jobId, stage: 'Đang tiếp tục phân tích đang chạy…', startedAt: Date.now() })
        setError('Bạn đang có một phân tích chạy sẵn, đã hiển thị tiến trình bên dưới. Chờ xong hoặc bấm Hủy rồi mới bắt đầu lại.')
        return
      }
      setError(err.message)
    }
  }

  async function cancel() {
    if (!job) return
    setCancelling(true)
    try {
      await api.post(`/seo/jobs/${job.id}/cancel`, {})
    } catch {
      // không sao: vòng hỏi trạng thái sẽ tự dọn khi việc không còn
    }
    clearJob()
  }

  const onCopied = (t) => {
    setCopied(t)
    setTimeout(() => setCopied((c) => (c === t ? '' : c)), 1500)
  }
  const r = out?.result

  return (
    <AdminLayout activeNav="seo" pageTitle="Từ khóa SEO">
      {status && !status.configured && (
        <div className="dash-card" style={{ padding: '16px', marginBottom: '16px', color: 'var(--dash-danger)' }} role="alert">
          Chưa cấu hình khóa OpenRouter. Thêm <strong>OPENROUTER_API_KEY</strong> vào <code>backend/.env</code> (xem <code>backend/.env.example</code>) rồi chạy lại backend.
        </div>
      )}

      <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button type="button" className={mode === 'product' ? 'dash-btn' : 'dash-btn-outline'} onClick={() => setMode('product')}>Theo sản phẩm</button>
          <button type="button" className={mode === 'topic' ? 'dash-btn' : 'dash-btn-outline'} onClick={() => setMode('topic')}>Theo chủ đề</button>
        </div>

        <form onSubmit={run}>
          {mode === 'product' ? (
            <div className="dash-form-grid">
              <div className="dash-form-field full">
                <label>Tìm sản phẩm</label>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Gõ một phần tên sản phẩm..." />
              </div>
              <div className="dash-form-field full">
                <label>Chọn sản phẩm ({matches.length}{products.length > matches.length ? ` / ${products.length}` : ''})</label>
                <select size={6} value={productId} onChange={(e) => setProductId(e.target.value)} style={{ width: '100%' }}>
                  {matches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="dash-form-field">
              <label>Chủ đề / danh mục</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="Ví dụ: rèm dán tường cho phòng ngủ" />
              <div style={{ marginTop: '8px' }}>
                {TOPIC_IDEAS.map((t) => (
                  <button key={t} type="button" className="dash-btn-outline" style={{ margin: '0 6px 6px 0' }} onClick={() => setTopic(t)}>{t}</button>
                ))}
              </div>
            </div>
          )}
          <button className="dash-btn" disabled={busy || (status && !status.configured)} style={{ marginTop: '12px' }}>
            {busy ? 'Đang phân tích…' : 'Gợi ý từ khóa'}
          </button>
          {status?.configured && <span style={{ ...muted, marginLeft: '10px' }}>Mô hình: {status.model}</span>}
        </form>
        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '10px' }} role="alert">{error}</p>}
      </div>

      {busy && <Waiting stage={job.stage} elapsedMs={elapsed} onCancel={cancel} cancelling={cancelling} />}

      {r && (
        <>
          <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
            <strong>Kết quả cho: {out.source.name}</strong>
            {recent !== null && <span style={{ ...muted, marginLeft: '8px' }}>(kết quả phân tích gần nhất{recent > 0 ? `, ${recent} phút trước` : ', vừa xong'})</span>}
            <p style={{ ...muted, marginTop: '4px' }}>
              Đây là gợi ý của AI dựa trên cách người Việt thường tìm kiếm, <strong>không phải số lượt tìm thật</strong>. Hãy kiểm tra lại bằng Google Keyword Planner hoặc Search Console. Bấm vào từ khóa để chép.
            </p>
          </div>

          <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '10px' }}>Từ khóa chính</h3>
            <table className="dash-table">
              <thead><tr><th>Từ khóa</th><th>Ý định tìm kiếm</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {r.primary.map((k) => (
                  <tr key={k.keyword}>
                    <td><Chip text={k.keyword} copied={copied} onCopied={onCopied} /></td>
                    <td>{k.intent || '—'}</td>
                    <td style={muted}>{k.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {r.longTail.length > 0 && (
            <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '4px' }}>Từ khóa dài (dễ lên top hơn)</h3>
              <p style={{ ...muted, marginBottom: '10px' }}>Cụm từ cụ thể, ít cạnh tranh: nên dùng trong tiêu đề, mô tả và bài viết.</p>
              {r.longTail.map((k) => <Chip key={k} text={k} copied={copied} onCopied={onCopied} />)}
              <div style={{ marginTop: '6px' }}>
                <button type="button" className="dash-btn-outline" onClick={() => copy(r.longTail.join('\n')).then(() => onCopied('__all'))}>
                  Chép tất cả {copied === '__all' ? '✓' : ''}
                </button>
              </div>
            </div>
          )}

          {r.clusters?.length > 0 && (
            <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '4px' }}>Cụm chủ đề (nên viết và liên kết nội bộ với nhau)</h3>
              <p style={{ ...muted, marginBottom: '10px' }}>Mỗi cụm có một chủ đề trụ cột và các từ khóa vệ tinh; mỗi từ khóa nên có trang/bài riêng, tránh hai trang cùng nhắm một từ khóa.</p>
              {r.clusters.map((c) => (
                <div key={c.pillar} style={{ marginBottom: '10px' }}>
                  <strong>{c.pillar}</strong>
                  <div style={{ marginTop: '6px' }}>{c.keywords.map((k) => <Chip key={k} text={k} copied={copied} onCopied={onCopied} />)}</div>
                </div>
              ))}
            </div>
          )}

          {r.pageIdeas?.length > 0 && (
            <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '4px' }}>Ý tưởng trang đích</h3>
              <p style={{ ...muted, marginBottom: '10px' }}>Trang danh mục hoặc trang nội dung riêng cho từng nhu cầu tìm kiếm. Chỉ làm khi mỗi trang có nội dung riêng, không chỉ đổi tên.</p>
              <table className="dash-table">
                <thead><tr><th>Từ khóa chính</th><th>Đường dẫn gợi ý</th><th>Lý do</th></tr></thead>
                <tbody>
                  {r.pageIdeas.map((p) => (
                    <tr key={p.keyword}>
                      <td><Chip text={p.keyword} copied={copied} onCopied={onCopied} /></td>
                      <td>{p.slug ? <code>/{p.slug}</code> : '—'}</td>
                      <td style={muted}>{p.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(r.title || r.metaDescription) && (
            <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '10px' }}>Tiêu đề và mô tả đề xuất</h3>
              {r.title && (
                <p style={{ marginBottom: '10px' }}>
                  <strong>Tiêu đề:</strong> {r.title} <Counter text={r.title} max={60} />{' '}
                  <button type="button" className="dash-btn-outline" onClick={() => copy(r.title).then(() => onCopied(r.title))}>Chép {copied === r.title ? '✓' : ''}</button>
                </p>
              )}
              {r.metaDescription && (
                <p>
                  <strong>Mô tả:</strong> {r.metaDescription} <Counter text={r.metaDescription} max={155} />{' '}
                  <button type="button" className="dash-btn-outline" onClick={() => copy(r.metaDescription).then(() => onCopied(r.metaDescription))}>Chép {copied === r.metaDescription ? '✓' : ''}</button>
                </p>
              )}
            </div>
          )}

          {r.questions.length > 0 && (
            <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '4px' }}>Câu hỏi khách hay tìm</h3>
              <p style={{ ...muted, marginBottom: '10px' }}>Dùng làm câu hỏi cho mục Hỏi đáp (Cài đặt &gt; Nội dung trang) hoặc đoạn mở đầu bài viết.</p>
              <ul style={{ paddingLeft: '18px' }}>{r.questions.map((q) => <li key={q} style={{ marginBottom: '4px' }}>{q}</li>)}</ul>
            </div>
          )}

          {r.blogIdeas.length > 0 && (
            <div className="dash-card" style={{ padding: '16px' }}>
              <h3 style={{ marginBottom: '4px' }}>Ý tưởng bài viết Tin tức</h3>
              <p style={{ ...muted, marginBottom: '10px' }}>Viết trong mục Tin tức; mỗi bài nhắm một từ khóa chính.</p>
              <table className="dash-table">
                <thead><tr><th>Tiêu đề gợi ý</th><th>Từ khóa chính</th></tr></thead>
                <tbody>
                  {r.blogIdeas.map((b) => (
                    <tr key={b.title}><td>{b.title}</td><td>{b.keyword || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
