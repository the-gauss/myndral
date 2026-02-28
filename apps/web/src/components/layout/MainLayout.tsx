import type { ReactNode } from 'react'
import Player from './Player'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface Props {
  children: ReactNode
}

export default function MainLayout({ children }: Props) {
  return (
    <div className="flex flex-col h-screen bg-background text-white select-none">
      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden gap-2 p-2">
        <Sidebar />
        <div className="flex flex-col flex-1 rounded-lg bg-surface overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </main>
        </div>
      </div>

      {/* Persistent bottom player */}
      <Player />
    </div>
  )
}
