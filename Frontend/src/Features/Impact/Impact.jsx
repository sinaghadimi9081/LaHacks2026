import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import {
  mockImprovementTips,
} from './impactData.js'
import { useAuth } from '../../Auth/useAuth.jsx'
import { fetchImpact, fetchImpactTips } from '../../Utils/impactApi.jsx'
import './impact.css'

// ── background stickers (same pattern as Inventory) ──────
const impactBackgroundStickers = [
  { label: 'Save', color: 'fresh', shape: 'oval', top: '12rem', left: '5%', rotate: '-8deg' },
  { label: 'Impact', color: 'ripe', shape: 'circle', top: '28rem', left: '82%', rotate: '14deg' },
  { label: 'Share', color: 'share', shape: 'squircle', top: '44rem', left: '88%', rotate: '-11deg' },
  { label: 'Rescue', color: 'basil', shape: 'oval', top: '62rem', left: '3%', rotate: '7deg' },
  { label: 'Green', color: 'fresh', shape: 'circle', top: '80rem', left: '76%', rotate: '-14deg' },
  { label: 'Zero', color: 'paper', shape: 'squircle', top: '98rem', left: '9%', rotate: '10deg' },
]

// ── metric card config ───────────────────────────────────
const metricCards = [
  {
    key: 'money',
    emoji: '💰',
    label: 'Total saved',
    format: (v) => `$${v.toFixed(2)}`,
    valueKey: 'dollars_saved',
    variant: 'money',
  },
  {
    key: 'rescued',
    emoji: '🥕',
    label: 'Items rescued',
    format: (v) => String(v),
    valueKey: 'items_rescued',
    variant: 'rescued',
  },
  {
    key: 'co2',
    emoji: '🌎',
    label: 'CO₂ avoided',
    format: (v) => `${v.toFixed(1)} kg`,
    valueKey: 'co2_saved_kg',
    variant: 'co2',
  },
  {
    key: 'shared',
    emoji: '📦',
    label: 'Items shared',
    format: (v) => String(v),
    valueKey: 'items_shared',
    variant: 'shared',
  },
]

