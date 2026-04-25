import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './useAuth.jsx'

export default function RequireAuth({ children }) {
  const { status, isAuthed } = useAuth()
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-6">
        <div className="rounded-3xl bg-white/80 px-6 py-5 text-sm font-semibold text-slate-500 shadow-card">
          Checking your session...
        </div>
      </div>
    )
  }

  if (!isAuthed) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return children
}
