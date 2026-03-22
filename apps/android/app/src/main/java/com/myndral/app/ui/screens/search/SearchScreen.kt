package com.myndral.app.ui.screens.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
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

@Composable
fun SearchScreen(
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    onPlaylistClick: (String) -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors
    val results = state.results

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(horizontal = 20.dp)
            .padding(top = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Search",
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.text,
        )

        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::onQueryChange,
            placeholder = { Text("Songs, albums, artists…") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = null,
                    tint = colors.textMuted,
                )
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.surfaceBorder,
            ),
            singleLine = true,
        )

        if (state.isLoading) {
            LoadingView(label = "Searching...")
        } else if (state.query.isBlank() || results == null) {
            EmptyState(
                title = "Search Myndral",
                message = "Find songs, albums, artists, and playlists.",
                icon = Icons.Default.Search,
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                // Tracks
                if (results.tracks.items.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader("Songs")
                        results.tracks.items.forEachIndexed { index, track ->
                            TrackRow(
                                track = track,
                                index = index + 1,
                                isFavorite = false,
                                isInLibrary = false,
                                showAlbum = true,
                                onPlay = { onPlayTrack(track, results.tracks.items) },
                            )
                        }
                    }
                }

                // Albums
                if (results.albums.items.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader("Albums")
                        results.albums.items.forEach { album ->
                            AlbumCard(album = album, onClick = { onAlbumClick(album.id) })
                        }
                    }
                }

                // Artists
                if (results.artists.items.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader("Artists")
                        results.artists.items.forEach { artist ->
                            ArtistCard(artist = artist, onClick = { onArtistClick(artist.id) })
                        }
                    }
                }

                // Playlists
                if (results.playlists.items.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader("Playlists")
                        results.playlists.items.forEach { playlist ->
                            PlaylistListItem(
                                playlist = playlist,
                                onClick = { onPlaylistClick(playlist.id) },
                            )
                        }
                    }
                }

                // Empty result
                if (results.tracks.items.isEmpty() && results.albums.items.isEmpty()
                    && results.artists.items.isEmpty() && results.playlists.items.isEmpty()
                ) {
                    EmptyState(
                        title = "No results",
                        message = "Nothing matched \"${state.query}\". Try different keywords.",
                    )
                }
            }
        }
    }
}
