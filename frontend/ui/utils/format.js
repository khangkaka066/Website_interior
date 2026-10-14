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

// Đếm ngược tới hạn xử lý: { text: 'còn 5 giờ 12 phút' | 'quá hạn 3 giờ', overdue, soon (còn dưới 6 giờ) }.
export function dueIn(due, now = Date.now()) {
  if (!due) return null
  const ms = new Date(due).getTime() - now
  const abs = Math.abs(ms)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const mins = Math.floor((abs % 3600000) / 60000)
  const span = days ? `${days} ngày ${hours} giờ` : hours ? `${hours} giờ ${mins} phút` : `${mins} phút`
  return ms < 0 ? { text: `quá hạn ${span}`, overdue: true, soon: false } : { text: `còn ${span}`, overdue: false, soon: ms < 6 * 3600000 }
}
