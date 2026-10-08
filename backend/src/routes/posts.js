import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createPostSchema, updatePostSchema } from '../schemas/admin.js'
import { listPosts, getPost, createPost, updatePost, deletePost } from '../controllers/posts.js'

// Quản lý bài viết Tin tức (cần quyền "posts"). API công khai cho website nằm ở /api/shop/posts.
const router = Router()
router.use(requirePermission('posts'))

router.get('/', asyncHandler(listPosts))
router.post('/', validate(createPostSchema), asyncHandler(createPost))
router.get('/:id', asyncHandler(getPost))
router.patch('/:id', validate(updatePostSchema), asyncHandler(updatePost))
router.delete('/:id', asyncHandler(deletePost))

export default router
