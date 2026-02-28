import { useParams } from 'react-router-dom'
// TODO: fetch album + track list by ID

export default function Album() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      {/* Album header */}
      <div className="flex items-end gap-6">
        <div className="w-48 h-48 rounded bg-elevated shadow-2xl shrink-0">
          {/* TODO: album cover */}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/70">Album</p>
          <h1 className="text-4xl font-black mt-1 mb-2">Album Title</h1>
          <p className="text-sm text-muted">
            Artist Name · <span>2025</span> · <span>12 songs</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="px-8 py-3 rounded-full bg-accent text-black font-bold hover:scale-105 transition-transform">
          Play
        </button>
        <button className="px-6 py-2 rounded-full border border-muted text-sm font-bold hover:border-white transition-colors">
          Save
        </button>
      </div>

      {/* Track list */}
      <section>
        {/* TODO: render tracks via <TrackRow /> */}
        <p className="text-muted text-sm">No tracks yet.</p>
      </section>

      <p className="text-xs text-subtle">id: {id}</p>
    </div>
  )
}
