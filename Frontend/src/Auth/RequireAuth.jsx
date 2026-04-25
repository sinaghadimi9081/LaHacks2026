import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './useAuth.jsx'

export default function RequireAuth({ children }) {
  const { status, isAuthed } = useAuth()
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="pantry-shell flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-ink/15 bg-white/80 px-6 py-5 text-sm font-black uppercase tracking-[0.14em] text-ink shadow-sticker backdrop-blur">
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
