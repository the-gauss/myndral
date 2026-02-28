import { useNavigate } from 'react-router-dom'
import type { Artist } from '../../types'

interface Props {
  artist: Artist
}

export default function ArtistCard({ artist }: Props) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/artist/${artist.id}`)}
      className="flex flex-col items-center p-4 rounded-lg bg-elevated hover:bg-highlight transition-colors cursor-pointer text-left w-full"
    >
      <div className="w-full aspect-square rounded-full bg-surface overflow-hidden mb-4">
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-highlight flex items-center justify-center text-3xl font-bold text-muted">
            {artist.name[0]}
          </div>
        )}
      </div>
      <p className="font-semibold text-sm text-white truncate w-full">{artist.name}</p>
      <p className="text-xs text-muted mt-1">Artist</p>
    </button>
  )
}
