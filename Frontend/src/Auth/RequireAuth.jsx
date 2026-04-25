import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './useAuth.jsx'

export default function RequireAuth({ children }) {
  const { status, isAuthed } = useAuth()
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="pantry-shell flex min-h-[50vh] items-center justify-center">
        <div className="rounded-md border-2 border-ink bg-white px-6 py-5 text-sm font-black uppercase tracking-[0.14em] text-ink shadow-sticker">
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
