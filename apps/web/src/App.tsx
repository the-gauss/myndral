import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import { getMe } from './services/auth'
import { useUserStore } from './store/userStore'
import Album from './pages/Album'
import Albums from './pages/Albums'
import Artist from './pages/Artist'
import Artists from './pages/Artists'
import Home from './pages/Home'
import Library from './pages/Library'
import Login from './pages/Login'
import Playlist from './pages/Playlist'
import Playlists from './pages/Playlists'
import Search from './pages/Search'
import Songs from './pages/Songs'

export default function App() {
  const accessToken = useUserStore((s) => s.accessToken)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const setUser = useUserStore((s) => s.setUser)
  const clearUser = useUserStore((s) => s.clearUser)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrapAuth() {
      if (!accessToken) {
        if (!cancelled) setAuthChecked(true)
        return
      }

      try {
        const me = await getMe()
        if (!cancelled) setUser(me, accessToken)
      } catch {
        if (!cancelled) clearUser()
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }

    void bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [accessToken, clearUser, setUser])

  if (!authChecked) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center text-sm text-muted-fg">
        Verifying session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/login"         element={<Navigate to="/" replace />} />
          <Route path="/"              element={<Home />} />
          <Route path="/search"        element={<Search />} />
          <Route path="/artists"       element={<Artists />} />
          <Route path="/albums"        element={<Albums />} />
          <Route path="/songs"         element={<Songs />} />
          <Route path="/playlists"     element={<Playlists />} />
          <Route path="/library"       element={<Library />} />
          <Route path="/artist/:id"    element={<Artist />} />
          <Route path="/album/:id"     element={<Album />} />
          <Route path="/playlist/:id"  element={<Playlist />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}
