// TODO: fetch user's playlists, saved albums, and followed artists

export default function Library() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Library</h1>
        {/* TODO: filter tabs (Playlists / Albums / Artists), sort, create playlist button */}
      </div>

      {/* TODO: render library items list */}
      <p className="text-muted text-sm">Your library is empty. Start by following some artists.</p>
    </div>
  )
}
