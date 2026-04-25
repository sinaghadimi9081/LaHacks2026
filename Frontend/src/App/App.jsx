import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'

import RequireAuth from '../Auth/RequireAuth.jsx'
import { useAuth } from '../Auth/useAuth.jsx'
import Home from '../Features/Home/Home.jsx'
import Login from '../Features/Auth/Login.jsx'
import Signup from '../Features/Auth/Signup.jsx'
import Profile from '../Features/Profile/Profile.jsx'
import Inventory from '../Features/Inventory/Inventory.jsx'
import Marketplace from '../Features/Marketplace/Marketplace.jsx'
import './app.css'
import 'react-toastify/dist/ReactToastify.css'

function NavBar() {
  const { isAuthed, user, logout, status } = useAuth()

  return (
    <header className="border-b-4 border-ink bg-petal">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink/15 bg-citrus text-lg font-black text-ink shadow-sticker">
            NF
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-ink">
              NeighborFridge
            </p>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-tomato">
              Pantry board
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-3">
          <NavLink className="nav-pill" to="/">
            Home
          </NavLink>

          <NavLink className="nav-pill" to="/inventory">
            Inventory
          </NavLink>

          <NavLink className="nav-pill" to="/marketplace">
            Marketplace
          </NavLink>

          {isAuthed && (
            <NavLink className="nav-pill" to="/profile">
              Profile
            </NavLink>
          )}

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
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-ink/15 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-ink shadow-sticker backdrop-blur md:block">
                {user?.display_name || user?.username}
              </div>
              <button className="nav-pill nav-pill-strong" type="button" onClick={logout}>
                Logout
              </button>
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
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/marketplace" element={<Marketplace />} />
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
