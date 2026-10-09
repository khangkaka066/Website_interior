import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { aiLimiter } from '../middleware/security.js'
import { keywordsSchema } from '../schemas/seo.js'
import { generateKeywords, describeSource, SeoConfigError, SeoUpstreamError } from '../lib/seoKeywords.js'
import { startJob, getJob, currentJob, cancelJob, jobView, JobLimitError } from '../lib/seoJobs.js'

// Công cụ gợi ý từ khóa SEO bằng AI cho trang quản trị (mỗi lần gọi tốn tín dụng OpenRouter nên có giới hạn tần suất).
// Chạy nền: POST tạo việc và trả mã ngay (202); GET /jobs/:id hỏi trạng thái/kết quả; POST /jobs/:id/cancel để hủy. Nhờ vậy việc phân tích
// lâu bao nhiêu cũng không bị cắt bởi thời gian chờ của trình duyệt hay proxy.
const router = Router()
const guard = requirePermission('products')

router.get('/status', guard, (req, res) => {
  res.json({ configured: !!process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini' })
})

router.post(
  '/keywords',
  guard,
  aiLimiter,
  validate(keywordsSchema),
  asyncHandler(async (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'Chưa cấu hình OPENROUTER_API_KEY trong backend/.env.' })
    if (!describeSource(req.body)) return res.status(404).json({ error: 'Không tìm thấy sản phẩm này.' })
    let job
    try {
      job = startJob(req.user.id, ({ signal, setStage, setSteps }) => generateKeywords(req.body, { signal, onStage: setStage, onSteps: setSteps }), {
        mapError: (err) => (err instanceof SeoConfigError || err instanceof SeoUpstreamError ? err.message : 'Đã có lỗi khi phân tích, vui lòng thử lại.'),
      })
    } catch (err) {
      if (err instanceof JobLimitError) return res.status(429).json({ error: err.message, ...(err.jobId && { jobId: err.jobId }) })
      throw err
    }
    res.status(202).json(jobView(job))
  }),
)

// Việc đang chạy (hoặc vừa xong) của người đang đăng nhập. Phải khai báo trước '/jobs/:id'.
router.get('/jobs/current', guard, (req, res) => {
  const job = currentJob(req.user.id)
  res.set('Cache-Control', 'no-store')
  res.json({ job: job ? jobView(job) : null })
})

router.get('/jobs/:id', guard, (req, res) => {
  const job = getJob(req.params.id, req.user.id)
  if (!job) return res.status(404).json({ error: 'Không tìm thấy phân tích này (có thể đã hết hạn hoặc backend vừa khởi động lại).' })
  res.set('Cache-Control', 'no-store')
  res.json(jobView(job))
})

router.post('/jobs/:id/cancel', guard, (req, res) => {
  const job = getJob(req.params.id, req.user.id)
  if (!job) return res.status(404).json({ error: 'Không tìm thấy phân tích này.' })
  cancelJob(job)
  res.json(jobView(job))
})

export default router
