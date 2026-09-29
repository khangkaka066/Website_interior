import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { getSession } from '../../auth'
import { formatDateTime } from '../../utils/format'

const ROLE_LABEL = {
  CUSTOMER: { label: 'Khách hàng', cls: 'status-pending' },
  ADMIN: { label: 'Quản trị', cls: 'status-delivered' },
}
const ADMIN_ROLE_LABEL = {
  MAIN_ADMIN: { label: 'Main Admin', cls: 'status-delivered' },
  SUPPORT_ADMIN: { label: 'Support Admin', cls: 'status-processing' },
}

export default function AccountsAdmin() {
  const session = getSession()
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editRole, setEditRole] = useState('CUSTOMER')
  const [editAdminRole, setEditAdminRole] = useState('SUPPORT_ADMIN')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      const data = await api.get(`/users?${params.toString()}`)
      setUsers(data.items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  const loadPermissions = useCallback(async () => {
    const data = await api.get('/permissions')
    setPermissions(data.items)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  function startEdit(u) {
    setEditingId(u.id)
    setEditRole(u.role)
    setEditAdminRole(u.adminRole || 'SUPPORT_ADMIN')
  }

  async function saveRole(id) {
    try {
      await api.patch(`/users/${id}/role`, { role: editRole, adminRole: editRole === 'ADMIN' ? editAdminRole : undefined })
      setEditingId(null)
      await loadUsers()
    } catch (err) {
      window.alert(err.message)
    }
  }

  async function togglePermission(key, current) {
    await api.patch(`/permissions/${key}`, { enabledForSupport: !current })
    await loadPermissions()
  }

  return (
    <AdminLayout activeNav="accounts" pageTitle="Tài khoản & Phân quyền">
      <div className="dash-card" style={{ marginBottom: '24px' }}>
        <h3 className="form-card-title">Quyền của Support Admin</h3>
        <p style={{ fontSize: '12px', color: 'var(--dash-muted)', marginBottom: '14px' }}>
          Bật/tắt các mục Support Admin được phép sử dụng. Main Admin luôn có toàn quyền và không bị ảnh hưởng bởi các công tắc này.
          Việc đổi vai trò tài khoản (mục dưới) luôn chỉ dành riêng cho Main Admin, không thể cấp cho Support Admin.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {permissions.map((p) => (
            <label
              key={p.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '12px 14px',
                border: '1px solid var(--dash-border)',
                cursor: 'pointer',
                background: p.enabledForSupport ? 'var(--dash-active-bg)' : 'transparent',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--dash-heading)' }}>{p.label}</span>
              <input
                type="checkbox"
                checked={p.enabledForSupport}
                onChange={() => togglePermission(p.key, p.enabledForSupport)}
                style={{ width: '18px', height: '18px' }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="dash-toolbar">
        <input
          type="text"
          placeholder="Tìm theo tên / email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="dash-input"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="dash-select">
          <option value="">Tất cả vai trò</option>
          <option value="CUSTOMER">Khách hàng</option>
          <option value="ADMIN">Quản trị</option>
        </select>
      </div>

      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--dash-danger)' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Không tìm thấy tài khoản nào.</p>
        </div>
      ) : (
        <div className="dash-card dash-card-wide">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Cấp quản trị</th>
                <th>Ngày tạo</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    {editingId === u.id ? (
                      <select className="dash-select" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                        <option value="CUSTOMER">Khách hàng</option>
                        <option value="ADMIN">Quản trị</option>
                      </select>
                    ) : (
                      <span className={`order-status-badge ${ROLE_LABEL[u.role]?.cls || ''}`}>{ROLE_LABEL[u.role]?.label || u.role}</span>
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      editRole === 'ADMIN' && (
                        <select className="dash-select" value={editAdminRole} onChange={(e) => setEditAdminRole(e.target.value)}>
                          <option value="MAIN_ADMIN">Main Admin</option>
                          <option value="SUPPORT_ADMIN">Support Admin</option>
                        </select>
                      )
                    ) : u.adminRole ? (
                      <span className={`order-status-badge ${ADMIN_ROLE_LABEL[u.adminRole]?.cls || ''}`}>{ADMIN_ROLE_LABEL[u.adminRole]?.label}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td>
                    <div className="dash-row-actions">
                      {editingId === u.id ? (
                        <>
                          <button onClick={() => saveRole(u.id)}>Lưu</button>
                          <button onClick={() => setEditingId(null)}>Hủy</button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(u)} disabled={u.id === session?.id}>
                          {u.id === session?.id ? 'Tài khoản của bạn' : 'Đổi vai trò'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
