import { useNavigate } from 'react-router-dom'
import type { Album } from '../../types'

interface Props {
  album: Album
}

export default function AlbumCard({ album }: Props) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/album/${album.id}`)}
      className="flex flex-col p-4 rounded-lg bg-elevated hover:bg-highlight transition-colors cursor-pointer text-left w-full"
    >
      <div className="w-full aspect-square rounded bg-surface overflow-hidden mb-4 shadow-lg">
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-highlight" />
        )}
      </div>
      <p className="font-semibold text-sm text-white truncate">{album.title}</p>
      <p className="text-xs text-muted mt-1 truncate">
        {new Date(album.releaseDate).getFullYear()} · {album.artist.name}
      </p>
    </button>
  )
}
