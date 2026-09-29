import { Navigate, useLocation } from 'react-router-dom'
import { isAdmin } from '../auth'

export default function RequireAdmin({ children }) {
  const location = useLocation()

  if (!isAdmin()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