// ── helpers ──────────────────────────────────────────────
function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data
  if (data?.detail) return String(data.detail)
  if (data && typeof data === 'object') {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length > 0) return String(v[0])
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return error?.message || fallback
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export default function Impact() {
  const { user, isAuthed } = useAuth()
  const [animateProgress, setAnimateProgress] = useState(false)
  const [loadState, setLoadState] = useState('loading')
  const [summary, setSummary] = useState(null)
  const [tips, setTips] = useState(mockImprovementTips)
  const [tipsState, setTipsState] = useState('idle')

  // trigger the progress bar animation once after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimateProgress(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isAuthed) {
        setSummary(null)
        setLoadState('ready')
        return
      }

      setLoadState('loading')
      try {
        const response = await fetchImpact()
        if (cancelled) return
        setSummary(response)
        setLoadState('ready')
      } catch (error) {
        if (!cancelled) {
          setLoadState('error')
          toast.error(getApiErrorMessage(error, 'Could not load impact summary.'))
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAuthed])

  const leaderboard = summary?.household_leaderboard || []
  const userRankIndex = useMemo(
    () => leaderboard.findIndex((entry) => Number(entry.user_id) === Number(user?.id)),
    [leaderboard, user?.id],
  )
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : '-'

  const personal = summary?.personal || {
    dollars_saved: '0.00',
    items_rescued: 0,
    co2_saved_kg: '0',
    items_shared: 0,
  }
  const weekly = summary?.weekly || { label: 'Money saved (last 7 days)', current: '0.00', goal: '25.00' }
  const weeklyCurrent = toNumber(weekly.current)
  const weeklyGoal = Math.max(toNumber(weekly.goal), 0.01)
  const progressPercent = Math.min((weeklyCurrent / weeklyGoal) * 100, 100)

  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      {/* background stickers */}
      <div className="marketplace-sticker-pattern" aria-hidden="true">
        {impactBackgroundStickers.map((sticker) => (
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

      {/* ─── hero ───────────────────────────────────────── */}
      <section className="impact-hero">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="impact-rank-badge">
              🏆 #{userRank} in your household
            </div>
            <h1 className="mt-5 max-w-3xl text-6xl font-black uppercase leading-[0.85] md:text-8xl">
              Your impact
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-ink/75">
              Every item rescued, shared, or cooked on time adds up.
              Here is how your household is fighting food waste together.
            </p>
          </div>

          {/* household leaderboard */}
          <div className="impact-leaderboard">
            {!isAuthed ? (
              <div className="impact-leaderboard-row impact-leaderboard-row--you">
                <div className="impact-leaderboard-position">-</div>
                <div>
                  <p className="impact-leaderboard-name">Log in</p>
                  <p className="impact-leaderboard-stat">to see your household impact</p>
                </div>
                <p className="text-base font-black text-ink">$0.00</p>
              </div>
            ) : loadState === 'loading' ? (
              <div className="impact-leaderboard-row impact-leaderboard-row--you">
                <div className="impact-leaderboard-position">…</div>
                <div>
                  <p className="impact-leaderboard-name">Loading</p>
                  <p className="impact-leaderboard-stat">calculating household stats</p>
                </div>
                <p className="text-base font-black text-ink">$0.00</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="impact-leaderboard-row impact-leaderboard-row--you">
                <div className="impact-leaderboard-position">-</div>
                <div>
                  <p className="impact-leaderboard-name">{user?.display_name || user?.username || 'You'}</p>
                  <p className="impact-leaderboard-stat">No shared impact yet</p>
                </div>
                <p className="text-base font-black text-ink">$0.00</p>
              </div>
            ) : (
              leaderboard.map((member, index) => {
              const isYou = Number(member.user_id) === Number(user?.id)
              return (
                <div
                  className={`impact-leaderboard-row ${isYou ? 'impact-leaderboard-row--you' : ''}`}
                  key={member.user_id}
                >
                  <div
                    className={`impact-leaderboard-position ${index === 0 ? 'impact-leaderboard-position--gold' : ''}`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="impact-leaderboard-name">
                      {isYou ? 'You' : member.name}
                    </p>
                    <p className="impact-leaderboard-stat">
                      {member.items_rescued} rescued
                    </p>
                  </div>
                  <p className="text-base font-black text-ink">
                    ${toNumber(member.dollars_saved).toFixed(2)}
                  </p>
                </div>
              )
            })
            )}
          </div>
        </div>
      </section>

      {/* ─── personal metrics ───────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pt-8 md:px-10">
        <div className="impact-section-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tomato">
              Personal stats
            </p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              Your metrics
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-7 text-ink/65">
            A snapshot of your contributions to reducing food waste in your household and community.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-6 md:px-10">
        <div className="impact-metrics-grid">
          {metricCards.map((card) => (
            <div
              className={`impact-metric-card impact-metric-card--${card.variant}`}
              key={card.key}
            >
              <div className="impact-metric-card__emoji">{card.emoji}</div>
              <p className="impact-metric-card__label">{card.label}</p>
              <strong className="impact-metric-card__value">
                {card.format(toNumber(personal[card.valueKey]))}
              </strong>
            </div>
          ))}
        </div>
      </section>

      {/* ─── weekly progress ────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pb-6 md:px-10">
        <div className="impact-progress-shell">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/55">
              {weekly.label}
            </p>
            <p className="text-sm font-black text-ink">
              ${weeklyCurrent.toFixed(2)}{' '}
              <span className="text-ink/45">/ ${toNumber(weekly.goal).toFixed(2)}</span>
            </p>
          </div>
          <div className="impact-progress-track mt-3">
            <div
              className="impact-progress-fill"
              style={{ width: animateProgress ? `${progressPercent}%` : '0%' }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-black uppercase tracking-[0.14em] text-ink/45">
            {progressPercent.toFixed(0)}% of weekly goal
          </p>
        </div>
      </section>

      {/* ─── how to improve ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pt-4 md:px-10">
        <div className="impact-section-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tomato">
              Tips
            </p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              How to improve
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-7 text-ink/65">
            Small habits that make a big difference. Start with one this week.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-6 pb-12 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink/65">
            {isAuthed ? 'Generate personalized tips from your household inventory.' : 'Log in to generate tips.'}
          </p>
          <button
            className="pantry-button pantry-button--accent"
            disabled={!isAuthed || tipsState === 'loading'}
            type="button"
            onClick={async () => {
              setTipsState('loading')
              try {
                const response = await fetchImpactTips()
                setTips(response.tips || mockImprovementTips)
                toast.success(response.source === 'ollama' ? 'AI tips ready.' : 'Tips ready (offline mode).')
                setTipsState('ready')
              } catch (error) {
                toast.error(getApiErrorMessage(error, 'Could not generate tips.'))
                setTipsState('error')
              }
            }}
          >
            {tipsState === 'loading' ? 'Generating tips…' : 'Get AI tips'}
          </button>
        </div>
        <div className="impact-tips-grid">
          {tips.map((tip) => (
            <div className="impact-tip-card" key={tip.title}>
              <div className="impact-tip-card__emoji">{tip.emoji}</div>
              <p className="impact-tip-card__title">{tip.title}</p>
              <p className="impact-tip-card__description">{tip.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
