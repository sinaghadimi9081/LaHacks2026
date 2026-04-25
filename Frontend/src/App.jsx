function App() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(191,90,54,0.15),_transparent_40%),linear-gradient(180deg,_#fff8f0_0%,_#f7f1e8_100%)] px-6 py-12 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-card backdrop-blur">
          <div className="grid gap-8 px-8 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-14">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-ember/20 bg-ember/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-ember">
                LA Hacks 2026 starter
              </span>
              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-extrabold tracking-tight md:text-6xl">
                  React + Tailwind in front, Django REST behind it.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                  This frontend is wired to a backend starter with DRF, JWT auth,
                  registration endpoints, and CORS set up for local React
                  development.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-700">
                <span className="rounded-full bg-slate-900 px-4 py-2 text-white">
                  Vite + React
                </span>
                <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">
                  Tailwind CSS
                </span>
                <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">
                  API ready
                </span>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-left text-sm text-slate-200">
              <p className="mb-4 font-semibold text-slate-100">Local API target</p>
              <code className="block overflow-x-auto rounded-xl bg-black/30 p-4 text-emerald-300">
                {apiBaseUrl}
              </code>
              <div className="mt-6 space-y-3 text-slate-300">
                <p>`GET /health/` confirms the API is running.</p>
                <p>`POST /auth/login/` returns JWT tokens.</p>
                <p>`POST /auth/registration/` creates accounts.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Backend setup',
              command: 'cd Backend && ./setup.sh',
              detail: 'Creates the Python virtualenv, installs Django packages, runs migrations, and starts the server.',
            },
            {
              title: 'Frontend setup',
              command: 'cd Frontend && ./setup.sh',
              detail: 'Installs npm dependencies, loads the local env file, and launches the Vite dev server.',
            },
            {
              title: 'Shared workflow',
              command: 'pull changes, then rerun setup',
              detail: 'Each setup script is safe to rerun after dependency or config updates land in git.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-6 shadow-card"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ember">
                {item.title}
              </p>
              <code className="mt-4 block rounded-2xl bg-sand px-4 py-3 text-sm font-semibold text-slate-800">
                {item.command}
              </code>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {item.detail}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

export default App
