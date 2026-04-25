import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { useAuth } from '../../Auth/useAuth.jsx'

function ProfileCard({ title, children }) {
  return (
    <section className="pantry-card">
      <p className="pantry-label">
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
    <main className="pantry-shell">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <ProfileCard title="User summary">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-phthalo p-6 text-white shadow-pop">
                <p className="text-3xl font-black">
                  {user?.display_name || user?.username}
                </p>
                <p className="mt-2 font-bold text-white/80">{user?.email}</p>
                <p className="mt-4 text-sm font-bold text-white/60">
                  Signed in with cookie-based JWT auth.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-ink/15 bg-citrus p-4 shadow-sticker">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                    Default household
                  </p>
                  <p className="mt-2 text-lg font-black text-ink">
                    {user?.default_household?.name}
                  </p>
                </div>

                <div className="rounded-xl border border-ink/15 bg-moonstone p-4 shadow-sticker">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                    Known households
                  </p>
                  <p className="mt-2 text-lg font-black text-ink">
                    {householdOptions.length}
                  </p>
                </div>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Profile settings">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProfile}>
              <label className="block">
                <span className="pantry-field-label">
                  Display name
                </span>
                <input
                  className="pantry-input"
                  name="display_name"
                  onChange={handleProfileChange}
                  value={profileForm.display_name}
                />
              </label>

              <label className="block">
                <span className="pantry-field-label">
                  Default household
                </span>
                <select
                  className="pantry-input"
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
                <span className="pantry-field-label">
                  First name
                </span>
                <input
                  className="pantry-input"
                  name="first_name"
                  onChange={handleProfileChange}
                  value={profileForm.first_name}
                />
              </label>

              <label className="block">
                <span className="pantry-field-label">
                  Last name
                </span>
                <input
                  className="pantry-input"
                  name="last_name"
                  onChange={handleProfileChange}
                  value={profileForm.last_name}
                />
              </label>

              <div className="md:col-span-2">
                <button
                  className="pantry-button"
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
                <span className="pantry-field-label">
                  Household name
                </span>
                <input
                  className="pantry-input"
                  name="name"
                  onChange={handleHouseholdChange}
                  value={householdForm.name}
                />
              </label>

              <button
                className="pantry-button pantry-button--accent"
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
                  className="rounded-xl border border-ink/15 bg-white/85 p-4 shadow-sticker"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-ink">
                        {household.name}
                      </p>
                      <p className="mt-1 text-sm font-bold text-ink/60">
                        Role: {household.role || 'member'}
                      </p>
                    </div>
                    <span className="rounded-full border-2 border-ink bg-petal px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-ink">
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
