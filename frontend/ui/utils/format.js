export const formatCurrency = (n) => (n || 0).toLocaleString('vi-VN') + 'đ'

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export const formatDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
