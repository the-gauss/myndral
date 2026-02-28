import { Search as SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import AlbumCard from '../components/cards/AlbumCard'
import ArtistCard from '../components/cards/ArtistCard'
import TrackRow from '../components/cards/TrackRow'
import SectionHeader from '../components/ui/SectionHeader'
import Skeleton from '../components/ui/Skeleton'
import { useSearch } from '../hooks/useCatalog'

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Search() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query)
  const { data, isLoading } = useSearch(debouncedQuery)

  const hasResults = data && (
    data.tracks.items.length > 0 ||
    data.albums.items.length > 0 ||
    data.artists.items.length > 0
  )

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative max-w-md">
        <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-fg" />
        <input
          type="text"
          placeholder="Artists, albums, songs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-10 pr-4 py-2.5 rounded-full bg-background border border-border
                     text-foreground placeholder:text-muted-fg text-sm focus:outline-none
                     focus:ring-2 focus:ring-accent/40 transition-shadow"
        />
      </div>

      {/* Loading shimmer */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-2">
              <Skeleton className="w-10 h-10 rounded" />
              <Skeleton className="flex-1 h-4" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && debouncedQuery && (
        hasResults ? (
          <div className="space-y-8">
            {data.tracks.items.length > 0 && (
              <section>
                <SectionHeader title="Songs" />
                {data.tracks.items.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i + 1}
                    queue={data.tracks.items}
                    showAlbum
                  />
                ))}
              </section>
            )}

            {data.artists.items.length > 0 && (
              <section>
                <SectionHeader title="Artists" />
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {data.artists.items.map((artist) => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
                </div>
              </section>
            )}

            {data.albums.items.length > 0 && (
              <section>
                <SectionHeader title="Albums" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {data.albums.items.map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="text-muted-fg text-sm">No results for &ldquo;{debouncedQuery}&rdquo;</p>
        )
      )}

      {/* Empty state — no query */}
      {!debouncedQuery && (
        <p className="text-muted-fg text-sm">Start typing to search.</p>
      )}
    </div>
  )
}
