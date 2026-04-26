import { Link } from 'react-router-dom'

import { useAuth } from '../../Auth/useAuth.jsx'
import heroImage from '../../assets/hero.png'

const landingStickers = [
  { label: 'Rescue', color: 'fresh', shape: 'oval', top: '8rem', left: '4%', rotate: '-10deg' },
  { label: 'Share', color: 'share', shape: 'circle', top: '18rem', left: '82%', rotate: '12deg' },
  { label: 'Fresh', color: 'ripe', shape: 'squircle', top: '35rem', left: '88%', rotate: '-8deg' },
  { label: 'Cook', color: 'local', shape: 'oval', top: '52rem', left: '6%', rotate: '10deg' },
  { label: 'Impact', color: 'basil', shape: 'circle', top: '74rem', left: '78%', rotate: '-12deg' },
]

const featureCards = [
  {
    eyebrow: 'Pantry dashboard',
    title: 'Know what you have before it disappears.',
    copy:
      'Track household groceries, expiry dates, quantities, estimated value, and quick actions from one lively board.',
    to: '/dashboard',
  },
  {
    eyebrow: 'Receipt scan',
    title: 'Turn grocery runs into inventory.',
    copy:
      'Upload a receipt, review the detected items, and choose exactly what should become pantry stock.',
    to: '/receipts',
  },
  {
    eyebrow: 'Marketplace',
    title: 'Share extra food with nearby neighbors.',
    copy:
      'Post active listings, request available items, and reveal exact pickup details only after approval.',
    to: '/marketplace',
  },
  {
    eyebrow: 'Smart lockers',
    title: 'Coordinate pickup without hovering by the door.',
    copy:
      'Reserve locker space, confirm dropoff, buy listings, and complete pickup with simple codes.',
    to: '/lockers',
  },
  {
    eyebrow: 'Impact tracking',
    title: 'Watch small saves become household progress.',
    copy:
      'See rescued items, dollars saved, food shared, CO2 avoided, and personalized waste-reduction tips.',
    to: '/impact',
  },
]

const steps = [
  {
    title: 'Capture the haul',
    copy: 'Add food manually or scan a receipt after groceries land on the counter.',
    tag: 'receipt to pantry',
    icon: 'receipt_long',
  },
  {
    title: 'Spot the next move',
    copy: 'Use expiry signals, quantities, and household notes to see what needs attention.',
    tag: 'freshness radar',
    icon: 'inventory_2',
  },
  {
    title: 'Share the surplus',
    copy: 'List extras, approve requests, reveal pickup details, or route handoff through lockers.',
    tag: 'neighbor handoff',
    icon: 'handshake',
  },
  {
    title: 'Watch it add up',
    copy: 'Track rescued items, dollars saved, CO2 avoided, and your household leaderboard.',
    tag: 'impact loop',
    icon: 'monitoring',
  },
]

const timelineStops = [
  { marker: 'left-[12%] top-[25%]', card: 'left-[3%] top-[6%] max-w-[15rem]' },
  { marker: 'left-[53%] top-[12%]', card: 'right-[4%] top-[5%] max-w-[16rem]' },
  { marker: 'left-[24%] top-[71%]', card: 'left-[6%] bottom-[4%] max-w-[16rem]' },
  { marker: 'left-[76%] top-[58%]', card: 'right-[5%] bottom-[7%] max-w-[16rem]' },
]

