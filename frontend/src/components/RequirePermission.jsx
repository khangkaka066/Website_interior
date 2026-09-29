import { Navigate } from 'react-router-dom'
import { useCanAccess } from './dashboard/AdminLayout'
import { getSession } from '../auth'

// Guards a dashboard route by permission key, for when a SUPPORT_ADMIN
// without access types the URL directly instead of using the (already
// filtered) sidebar nav. The API itself enforces this regardless — this is
// just so they land somewhere sensible instead of a page full of 403s.
export default function RequirePermission({ permKey, mainAdminOnly, children }) {
  const { canAccess, permissionsLoaded } = useCanAccess()

  if (mainAdminOnly) {
    const isMainAdmin = getSession()?.adminRole === 'MAIN_ADMIN'
    if (!isMainAdmin) return <Navigate to="/dashboard" replace />
    return children
  }

  if (!permissionsLoaded) return null
  if (!canAccess(permKey)) return <Navigate to="/dashboard" replace />
  return children
}
