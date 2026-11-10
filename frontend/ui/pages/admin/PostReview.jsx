'use client'

import { useState } from 'react'
import PostBody from '@/components/site/PostBody'
import { buildChecklist } from './postChecklist'

const ICON = { pass: '✔', warn: '!', fail: '✕' }
const COLOR = { pass: 'var(--dash-success, #1a7f37)', warn: '#b7791f', fail: 'var(--dash-danger)' }
const CATEGORY = {
  content_quality: 'Nội dung',
  seo_optimization: 'SEO',
  eeat_signals: 'Uy tín (E-E-A-T)',
  technical_elements: 'Kỹ thuật',
  ai_citation_readiness: 'Sẵn sàng cho AI trích dẫn',
}
const SEVERITY = { high: 'Cao', medium: 'Vừa', low: 'Thấp', critical: 'Nghiêm trọng' }

// Danh sách các mục checklist: ✔ đạt, ! gợi ý (không chặn đăng), ✕ chưa đạt.
export function ChecklistList({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '6px', fontSize: '13px' }}>
      {items.map((i) => (
        <li key={i.id} style={{ display: 'flex', gap: '8px' }}>
          <span aria-label={i.status} style={{ color: COLOR[i.status], fontWeight: 700, width: '14px' }}>{ICON[i.status]}</span>
          <span>{i.label}{i.detail && <span style={{ color: '#888' }}> — {i.detail}</span>}</span>
        </li>
      ))}
    </ul>
  )
}

// Cửa sổ duyệt bài: đọc bài như trên website, xem điểm do công cụ chấm (nếu có), checklist SEO, rồi Chấp nhận (đăng) hoặc Từ chối.
export default function PostReview({ post, busy, error, onAccept, onReject, onClose }) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const check = buildChecklist(post)
  const report = post.seoReport

  return (
    <div className="dash-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="dash-modal" style={{ maxWidth: '1100px', width: '100%', maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3>Duyệt bài: {post.title}</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
          <article style={{ minWidth: 0 }}>
            <p style={{ fontSize: '12px', color: '#888' }}>/tin-tuc/{post.slug}</p>
            {post.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.coverUrl} alt="" style={{ maxWidth: '100%', borderRadius: '8px', margin: '8px 0' }} />
            )}
            <p style={{ fontStyle: 'italic', margin: '8px 0 16px' }}>{post.excerpt}</p>
            <PostBody content={post.content} />
          </article>

          <aside style={{ display: 'grid', gap: '16px', alignContent: 'start' }}>
            <section className="dash-card" style={{ padding: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Điểm do công cụ chấm</h4>
              {report ? (
                <>
                  <p style={{ fontSize: '32px', fontWeight: 700 }}>
                    {report.total}<span style={{ fontSize: '16px', fontWeight: 400 }}>/100</span>
                    {report.rating && <span style={{ fontSize: '14px', marginLeft: '8px' }}>({report.rating})</span>}
                  </p>
                  {report.categories && (
                    <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px' }}>
                      {Object.entries(report.categories).map(([k, v]) => (
                        <li key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{CATEGORY[k] || k}</span><strong>{v}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  {report.issues?.length > 0 && (
                    <details style={{ marginTop: '8px', fontSize: '13px' }}>
                      <summary>{report.issues.length} điểm cần cải thiện</summary>
                      <ul style={{ paddingLeft: '18px' }}>
                        {report.issues.map((i, k) => (
                          <li key={k}>[{SEVERITY[i.severity] || i.severity}] {i.issue}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                    Điểm nội bộ để ưu tiên chỉnh sửa, không phải xác suất lên top. {report.tool}{report.measuredAt ? `, đo ${report.measuredAt}` : ''}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: '13px', color: '#888' }}>Bài này chưa có điểm từ công cụ chấm. Xem checklist bên dưới.</p>
              )}
            </section>

            <section className="dash-card" style={{ padding: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Checklist SEO ({check.passed}/{check.total} đạt)</h4>
              <ChecklistList items={check.items} />
              <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>Ngưỡng là quy ước biên tập của shop, mục “!” chỉ là gợi ý.</p>
            </section>
          </aside>
        </div>

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '10px' }}>{error}</p>}

        {rejecting && (
          <div className="dash-form-field full" style={{ marginTop: '12px' }}>
            <label>Lý do từ chối (không bắt buộc)</label>
            <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}

        <div className="dash-modal-actions">
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
          {rejecting ? (
            <>
              <button className="dash-btn-outline" onClick={() => setRejecting(false)} disabled={busy}>Quay lại</button>
              <button className="dash-btn" onClick={() => onReject(reason)} disabled={busy}>{busy ? 'Đang lưu...' : 'Xác nhận từ chối'}</button>
            </>
          ) : (
            <>
              <button className="dash-btn-outline" onClick={() => setRejecting(true)} disabled={busy}>Từ chối</button>
              <button className="dash-btn" onClick={onAccept} disabled={busy}>{busy ? 'Đang lưu...' : 'Chấp nhận & đăng'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
