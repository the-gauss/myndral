import { useParams } from 'react-router-dom'
// TODO: fetch artist by ID, top tracks, and discography

export default function Artist() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative h-60 rounded-lg bg-elevated flex items-end p-6">
        {/* TODO: artist image background */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-1">Artist</p>
          <h1 className="text-5xl font-black">Artist Name</h1>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="px-8 py-3 rounded-full bg-accent text-black font-bold hover:scale-105 transition-transform">
          Play
        </button>
        <button className="px-6 py-2 rounded-full border border-muted text-sm font-bold hover:border-white transition-colors">
          Follow
        </button>
      </div>

      {/* Popular tracks */}
      <section>
        <h2 className="text-xl font-bold mb-3">Popular</h2>
        {/* TODO: top 5 tracks via <TrackRow /> */}
      </section>

      {/* Discography */}
      <section>
        <h2 className="text-xl font-bold mb-3">Discography</h2>
        {/* TODO: albums/singles grid via <AlbumCard /> */}
      </section>

      <p className="text-xs text-subtle">id: {id}</p>
    </div>
  )
}
