// The admin account now lives server-side only (backend/.env), checked via
// the backend API — it is never shipped in this frontend bundle. Customer
// accounts are still a client-side-only demo (saved to localStorage): fine
// to show "customers can sign up/sign in", not real security for real data.
const SESSION_KEY = 'clevinum_session'
const CUSTOMERS_KEY = 'clevinum_customers'
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function isAdmin() {
  return getSession()?.role === 'admin'
}

function getCustomers() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMERS_KEY)) || []
  } catch {
    return []
  }
}

function saveCustomers(list) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list))
}

async function tryAdminLogin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    return data.ok ? data.user : null
  } catch {
    // Backend not running — silently fall through to customer login so a
    // customer isn't blocked just because the admin API is offline.
    return null
  }
}

export async function login(username, password) {
  const adminUser = await tryAdminLogin(username, password)
  if (adminUser) {
    setSession(adminUser)
    return { ok: true, user: adminUser }
  }

  const customer = getCustomers().find(
    (c) => c.username === username && c.password === password,
  )
  if (customer) {
    const user = { name: customer.name, username, role: 'customer' }
    setSession(user)
    return { ok: true, user }
  }

  return { ok: false, error: 'Sai tài khoản hoặc mật khẩu.' }
}

export function registerCustomer({ name, username, password }) {
  if (!name || !username || !password) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ thông tin.' }
  }
  if (getCustomers().some((c) => c.username === username)) {
    return { ok: false, error: 'Tài khoản này đã tồn tại.' }
  }

  const customers = getCustomers()
  customers.push({ name, username, password })
  saveCustomers(customers)

  const user = { name, username, role: 'customer' }
  setSession(user)
  return { ok: true, user }
}

export function loginWithGoogleProfile({ name, email, picture }) {
  const user = { name, username: email, role: 'customer', avatar: picture, provider: 'google' }
  setSession(user)
  return user
}
