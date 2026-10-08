'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { formatDate } from '../../utils/format'

const EMPTY = { title: '', slug: '', excerpt: '', coverUrl: '', content: '', status: 'draft' }

// Quản lý bài viết Tin tức: danh sách + cửa sổ viết/sửa bài. Nội dung là văn bản thuần (dòng trống tách đoạn, "## " đầu dòng là tiêu đề nhỏ).
export default function NewsAdmin() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | { id?, ...fields }
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    try {
      setPosts(await api.get('/posts'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function startEdit(id) {
    setFormError('')
    if (!id) return setEditing({ ...EMPTY })
    try {
      const p = await api.get(`/posts/${id}`)
      setEditing({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt || '', coverUrl: p.coverUrl || '', content: p.content || '', status: p.status })
    } catch (err) {
      setError(err.message)
    }
  }

  async function save(statusOverride) {
    const f = { ...editing, status: statusOverride || editing.status }
    if (!f.title.trim()) return setFormError('Vui lòng nhập tiêu đề.')
    setSaving(true)
    setFormError('')
    try {
      const body = { title: f.title.trim(), excerpt: f.excerpt, content: f.content, coverUrl: f.coverUrl.trim(), status: f.status }
      if (f.slug.trim()) body.slug = f.slug.trim()
      if (f.id) await api.patch(`/posts/${f.id}`, body)
      else await api.post('/posts', body)
      setEditing(null)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(p) {
    try {
      await api.patch(`/posts/${p.id}`, { status: p.status === 'published' ? 'draft' : 'published' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/posts/${id}`)
      setConfirmDelete(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const set = (k) => (e) => setEditing((f) => ({ ...f, [k]: e.target.value }))

  return (
    <AdminLayout
      activeNav="news"
      pageTitle="Tin tức"
      headerActions={
        <button className="dash-btn" onClick={() => startEdit(null)}>
          + Viết bài
        </button>
      }
    >
      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--dash-danger)', marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : posts.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Chưa có bài viết nào. Bấm “+ Viết bài” để đăng bài đầu tiên.</p>
        </div>
      ) : (
        <div className="dash-card dash-card-wide">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Trạng thái</th>
                <th>Ngày đăng</th>
                <th>Cập nhật</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--dash-text-muted, #888)' }}>/news/{p.slug}</div>
                  </td>
                  <td>
                    <span className={`order-status-badge ${p.status === 'published' ? 'status-delivered' : 'status-pending'}`}>
                      {p.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                    </span>
                  </td>
                  <td>{formatDate(p.publishedAt)}</td>
                  <td>{formatDate(p.updatedAt)}</td>
                  <td>
                    <button className="dash-btn-outline" onClick={() => startEdit(p.id)}>Sửa</button>{' '}
                    {p.status === 'published' && (
                      <a className="dash-btn-outline" href={`/news/${p.slug}`} target="_blank" rel="noreferrer">Xem</a>
                    )}{' '}
                    <button className="dash-btn-outline" onClick={() => toggle(p)}>{p.status === 'published' ? 'Gỡ xuống' : 'Đăng'}</button>{' '}
                    {confirmDelete === p.id ? (
                      <>
                        <button className="dash-btn" onClick={() => remove(p.id)}>Xác nhận xóa</button>{' '}
                        <button className="dash-btn-outline" onClick={() => setConfirmDelete(null)}>Hủy</button>
                      </>
                    ) : (
                      <button className="dash-btn-outline" onClick={() => setConfirmDelete(p.id)}>Xóa</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="dash-modal-overlay" onClick={() => !saving && setEditing(null)}>
          <div className="dash-modal" style={{ maxWidth: '760px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-head">
              <h3>{editing.id ? 'Sửa bài viết' : 'Viết bài mới'}</h3>
              <button className="dash-modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>

            <div className="dash-form-grid">
              <div className="dash-form-field full">
                <label>Tiêu đề *</label>
                <input value={editing.title} onChange={set('title')} maxLength={200} />
              </div>
              <div className="dash-form-field full">
                <label>Đường dẫn (tự tạo từ tiêu đề nếu để trống)</label>
                <input value={editing.slug} onChange={set('slug')} maxLength={80} placeholder="meo-chon-rem-cho-phong-ngu" />
              </div>
              <div className="dash-form-field full">
                <label>Mô tả ngắn (hiện ở danh sách và khi chia sẻ)</label>
                <textarea rows={2} value={editing.excerpt} onChange={set('excerpt')} maxLength={400} />
              </div>
              <div className="dash-form-field full">
                <label>Ảnh bìa (địa chỉ ảnh https://…)</label>
                <input value={editing.coverUrl} onChange={set('coverUrl')} placeholder="https://…" />
              </div>
              <div className="dash-form-field full">
                <label>Nội dung (dòng trống để xuống đoạn; bắt đầu dòng bằng “## ” để tạo tiêu đề nhỏ)</label>
                <textarea rows={14} value={editing.content} onChange={set('content')} />
              </div>
            </div>

            {formError && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '10px' }}>{formError}</p>}

            <div className="dash-modal-actions">
              <button className="dash-btn dash-btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Hủy</button>
              <button className="dash-btn-outline" onClick={() => save('draft')} disabled={saving}>Lưu bản nháp</button>
              <button className="dash-btn" onClick={() => save('published')} disabled={saving}>
                {saving ? 'Đang lưu...' : editing.id && editing.status === 'published' ? 'Lưu & cập nhật' : 'Đăng bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
