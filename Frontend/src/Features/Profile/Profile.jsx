import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'

function ProfileCard({ title, children }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 shadow-card">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
        {title}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export default function Profile() {
  const { user, saveProfile, saveHousehold } = useAuth()
  const [profileForm, setProfileForm] = useState({
    display_name: user?.display_name || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    default_household_id: user?.default_household?.id || '',
  })
  const [householdForm, setHouseholdForm] = useState({
    name: user?.default_household?.name || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingHousehold, setSavingHousehold] = useState(false)

  const householdOptions = useMemo(() => user?.households ?? [], [user?.households])

  const handleProfileChange = (event) => {
    const { name, value } = event.target
    setProfileForm((current) => ({ ...current, [name]: value }))
  }

  const handleHouseholdChange = (event) => {
    const { name, value } = event.target
    setHouseholdForm((current) => ({ ...current, [name]: value }))
  }

  const submitProfile = async (event) => {
    event.preventDefault()
    setSavingProfile(true)

    try {
      await saveProfile({
        ...profileForm,
        default_household_id: Number(profileForm.default_household_id),
      })
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        Object.values(error?.response?.data || {})
          .flat()
          .join(' ') ||
        'Profile update failed.'
      toast.error(detail)
    } finally {
      setSavingProfile(false)
    }
  }

  const submitHousehold = async (event) => {
    event.preventDefault()
    setSavingHousehold(true)

    try {
      await saveHousehold(householdForm)
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        Object.values(error?.response?.data || {})
          .flat()
          .join(' ') ||
        'Household update failed.'
      toast.error(detail)
    } finally {
      setSavingHousehold(false)
    }
  }

  return (
    <main className="px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <ProfileCard title="User summary">
            <div className="space-y-5">
              <div className="rounded-[1.5rem] bg-slate-950 p-6 text-slate-100">
                <p className="text-3xl font-black">
                  {user?.display_name || user?.username}
                </p>
                <p className="mt-2 text-slate-300">{user?.email}</p>
                <p className="mt-4 text-sm text-slate-400">
                  Signed in with cookie-based JWT auth.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                    Default household
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {user?.default_household?.name}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Known households
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {householdOptions.length}
                  </p>
                </div>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Profile settings">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProfile}>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Display name
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  name="display_name"
                  onChange={handleProfileChange}
                  value={profileForm.display_name}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Default household
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  name="default_household_id"
                  onChange={handleProfileChange}
                  value={profileForm.default_household_id}
                >
                  {householdOptions.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  First name
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  name="first_name"
                  onChange={handleProfileChange}
                  value={profileForm.first_name}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Last name
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  name="last_name"
                  onChange={handleProfileChange}
                  value={profileForm.last_name}
                />
              </label>

              <div className="md:col-span-2">
                <button
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={savingProfile}
                  type="submit"
                >
                  {savingProfile ? 'Saving profile...' : 'Save profile'}
                </button>
              </div>
            </form>
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard title="Household settings">
            <form className="space-y-4" onSubmit={submitHousehold}>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Household name
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  name="name"
                  onChange={handleHouseholdChange}
                  value={householdForm.name}
                />
              </label>

              <button
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingHousehold}
                type="submit"
              >
                {savingHousehold ? 'Saving household...' : 'Save household'}
              </button>
            </form>
          </ProfileCard>

          <ProfileCard title="Memberships">
            <div className="space-y-3">
              {householdOptions.map((household) => (
                <div
                  key={household.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {household.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Role: {household.role || 'member'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      {household.status || 'active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ProfileCard>
        </div>
      </div>
    </main>
  )
}
