// TODO: fetch featured playlists, new releases, and recommended tracks from API

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Good evening</h2>
        {/* TODO: Featured / pinned playlists grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {/* placeholder */}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">New releases</h2>
        {/* TODO: <AlbumCard /> grid */}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Featured artists</h2>
        {/* TODO: <ArtistCard /> grid */}
      </section>
    </div>
  )
}