export default function Home() {
  const { isAuthed, user } = useAuth()
  const dashboardName = user?.display_name || user?.username || 'your'

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <div className="marketplace-sticker-pattern" aria-hidden="true">
        {landingStickers.map((sticker) => (
          <div
            className={`marketplace-sticker marketplace-sticker--${sticker.color} marketplace-sticker--${sticker.shape}`}
            key={`${sticker.label}-${sticker.top}`}
            style={{
              '--sticker-left': sticker.left,
              '--sticker-rotate': sticker.rotate,
              '--sticker-top': sticker.top,
            }}
          >
            {sticker.label}
          </div>
        ))}
      </div>

      <section className="pantry-dot-grid relative border-b-4 border-ink bg-moonstone px-5 py-10 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="">
            <p className="mb-4 w-fit rounded-full border border-ink/15 bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sticker backdrop-blur">
              neighbor-powered food rescue
            </p>
            <h1 className="max-w-4xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Keep good food moving.
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              NeighborFridge helps households track groceries, catch use-soon items, share extras,
              coordinate pickup, and measure the waste they prevent together.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="pantry-button no-underline" to={isAuthed ? '/dashboard' : '/signup'}>
                {isAuthed ? `${dashboardName} dashboard` : 'Start your pantry'}
              </Link>
              <Link className="pantry-button pantry-button--light no-underline" to="/marketplace">
                Browse marketplace
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-3 -top-3 z-10 rotate-6 rounded-full border border-ink/15 bg-citrus px-4 py-2 text-xs font-black uppercase tracking-[0.14em] shadow-sticker">
              fresh chaos, organized
            </div>
            <img
              alt="A colorful pantry illustration for NeighborFridge"
              className="aspect-[4/3] w-full rounded-2xl border-4 border-ink bg-white/80 object-cover shadow-pop"
              src={heroImage}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-36 md:px-10 md:pt-20">
        <div className="dashboard-readable-text flex flex-wrap items-end justify-between gap-4 border-b-2 border-moonstone pb-4">
          <div>
            <p className="pantry-label ">How it works</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              From fridge mystery to dinner plan
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-7 text-ink/65">
            The app is built around one loop: capture food, decide what to do with it, and keep
            value out of the trash.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-8 md:px-10">
        <div className="relative hidden min-h-[38rem] overflow-hidden rounded-[2rem] border border-ink/15 bg-white/80 p-6 shadow-paper backdrop-blur-md lg:block">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 1000 540"
          >
            <path
              d="M-20 20 C110 60 130 210 300 145 C420 92 448 18 560 68"
              fill="none"
              stroke="#d9e872"
              strokeLinecap="round"
              strokeWidth="42"
            />
            <path
              d="M560 68 C668 116 646 185 570 246 C512 292 440 350 360 398"
              fill="none"
              stroke="#2f7d4f"
              strokeLinecap="round"
              strokeWidth="42"
            />
            <path
              d="M360 398 C270 455 226 383 260 305 C308 194 430 258 512 364"
              fill="none"
              stroke="#174733"
              strokeLinecap="round"
              strokeWidth="42"
            />
            <path
              d="M512 364 C602 482 735 420 790 306 C846 190 956 230 1020 322"
              fill="none"
              stroke="#9fcfb2"
              strokeLinecap="round"
              strokeWidth="42"
            />
            <path
              d="M-20 20 C110 60 130 210 300 145 C420 92 448 18 560 68 C668 116 646 185 570 246 C512 292 440 350 360 398 C270 455 226 383 260 305 C308 194 430 258 512 364 C602 482 735 420 790 306 C846 190 956 230 1020 322"
              fill="none"
              opacity="0.18"
              stroke="#12312a"
              strokeLinecap="round"
              strokeWidth="8"
            />
          </svg>

          {steps.map((step, index) => (
            <div
              className={`absolute z-10 ${timelineStops[index].marker}`}
              key={step.title}
            >
              <span className="grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-ink bg-citrus text-lg font-black shadow-pop">
                {index + 1}
              </span>
            </div>
          ))}

          {steps.map((step, index) => (
            <article
              className={`absolute z-10 rounded-2xl border border-ink/15 bg-white/90 p-4 shadow-paper backdrop-blur-md ${timelineStops[index].card}`}
              key={`${step.title}-card`}
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined rounded-full border border-ink/15 bg-citrus p-2 text-ink shadow-sticker">
                  {step.icon}
                </span>
                <div>
                  <p className="pantry-label">{step.tag}</p>
                  <h3 className="mt-1 text-xl font-black uppercase leading-none text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
                    {step.copy}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-6 lg:hidden">
          {steps.map((step, index) => (
            <article
              className="ingredient-card ingredient-card--text-only"
              key={`${step.title}-mobile`}
              style={{ '--tilt': index % 2 === 0 ? '-0.8deg' : '0.8deg' }}
            >
              <div className="recipe-card recipe-card--full h-full">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-ink bg-citrus text-base font-black shadow-sticker">
                    {index + 1}
                  </span>
                  <span className="material-symbols-outlined rounded-full border border-ink/15 bg-white p-2 text-ink shadow-sticker">
                    {step.icon}
                  </span>
                </div>
                <div>
                  <p className="pantry-label">{step.tag}</p>
                  <h3 className="mt-2 text-xl font-black uppercase leading-none text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm font-bold leading-7 text-ink/70">
                    {step.copy}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-16 md:px-10 md:pt-20">
        <div className="dashboard-readable-text flex flex-wrap items-end justify-between gap-4 border-b-2 border-moonstone pb-4">
          <div>
            <p className="pantry-label">What you can do</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              A kitchen command center
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-7 text-ink/65">
            Each tool is small on purpose, but together they make food sharing feel less like admin
            and more like a good habit.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 md:px-10 lg:grid-cols-2 xl:grid-cols-3">
        {featureCards.map((feature, index) => (
          <article
            className="ingredient-card ingredient-card--text-only"
            key={feature.title}
            style={{ '--tilt': index % 2 === 0 ? '0.65deg' : '-0.65deg' }}
          >
            <div className="recipe-card recipe-card--full h-full">
              <div className="flex items-start justify-between gap-3 border-b-2 border-moonstone pb-3">
                <div>
                  <p className="pantry-label">{feature.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-black uppercase leading-none">
                    {feature.title}
                  </h3>
                </div>
                <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-black uppercase text-ink/65 shadow-sticker">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-sm font-bold leading-7 text-ink/70">{feature.copy}</p>
              <Link className="pantry-button pantry-button--light mt-auto w-fit no-underline" to={feature.to}>
                Open
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14 pt-10 md:px-10 md:pt-14">
        <div className="pantry-card grid gap-4 bg-phthalo text-white md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-citrus">
              ready when your leftovers are
            </p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              Start with one item you do not want to waste.
            </h2>
          </div>
          <Link className="pantry-button pantry-button--accent no-underline" to={isAuthed ? '/dashboard' : '/signup'}>
            {isAuthed ? 'Open dashboard' : 'Create account'}
          </Link>
        </div>
      </section>
    </main>
  )
}
