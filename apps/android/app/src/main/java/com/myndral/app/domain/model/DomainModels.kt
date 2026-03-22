package com.myndral.app.domain.model

/**
 * Listener-facing domain models — mirrors the TypeScript types in apps/ios/src/types/domain.ts.
 * These are the canonical in-memory representations used across ViewModels and UI.
 * DTOs live in data/api/dto and are mapped to these via repository layer.
 */

data class Artist(
    val id: String,
    val name: String,
    val slug: String,
    val bio: String?,
    val imageUrl: String?,
    val monthlyListeners: Long,
    val verified: Boolean,
    val styleTags: List<String>,
)

data class Album(
    val id: String,
    val title: String,
    val artistId: String,
    val artist: Artist,
    val coverUrl: String?,
    val releaseDate: String,
    val albumType: AlbumType,
    val genreTags: List<String>,
    val trackCount: Int,
)

enum class AlbumType { ALBUM, SINGLE, EP, COMPILATION }

data class Track(
    val id: String,
    val title: String,
    val albumId: String,
    val album: Album,
    val artistId: String,
    val artist: Artist,
    val trackNumber: Int,
    val durationMs: Long,
    val audioUrl: String?,
    val playCount: Long,
    val explicit: Boolean,
)

data class Playlist(
    val id: String,
    val name: String,
    val description: String?,
    val coverUrl: String?,
    val ownerId: String,
    val ownerDisplayName: String?,
    val isPublic: Boolean,
    val isAiCurated: Boolean,
    val tracks: List<Track>,
    val trackCount: Int?,
    val followerCount: Int?,
    val totalDurationMs: Long?,
    val canEdit: Boolean?,
    val isInLibrary: Boolean?,
    val createdAt: String,
    val updatedAt: String,
)

enum class SubscriptionPlan { FREE, PREMIUM_MONTHLY, PREMIUM_ANNUAL }

enum class UserRole { LISTENER, CONTENT_EDITOR, CONTENT_REVIEWER, ADMIN }

data class User(
    val id: String,
    val username: String,
    val email: String,
    val displayName: String,
    val avatarUrl: String?,
    val role: UserRole,
    val subscriptionPlan: SubscriptionPlan,
    val createdAt: String,
)

data class Paginated<T>(
    val items: List<T>,
    val total: Int,
    val limit: Int,
    val offset: Int,
)

data class SearchResults(
    val tracks: Paginated<Track>,
    val albums: Paginated<Album>,
    val artists: Paginated<Artist>,
    val playlists: Paginated<Playlist>,
)

data class CollectionState(
    val libraryTrackIds: List<String>,
    val libraryAlbumIds: List<String>,
    val libraryArtistIds: List<String>,
    val libraryPlaylistIds: List<String>,
    val favoriteTrackIds: List<String>,
    val favoriteAlbumIds: List<String>,
    val favoriteArtistIds: List<String>,
)

data class AuthResult(
    val accessToken: String,
    val tokenType: String,
    val expiresIn: Int,
    val user: User,
)

enum class RepeatMode { NONE, ONE, ALL }

/** Returns true if this role has access to the Creator Studio. */
fun UserRole.hasStudioAccess(): Boolean =
    this == UserRole.CONTENT_EDITOR || this == UserRole.CONTENT_REVIEWER || this == UserRole.ADMIN

/** Returns true if this role can approve / reject content in Staging. */
fun UserRole.canReview(): Boolean =
    this == UserRole.CONTENT_REVIEWER || this == UserRole.ADMIN

/** Returns true if this role can create artists, albums, and tracks. */
fun UserRole.canEdit(): Boolean =
    this == UserRole.CONTENT_EDITOR || this == UserRole.ADMIN
