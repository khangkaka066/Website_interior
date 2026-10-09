import crypto from 'node:crypto'

// Công việc nền cho công cụ Từ khóa SEO. Gọi AI qua OpenRouter có thể mất từ vài giây tới vài phút (mô hình miễn phí), vượt thời gian chờ của
// trình duyệt/proxy. Nên POST chỉ tạo công việc và trả mã ngay; trình duyệt hỏi lại trạng thái đều đặn tới khi xong. Lưu trong bộ nhớ:
// khởi động lại backend thì công việc đang chạy mất (người dùng chỉ cần bấm lại).
const jobs = new Map()
const KEEP_FINISHED_MS = 30 * 60_000 // giữ kết quả 30 phút để tải lại trang vẫn xem được
const MAX_RUNNING = 6 // tổng số việc chạy cùng lúc (mỗi việc giữ một kết nối tới OpenRouter)

const sweep = () => {
  const now = Date.now()
  for (const [id, j] of jobs) if (j.finishedAt && now - j.finishedAt > KEEP_FINISHED_MS) jobs.delete(id)
}

export const runningCount = () => [...jobs.values()].filter((j) => j.status === 'running').length
export const userRunning = (userId) => [...jobs.values()].find((j) => j.userId === userId && j.status === 'running')

export class JobLimitError extends Error {
  constructor(message, jobId) {
    super(message)
    this.jobId = jobId // việc đang chạy của chính người này (nếu có), để giao diện gắn lại vào đó
  }
}

// work(ctx): ctx = { signal, setStage }. Trả về dữ liệu kết quả.
export function startJob(userId, work, { mapError = (e) => e.message } = {}) {
  sweep()
  const mine = userRunning(userId)
  if (mine) throw new JobLimitError('Bạn đang có một phân tích đang chạy, hãy chờ xong hoặc hủy trước khi bắt đầu lại.', mine.id)
  if (runningCount() >= MAX_RUNNING) throw new JobLimitError('Hệ thống đang xử lý nhiều yêu cầu, vui lòng thử lại sau ít phút.')

  const controller = new AbortController()
  const job = { id: crypto.randomUUID(), userId, status: 'running', stage: 'Đang gửi yêu cầu…', startedAt: Date.now(), finishedAt: null, result: null, error: null, steps: [], controller }
  jobs.set(job.id, job)
  Promise.resolve()
    .then(() => work({
      signal: controller.signal,
      setStage: (t) => { if (job.status === 'running') job.stage = t },
      setSteps: (list) => { if (job.status === 'running') job.steps = list },
    }))
    .then((result) => {
      if (job.status !== 'running') return
      job.status = 'done'
      job.result = result
    })
    .catch((err) => {
      if (job.status !== 'running') return
      job.status = controller.signal.aborted ? 'cancelled' : 'error'
      job.error = controller.signal.aborted ? 'Đã hủy.' : mapError(err)
    })
    .finally(() => {
      job.finishedAt = Date.now()
    })
  return job
}

// Việc gần nhất của người này: ưu tiên việc đang chạy, nếu không thì việc vừa xong thành công còn trong thời gian giữ. Dùng khi mở trang ở tab/máy khác
// hoặc sau khi tải lại: giao diện không cần nhớ mã việc mà vẫn thấy được phân tích đang chạy hoặc kết quả vừa có.
export const currentJob = (userId) => {
  sweep()
  const mine = [...jobs.values()].filter((j) => j.userId === userId)
  return mine.find((j) => j.status === 'running') || mine.filter((j) => j.status === 'done').sort((a, b) => b.finishedAt - a.finishedAt)[0] || null
}

export const getJob = (id, userId) => {
  const j = jobs.get(id)
  return j && j.userId === userId ? j : null
}

export const cancelJob = (job) => {
  if (job.status !== 'running') return
  job.status = 'cancelled'
  job.error = 'Đã hủy.'
  job.finishedAt = Date.now()
  job.controller.abort()
}

// Dạng gửi cho trình duyệt (không lộ controller/userId).
export const jobView = (j) => ({
  id: j.id,
  status: j.status,
  stage: j.stage,
  steps: j.steps,
  elapsedMs: (j.finishedAt || Date.now()) - j.startedAt,
  ...(j.finishedAt && { finishedAgoMs: Date.now() - j.finishedAt }),
  ...(j.status === 'done' && { data: j.result }),
  ...(j.error && { error: j.error }),
})
