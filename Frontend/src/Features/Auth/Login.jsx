import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname || '/profile'

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      await login(form)
      navigate(from, { replace: true })
    } catch (error) {
      const detail = error?.response?.data?.detail || 'Login failed.'
      toast.error(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card backdrop-blur md:p-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
          Sign in
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Log into your fridge account.
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Supports `email` or `username` plus password against the Django JWT
          cookie auth backend.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Email or username
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="identifier"
              onChange={handleChange}
              placeholder="sina or sina@example.com"
              required
              value={form.identifier}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Password
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="password"
              onChange={handleChange}
              placeholder="Your password"
              required
              type="password"
              value={form.password}
            />
          </label>

          <button
            className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  )
}
