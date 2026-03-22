package com.myndral.app.domain.model

/**
 * Creator Studio domain models — mirrors apps/ios/src/types/studio.ts.
 * Kept in a separate file to keep the privilege boundary visible.
 */

enum class ContentStatus { REVIEW, PUBLISHED, ARCHIVED }

enum class StudioAlbumType { ALBUM, SINGLE, EP, COMPILATION }

enum class MusicGenerationStatus { PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED }

data class Genre(
    val id: String,
    val name: String,
    val slug: String,
)

data class ArtistItem(
    val id: String,
    val name: String,
    val slug: String,
    val bio: String?,
    val imageUrl: String?,
    val headerImageUrl: String?,
    val status: ContentStatus,
    val personaPrompt: String?,
    val styleTags: List<String>,
    val genreIds: List<String>,
    val createdAt: String,
    val updatedAt: String,
)

data class AlbumItem(
    val id: String,
    val title: String,
    val slug: String,
    val artistId: String,
    val artistName: String,
    val coverUrl: String?,
    val description: String?,
    val releaseDate: String?,
    val albumType: StudioAlbumType,
    val status: ContentStatus,
    val trackCount: Int,
    val genreIds: List<String>,
    val createdAt: String,
    val updatedAt: String,
)

data class TrackItem(
    val id: String,
    val title: String,
    val albumId: String,
    val albumTitle: String,
    val albumType: StudioAlbumType,
    val primaryArtistId: String?,
    val primaryArtistName: String?,
    val trackNumber: Int,
    val discNumber: Int,
    val durationMs: Long?,
    val explicit: Boolean,
    val status: ContentStatus,
    val genreIds: List<String>,
    val createdAt: String,
    val updatedAt: String,
)

data class MusicGenerationJob(
    val id: String,
    val status: MusicGenerationStatus,
    val artistId: String,
    val albumId: String,
    val trackTitle: String,
    val explicit: Boolean,
    val prompt: String?,
    val lyrics: String?,
    val outputStorageUrl: String?,
    val errorMessage: String?,
    val createdAt: String,
    val updatedAt: String,
    val artistName: String?,
    val albumTitle: String?,
)

data class StagingArtist(
    val id: String,
    val name: String,
    val slug: String,
    val bio: String?,
    val status: ContentStatus,
    val createdByName: String,
    val createdByRole: String,
    val latestReviewAction: String?,
    val latestReviewNotes: String?,
    val createdAt: String,
)

data class StagingAlbum(
    val id: String,
    val title: String,
    val slug: String,
    val artistName: String,
    val albumType: StudioAlbumType,
    val trackCount: Int,
    val status: ContentStatus,
    val createdByName: String,
    val createdByRole: String,
    val latestReviewAction: String?,
    val latestReviewNotes: String?,
    val createdAt: String,
)

data class StagingTrack(
    val id: String,
    val title: String,
    val primaryArtistName: String?,
    val albumTitle: String,
    val albumType: StudioAlbumType,
    val durationMs: Long?,
    val explicit: Boolean,
    val status: ContentStatus,
    val outputStorageUrl: String?,
    val createdByName: String,
    val createdByRole: String,
    val latestReviewAction: String?,
    val latestReviewNotes: String?,
    val createdAt: String,
)

data class StagingQueue(
    val artists: List<StagingArtist>,
    val albums: List<StagingAlbum>,
    val tracks: List<StagingTrack>,
    val totalArtists: Int,
    val totalAlbums: Int,
    val totalTracks: Int,
)

/** Formats ContentStatus to a display-friendly string. */
fun ContentStatus.humanize(): String = name.lowercase().replaceFirstChar { it.uppercase() }

/** Formats a duration in milliseconds to mm:ss. */
fun Long?.formatDurationMs(): String {
    if (this == null || this <= 0L) return "-"
    val totalSeconds = this / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "$minutes:${seconds.toString().padStart(2, '0')}"
}
