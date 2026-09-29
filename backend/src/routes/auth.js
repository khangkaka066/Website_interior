import { Router } from 'express'

const router = Router()

// The one admin account lives only in backend/.env now (ADMIN_USERNAME /
// ADMIN_PASSWORD) — never in frontend code, so it's not shipped in the
// browser bundle. Customer accounts are still handled entirely client-side
// (frontend/src/auth.js, localStorage) — fine for a demo, not for real
// customer data. A real store would add a users table + bcrypt + real
// sessions here instead of a plaintext .env comparison.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Thiếu tài khoản hoặc mật khẩu.' })
  }

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return res.json({
      ok: true,
      user: { username, name: 'Quản trị viên', role: 'admin' },
    })
  }

  return res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu.' })
})

export default router
