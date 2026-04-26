import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'
import MarketplaceBackground from '../Marketplace/components/MarketplaceBackground.jsx'

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
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <MarketplaceBackground />
      <section className="pantry-shell">
        <div className="pantry-card mx-auto max-w-2xl">
          <p className="pantry-label">
            Create account
          </p>
          <h1 className="mt-4 text-4xl font-black uppercase leading-none text-ink">
            Start with a personal household, then expand later.
          </h1>
          <p className="pantry-copy mt-4 max-w-2xl">
            This form matches the backend signup endpoint and automatically creates
            the user&apos;s default fridge household.
          </p>

          <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="pantry-field-label">
                Username
              </span>
              <input
                className="pantry-input"
                name="username"
                onChange={handleChange}
                required
                value={form.username}
              />
            </label>

            <label className="block">
              <span className="pantry-field-label">
                Email
              </span>
              <input
                className="pantry-input"
                name="email"
                onChange={handleChange}
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="block">
              <span className="pantry-field-label">
                Display name
              </span>
              <input
                className="pantry-input"
                name="display_name"
                onChange={handleChange}
                placeholder="Optional"
                value={form.display_name}
              />
            </label>

            <label className="block">
              <span className="pantry-field-label">
                Household name
              </span>
              <input
                className="pantry-input"
                name="household_name"
                onChange={handleChange}
                placeholder="Optional"
                value={form.household_name}
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
                required
                type="password"
                value={form.password}
              />
            </label>

            <label className="block">
              <span className="pantry-field-label">
                Confirm password
              </span>
              <input
                className="pantry-input"
                name="password_confirm"
                onChange={handleChange}
                required
                type="password"
                value={form.password_confirm}
              />
            </label>

            <div className="md:col-span-2">
              <button
                className="pantry-button w-full"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
