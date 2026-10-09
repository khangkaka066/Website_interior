import { api, setToken, getToken } from './api'

const SESSION_KEY = 'clevinum_session'

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
  setToken(null)
}

export function isAdmin() {
  return !!getToken() && getSession()?.role === 'ADMIN'
}

export function isMainAdmin() {
  return getSession()?.adminRole === 'MAIN_ADMIN'
}

function persist({ token, user }) {
  setToken(token)
  setSession(user)
  return user
}

export async function login(email, password) {
  try {
    const { token, user } = await api.post('/auth/login', { email, password })
    persist({ token, user })
    return { ok: true, user }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export async function registerCustomer({ name, username, password }) {
  if (!name || !username || !password) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ thông tin.' }
  }
  try {
    const { token, user } = await api.post('/auth/register', { name, email: username, password })
    persist({ token, user })
    return { ok: true, user }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export async function loginWithGoogleCredential(credential) {
  const { token, user } = await api.post('/auth/google', { credential })
  return persist({ token, user })
}
