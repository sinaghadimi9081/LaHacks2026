import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import {
  fetchAuthMe,
  fetchCsrfToken,
  loginUser,
  logoutUser,
  refreshAuth,
  signupUser,
} from '../Utils/authApi.jsx'
import { updateMyProfile } from '../Utils/userApi.jsx'
import { updateMyHousehold } from '../Utils/householdApi.jsx'
import AuthContext from './context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let isActive = true

    async function bootstrapAuth() {
      try {
        await fetchCsrfToken()

        try {
          const response = await fetchAuthMe()
          if (!isActive) return
          setUser(response.user)
          setStatus('ready')
          return
        } catch {
          await refreshAuth()
          const response = await fetchAuthMe()
          if (!isActive) return
          setUser(response.user)
          setStatus('ready')
          return
        }
      } catch {
        if (!isActive) return
        setUser(null)
        setStatus('ready')
      }
    }

    void bootstrapAuth()

    return () => {
      isActive = false
    }
  }, [])

  const login = async (payload) => {
    const response = await loginUser(payload)
    setUser(response.user)
    toast.success('Welcome back.')
    return response
  }

  const signup = async (payload) => {
    const response = await signupUser(payload)
    setUser(response.user)
    toast.success('Account created.')
    return response
  }

  const logout = async () => {
    try {
      await logoutUser()
      toast.success('Logged out.')
    } catch {
      toast.error('Logout failed. Check your connection.')
    } finally {
      setUser(null)
      setStatus('ready')
    }
  }

  const refreshUser = async () => {
    const response = await fetchAuthMe()
    setUser(response.user)
    return response.user
  }

  const saveProfile = async (payload) => {
    const response = await updateMyProfile(payload)
    setUser(response.user)
    toast.success('Profile updated.')
    return response
  }

  const saveHousehold = async (payload) => {
    const response = await updateMyHousehold(payload)
    setUser((currentUser) => {
      if (!currentUser) return currentUser

      const updatedHousehold = response.household
      return {
        ...currentUser,
        default_household:
          currentUser.default_household?.id === updatedHousehold.id
            ? updatedHousehold
            : currentUser.default_household,
        households: (currentUser.households ?? []).map((household) =>
          household.id === updatedHousehold.id ? { ...household, ...updatedHousehold } : household,
        ),
      }
    })
    toast.success('Household updated.')
    return response
  }

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthed: Boolean(user),
      login,
      signup,
      logout,
      refreshUser,
      saveProfile,
      saveHousehold,
    }),
    [user, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
