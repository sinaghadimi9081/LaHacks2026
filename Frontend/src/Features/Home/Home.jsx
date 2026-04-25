import { Link } from 'react-router-dom'

import { useAuth } from '../../Auth/useAuth.jsx'

const serviceModules = [
  'authApi',
  'userApi',
  'householdApi',
  'receiptsApi',
  'itemsApi',
  'shareApi',
  'impactApi',
]

export default function Home() {
  const { user, isAuthed, status } = useAuth()

  return (
    <main className="pantry-shell">
      <div className="flex flex-col gap-8">
        <section className="overflow-hidden rounded-md border-4 border-ink bg-white shadow-paper">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.15fr_0.85fr] md:px-10">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border-2 border-ink bg-citrus px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-ink shadow-sticker">
                Frontend foundation
              </span>

              <div className="space-y-4">
                <h1 className="pantry-heading max-w-3xl">
                  Modular React structure that matches your existing project style.
                </h1>
                <p className="pantry-copy max-w-2xl">
                  NeighborFridge now has `App`, `Auth`, `Features`, and `Utils`
                  folders, plus reusable backend client helpers for auth,
                  profile, households, receipts, pantry items, sharing, and
                  impact endpoints.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {!isAuthed && (
                  <>
                    <Link
                      className="pantry-button no-underline"
                      to="/signup"
                    >
                      Create account
                    </Link>
                    <Link
                      className="pantry-button pantry-button--light no-underline"
                      to="/login"
                    >
                      Sign in
                    </Link>
                  </>
                )}

                {isAuthed && (
                  <Link
                    className="pantry-button no-underline"
                    to="/profile"
                  >
                    Open profile
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-md border-[3px] border-ink bg-phthalo p-5 text-sm text-white shadow-pop">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-citrus">
                Session snapshot
              </p>

              <div className="space-y-4">
                <div className="rounded-md border-2 border-white/40 bg-white/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Auth status
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">{status}</p>
                </div>

                <div className="rounded-md border-2 border-white/40 bg-white/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Current user
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {user?.display_name || user?.username || 'Not signed in'}
                  </p>
                  <p className="mt-1 text-white/60">
                    {user?.email || 'Use the auth pages to test cookie login.'}
                  </p>
                </div>

                <div className="rounded-md border-2 border-white/40 bg-white/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Default household
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {user?.default_household?.name || 'No household loaded'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {serviceModules.map((moduleName) => (
            <article
              key={moduleName}
              className="pantry-card"
            >
              <p className="pantry-label">
                Utils/{moduleName}.jsx
              </p>
              <p className="mt-4 text-sm font-bold leading-7 text-ink/70">
                Centralized endpoint helpers so feature code can import stable
                functions instead of rebuilding request details inline.
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
