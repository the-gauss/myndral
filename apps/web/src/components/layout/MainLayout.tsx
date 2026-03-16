import type { ReactNode } from 'react'
import Player from './Player'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface Props {
  children: ReactNode
}

export default function MainLayout({ children }: Props) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background/30 text-foreground select-none">
      {/* Sidebar + content area */}
      <div className="relative z-10 flex flex-1 overflow-hidden gap-3 p-3">
        <Sidebar />
        <div className="glass-panel-strong soft-enter flex flex-col flex-1 overflow-hidden rounded-[32px]">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-8 py-8">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom player bar */}
      <div className="relative z-10 px-3 pb-3">
        <Player />
      </div>
    </div>
  )
}
