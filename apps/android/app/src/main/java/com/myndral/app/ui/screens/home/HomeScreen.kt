package com.myndral.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.domain.model.Track
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors
import java.util.Calendar

private fun greeting(): String = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
    in 5..11 -> "Good morning"
    in 12..17 -> "Good afternoon"
    else -> "Good evening"
}

@Composable
fun HomeScreen(
    displayName: String?,
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    onPlaylistClick: (String) -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 20.dp, bottom = 120.dp), // bottom padding for mini player
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        // Greeting header
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "${greeting()}${if (!displayName.isNullOrBlank()) ", $displayName" else ""}.",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                color = colors.text,
            )
            Text(
                text = "Fresh releases, browse picks, and saved listening cues in one place.",
                fontSize = 14.sp,
                color = colors.textMuted,
            )
        }

        if (state.isLoading) {
            LoadingView(label = "Loading your feed...")
        } else {
            // New Releases
            if (state.albums.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "New Releases")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.albums) { album ->
                            AlbumCard(album = album, onClick = { onAlbumClick(album.id) })
                        }
                    }
                }
            }

            // Featured Artists
            if (state.artists.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "Featured Artists")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.artists) { artist ->
                            ArtistCard(artist = artist, onClick = { onArtistClick(artist.id) })
                        }
                    }
                }
            }

            // Trending Tracks
            if (state.featuredTracks.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "Trending Tracks")
                    state.featuredTracks.forEachIndexed { index, track ->
                        TrackRow(
                            track = track,
                            index = index + 1,
                            isFavorite = track.id in state.favoriteTrackIds,
                            isInLibrary = track.id in state.libraryTrackIds,
                            showAlbum = true,
                            onPlay = { onPlayTrack(track, state.featuredTracks) },
                        )
                    }
                }
            }

            // Artists (browse)
            if (state.artists.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "Artists")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.artists) { artist ->
                            ArtistCard(artist = artist, onClick = { onArtistClick(artist.id) })
                        }
                    }
                }
            }

            // Albums (browse)
            if (state.albums.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "Albums")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.albums) { album ->
                            AlbumCard(album = album, onClick = { onAlbumClick(album.id) })
                        }
                    }
                }
            }

            // Songs (browse)
            if (state.browseTracks.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "Songs")
                    state.browseTracks.forEachIndexed { index, track ->
                        TrackRow(
                            track = track,
                            index = index + 1,
                            isFavorite = track.id in state.favoriteTrackIds,
                            isInLibrary = track.id in state.libraryTrackIds,
                            showAlbum = true,
                            onPlay = { onPlayTrack(track, state.browseTracks) },
                        )
                    }
                }
            }

            // Playlists
            if (state.playlists.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(title = "Playlists")
                    state.playlists.forEach { playlist ->
                        PlaylistListItem(
                            playlist = playlist,
                            onClick = { onPlaylistClick(playlist.id) },
                        )
                    }
                }
            }
        }
    }
}
