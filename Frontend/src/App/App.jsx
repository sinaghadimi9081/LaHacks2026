import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'

import RequireAuth from '../Auth/RequireAuth.jsx'
import { useAuth } from '../Auth/useAuth.jsx'
import Home from '../Features/Home/Home.jsx'
import Login from '../Features/Auth/Login.jsx'
import Signup from '../Features/Auth/Signup.jsx'
import Profile from '../Features/Profile/Profile.jsx'
import './app.css'
import 'react-toastify/dist/ReactToastify.css'

function NavBar() {
  const { isAuthed, user, logout, status } = useAuth()

  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black text-white">
            NF
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
              NeighborFridge
            </p>
            <p className="text-sm text-slate-500">Frontend shell</p>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          <NavLink className="nav-pill" to="/">
            Home
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
              <div className="hidden rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 md:block">
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_35%),linear-gradient(180deg,_#f7fdf8_0%,_#eef6ef_100%)] text-slate-900">
        <NavBar />

        <Routes>
          <Route path="/" element={<Home />} />
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
