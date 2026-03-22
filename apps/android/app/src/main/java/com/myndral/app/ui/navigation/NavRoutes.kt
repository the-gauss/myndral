package com.myndral.app.ui.navigation

/** Navigation route constants. Matches the Expo Router file structure of the iOS app. */
object NavRoutes {
    // Auth
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val CHOOSE_PLAN = "choose_plan"

    // Main tabs
    const val HOME = "home"
    const val SEARCH = "search"
    const val LIBRARY = "library"
    const val ACCOUNT = "account"

    // Detail
    const val ALBUM_DETAIL = "album/{albumId}"
    const val ARTIST_DETAIL = "artist/{artistId}"
    const val PLAYLIST_DETAIL = "playlist/{playlistId}"

    // Player
    const val PLAYER = "player"

    // Studio
    const val STUDIO_ACCESS = "studio_access"
    const val STUDIO_ARTISTS = "studio_artists"
    const val STUDIO_ALBUMS = "studio_albums"
    const val STUDIO_SONGS = "studio_songs"
    const val STUDIO_STAGING = "studio_staging"

    // Helpers for navigation with arguments
    fun albumDetail(albumId: String) = "album/$albumId"
    fun artistDetail(artistId: String) = "artist/$artistId"
    fun playlistDetail(playlistId: String) = "playlist/$playlistId"
}
