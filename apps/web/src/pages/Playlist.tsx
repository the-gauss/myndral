import { useParams } from 'react-router-dom'
// TODO: fetch playlist + tracks by ID

export default function Playlist() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      {/* Playlist header */}
      <div className="flex items-end gap-6">
        <div className="w-48 h-48 rounded bg-elevated shadow-2xl shrink-0">
          {/* TODO: playlist cover */}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/70">Playlist</p>
          <h1 className="text-4xl font-black mt-1 mb-2">Playlist Title</h1>
          <p className="text-sm text-muted">0 songs</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="px-8 py-3 rounded-full bg-accent text-black font-bold hover:scale-105 transition-transform">
          Play
        </button>
        {/* TODO: edit, share, delete buttons based on ownership */}
      </div>

      {/* Track list */}
      <section>
        {/* TODO: render tracks via <TrackRow showAlbum /> */}
        <p className="text-muted text-sm">No tracks in this playlist.</p>
      </section>

      <p className="text-xs text-subtle">id: {id}</p>
    </div>
  )
}
