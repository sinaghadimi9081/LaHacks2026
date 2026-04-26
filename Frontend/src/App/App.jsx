import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'

import RequireAuth from '../Auth/RequireAuth.jsx'
import { useAuth } from '../Auth/useAuth.jsx'
import Home from '../Features/Home/Home.jsx'
import Login from '../Features/Auth/Login.jsx'
import Signup from '../Features/Auth/Signup.jsx'
import Profile from '../Features/Profile/Profile.jsx'
import Inventory from '../Features/Inventory/Inventory.jsx'
import InventoryRequestListingPage from '../Features/Inventory/InventoryRequestListingPage.jsx'
import Marketplace from '../Features/Marketplace/Marketplace.jsx'
import MarketplaceMapLab from '../Features/Marketplace/MarketplaceMapLab.jsx'

import MarketplaceMatchLab from '../Features/Marketplace/MarketplaceMatchLab.jsx'
import Lockers from '../Features/Lockers/Lockers.jsx'
import Impact from '../Features/Impact/Impact.jsx'
import ReceiptsWorkbench from '../Features/Receipts/ReceiptsWorkbench.jsx'
import neighborFridgeMark from '../assets/neighborfridge-mark.png'
import './app.css'
import 'react-toastify/dist/ReactToastify.css'

function NavBar() {
  const { isAuthed, user, logout, status } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const profileImageUrl = user?.profile_image_url || user?.profile_image || ''
  const profileName = user?.display_name || user?.username || 'Profile'
  const profileInitial = profileName.charAt(0).toUpperCase()
  const creditsBalance = user?.credits_balance

  useEffect(() => {
    if (!isUserMenuOpen) {
      return undefined
    }

    function handleDocumentPointerDown(event) {
      if (!userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)

    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [isUserMenuOpen])

  return (
    <header className="border-b-4 border-ink bg-petal">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-10">
        <Link to="/" className="brand-link no-underline">
          <img alt="" className="brand-mark" src={neighborFridgeMark} />
          <div className="brand-copy">
            <p className="brand-title text-sm font-black uppercase tracking-[0.18em] text-ink">
              NeighborFridge
            </p>
            <p className="brand-subtitle text-xs font-black uppercase tracking-[0.14em] text-tomato">
              Pantry board
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-3">
          <NavLink className="nav-pill" to="/dashboard">
            Dashboard
          </NavLink>

          <NavLink className="nav-pill" to="/receipts">
            Receipts
          </NavLink>

          <NavLink className="nav-pill" to="/marketplace">
            Marketplace
          </NavLink>

          <NavLink className="nav-pill" to="/lockers">
            Lockers
          </NavLink>

          <NavLink className="nav-pill" to="/marketplace-map-lab">
            Map Lab
          </NavLink>

          <NavLink className="nav-pill" to="/marketplace-match-lab">
            Match Lab
          </NavLink>

          <NavLink className="nav-pill" to="/impact">
            Impact
          </NavLink>

          {!isAuthed && status !== 'loading' && (
            <>
              <NavLink className="nav-pill" to="/login">
                Login
              </NavLink>
              <NavLink className="nav-pill nav-pill-strong" to="/signup">
                Sign up
              </NavLink>
            </>
          )}

          {isAuthed && (
            <div className="nav-user-menu" ref={userMenuRef}>
              <button
                className="nav-pill nav-user-trigger"
                onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
                type="button"
              >
                <span className="nav-avatar" aria-hidden="true">
                  {profileImageUrl ? (
                    <img alt="" src={profileImageUrl} />
                  ) : (
                    profileInitial
                  )}
                </span>
                <span>{profileName}</span>
              </button>
              {isUserMenuOpen ? (
                <div className="nav-user-popover">
                  <div className="nav-menu-item">
                    Credits: ${Number(creditsBalance || 0).toFixed(2)}
                  </div>
                  <NavLink className="nav-menu-item" onClick={() => setIsUserMenuOpen(false)} to="/profile">
                    Profile
                  </NavLink>
                  <button
                    className="nav-menu-item nav-menu-item--danger"
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      logout()
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="pantry-page">
        <NavBar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Inventory />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route
            path="/dashboard/requests/:requestId"
            element={
              <RequireAuth>
                <InventoryRequestListingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/inventory/requests/:requestId"
            element={
              <RequireAuth>
                <InventoryRequestListingPage />
              </RequireAuth>
            }
          />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/lockers" element={<Lockers />} />
          <Route path="/marketplace-map-lab" element={<MarketplaceMapLab />} />
          <Route path="/marketplace-match-lab" element={<MarketplaceMatchLab />} />
          <Route path="/impact" element={<Impact />} />
          <Route
            path="/receipts"
            element={
              <RequireAuth>
                <ReceiptsWorkbench />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
        </Routes>

        <ToastContainer position="bottom-right" autoClose={3000} theme="colored" />
      </div>
    </BrowserRouter>
  )
}
