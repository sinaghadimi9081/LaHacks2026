import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'

const initialForm = {
  username: '',
  email: '',
  display_name: '',
  household_name: '',
  password: '',
  password_confirm: '',
}

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      await signup(form)
      navigate('/profile', { replace: true })
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        Object.values(error?.response?.data || {})
          .flat()
          .join(' ') ||
        'Signup failed.'
      toast.error(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card backdrop-blur md:p-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
          Create account
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Start with a personal household, then expand later.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
          This form matches the backend signup endpoint and automatically creates
          the user&apos;s default fridge household.
        </p>

        <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Username
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="username"
              onChange={handleChange}
              required
              value={form.username}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Email
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="email"
              onChange={handleChange}
              required
              type="email"
              value={form.email}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Display name
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="display_name"
              onChange={handleChange}
              placeholder="Optional"
              value={form.display_name}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Household name
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="household_name"
              onChange={handleChange}
              placeholder="Optional"
              value={form.household_name}
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
              required
              type="password"
              value={form.password}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Confirm password
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
              name="password_confirm"
              onChange={handleChange}
              required
              type="password"
              value={form.password_confirm}
            />
          </label>

          <div className="md:col-span-2">
            <button
              className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
