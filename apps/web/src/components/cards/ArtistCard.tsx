import { Link } from 'react-router-dom'
import { resolveMediaUrl } from '../../lib/media'
import type { Artist } from '../../types'
import Skeleton from '../ui/Skeleton'

interface Props {
  artist: Artist
}

export function ArtistCardSkeleton() {
  return (
    <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-3">
      <Skeleton className="aspect-square w-full rounded-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  )
}

export default function ArtistCard({ artist }: Props) {
  const imageUrl = resolveMediaUrl(artist.imageUrl)

  return (
    <div className="glass-panel surface-hover flex flex-col items-center gap-3 rounded-2xl p-3 text-center">
      <div className="aspect-square w-full rounded-full overflow-hidden bg-border/70">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={artist.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-fg">
            {artist.name[0]}
          </div>
        )}
      </div>

      <div className="overflow-hidden w-full">
        <Link
          to={`/artist/${artist.id}`}
          className="block font-semibold text-sm text-foreground truncate hover:underline"
        >
          {artist.name}
        </Link>
        <p className="text-xs text-muted-fg mt-0.5">Artist</p>
      </div>
    </div>
  )
}
