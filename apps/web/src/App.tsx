import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Album from './pages/Album'
import Artist from './pages/Artist'
import Home from './pages/Home'
import Library from './pages/Library'
import Playlist from './pages/Playlist'
import Search from './pages/Search'

export default function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/search"        element={<Search />} />
          <Route path="/library"       element={<Library />} />
          <Route path="/artist/:id"    element={<Artist />} />
          <Route path="/album/:id"     element={<Album />} />
          <Route path="/playlist/:id"  element={<Playlist />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}
