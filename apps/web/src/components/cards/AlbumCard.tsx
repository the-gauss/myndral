import { Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Album } from '../../types'
import { resolveMediaUrl } from '../../lib/media'
import Skeleton from '../ui/Skeleton'

interface Props {
  album: Album
  onPlay?: () => void
}

export function AlbumCardSkeleton() {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl p-3">
      <Skeleton className="aspect-square w-full rounded" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export default function AlbumCard({ album, onPlay }: Props) {
  const coverUrl = resolveMediaUrl(album.coverUrl)

  return (
    <div className="glass-panel surface-hover group flex flex-col gap-3 rounded-2xl p-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-border flex items-center justify-center">
            <span className="text-muted-fg text-xs">No cover</span>
          </div>
        )}
        {onPlay && (
          <button
            onClick={onPlay}
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/20 opacity-0 translate-y-1
                       group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500"
            aria-label={`Play ${album.title}`}
          >
            <Play size={16} fill="currentColor" />
          </button>
        )}
      </div>

      <div className="overflow-hidden">
        <Link
          to={`/album/${album.id}`}
          className="block font-semibold text-sm text-foreground truncate hover:underline"
        >
          {album.title}
        </Link>
        <p className="text-xs text-muted-fg truncate mt-0.5">
          {new Date(album.releaseDate).getFullYear()} · <Link
            to={`/artist/${album.artistId}`}
            className="hover:underline"
          >
            {album.artist.name}
          </Link>
        </p>
      </div>
    </div>
  )
}
