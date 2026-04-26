import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'
import MarketplaceBackground from '../Marketplace/components/MarketplaceBackground.jsx'

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
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <MarketplaceBackground />
      <section className="pantry-shell">
        <div className="pantry-card mx-auto max-w-xl">
          <p className="pantry-label">
            Sign in
          </p>
          <h1 className="mt-4 text-4xl font-black uppercase leading-none text-ink">
            Log into your fridge account.
          </h1>
          <p className="pantry-copy mt-4">
            Supports `email` or `username` plus password against the Django JWT
            cookie auth backend.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="pantry-field-label">
                Email or username
              </span>
              <input
                className="pantry-input"
                name="identifier"
                onChange={handleChange}
                placeholder="sina or sina@example.com"
                required
                value={form.identifier}
              />
            </label>

            <label className="block">
              <span className="pantry-field-label">
                Password
              </span>
              <input
                className="pantry-input"
                name="password"
                onChange={handleChange}
                placeholder="Your password"
                required
                type="password"
                value={form.password}
              />
            </label>

            <button
              className="pantry-button w-full"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
