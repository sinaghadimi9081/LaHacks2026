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
    <main className="px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-card backdrop-blur">
          <div className="grid gap-10 px-8 py-10 md:grid-cols-[1.15fr_0.85fr] md:px-12 md:py-12">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
                Frontend foundation
              </span>

              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                  Modular React structure that matches your existing project style.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600">
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
                      className="rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5"
                      to="/signup"
                    >
                      Create account
                    </Link>
                    <Link
                      className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 no-underline transition hover:-translate-y-0.5"
                      to="/login"
                    >
                      Sign in
                    </Link>
                  </>
                )}

                {isAuthed && (
                  <Link
                    className="rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5"
                    to="/profile"
                  >
                    Open profile
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-slate-950 p-6 text-sm text-slate-200">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
                Session snapshot
              </p>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Auth status
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">{status}</p>
                </div>

                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Current user
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {user?.display_name || user?.username || 'Not signed in'}
                  </p>
                  <p className="mt-1 text-slate-400">
                    {user?.email || 'Use the auth pages to test cookie login.'}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
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
              className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-6 shadow-card"
            >
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Utils/{moduleName}.jsx
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
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
