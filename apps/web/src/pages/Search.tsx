import { Search as SearchIcon } from 'lucide-react'
import { useState } from 'react'

// TODO: debounce input and call GET /v1/search?q=...

export default function Search() {
  const [query, setQuery] = useState('')

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative max-w-lg">
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
        <input
          type="text"
          placeholder="What do you want to play?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 rounded-full bg-white text-black placeholder-gray-500 text-sm font-medium focus:outline-none"
        />
      </div>

      {query ? (
        <div className="space-y-6">
          {/* TODO: render SearchResults: tracks, albums, artists, playlists */}
          <p className="text-muted text-sm">Searching for "{query}"…</p>
        </div>
      ) : (
        <section>
          <h2 className="text-xl font-bold mb-4">Browse all</h2>
          {/* TODO: genre/mood category cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* placeholder genre cards */}
          </div>
        </section>
      )}
    </div>
  )
}
