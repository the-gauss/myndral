package com.myndral.app.ui.screens.library

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.domain.model.Track
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@Composable
fun LibraryScreen(
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    onPlaylistClick: (String) -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: LibraryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors
    var showPlaylistSheet by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(horizontal = 20.dp)
            .padding(top = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Your Library",
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.text,
        )

        // Segmented control
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surfaceRaised, RoundedCornerShape(22.dp))
                .padding(4.dp),
        ) {
            listOf(LibraryView.SAVED to "Saved", LibraryView.FAVORITES to "Favorites").forEach { (view, label) ->
                val selected = state.view == view
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(
                            if (selected) colors.primaryDim else Transparent,
                            RoundedCornerShape(18.dp),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    TextButton(
                        onClick = { viewModel.setView(view) },
                        modifier = Modifier.fillMaxWidth().height(42.dp),
                    ) {
                        Text(
                            text = label,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selected) colors.primary else colors.textMuted,
                        )
                    }
                }
            }
        }

        // Create Playlist button
        Button(
            onClick = { showPlaylistSheet = true },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(22.dp),
            colors = ButtonDefaults.buttonColors(containerColor = colors.cta, contentColor = colors.ctaText),
        ) {
            Text(text = "Create Playlist", fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }

        if (state.isLoading) {
            LoadingView()
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (state.view == LibraryView.SAVED) {
                    // Artists
                    SectionBlock(title = "Artists", count = state.libraryArtists.size) {
                        if (state.libraryArtists.isEmpty()) {
                            Text("No saved artists yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.libraryArtists.forEach { artist ->
                                LibraryRowItem(
                                    title = artist.name,
                                    subtitle = "Saved artist",
                                    icon = Icons.Default.Mic,
                                    onClick = { onArtistClick(artist.id) },
                                )
                            }
                        }
                    }

                    // Albums
                    SectionBlock(title = "Albums", count = state.libraryAlbums.size) {
                        if (state.libraryAlbums.isEmpty()) {
                            Text("No saved albums yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.libraryAlbums.forEach { album ->
                                LibraryRowItem(
                                    title = album.title,
                                    subtitle = "${album.artist.name} · ${album.trackCount} songs",
                                    icon = Icons.Default.Album,
                                    onClick = { onAlbumClick(album.id) },
                                )
                            }
                        }
                    }

                    // Playlists
                    SectionBlock(title = "Playlists", count = state.libraryPlaylists.size) {
                        if (state.libraryPlaylists.isEmpty()) {
                            Text("No saved playlists yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.libraryPlaylists.forEach { playlist ->
                                PlaylistListItem(playlist = playlist, onClick = { onPlaylistClick(playlist.id) })
                            }
                        }
                    }

                    // Songs
                    SectionBlock(title = "Songs", count = state.libraryTracks.size) {
                        if (state.libraryTracks.isEmpty()) {
                            Text("No saved songs yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.libraryTracks.forEachIndexed { index, track ->
                                TrackRow(
                                    track = track,
                                    index = index + 1,
                                    isFavorite = track.id in state.favoriteTrackIds,
                                    isInLibrary = true,
                                    showAlbum = true,
                                    onPlay = { onPlayTrack(track, state.libraryTracks) },
                                )
                            }
                        }
                    }
                } else {
                    // Favorites view
                    SectionBlock(title = "Favorite Artists", count = state.favoriteArtists.size) {
                        if (state.favoriteArtists.isEmpty()) {
                            Text("No favorite artists yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.favoriteArtists.forEach { artist ->
                                LibraryRowItem(
                                    title = artist.name,
                                    subtitle = "Liked artist",
                                    icon = Icons.Default.Favorite,
                                    onClick = { onArtistClick(artist.id) },
                                )
                            }
                        }
                    }

                    SectionBlock(title = "Favorite Albums", count = state.favoriteAlbums.size) {
                        if (state.favoriteAlbums.isEmpty()) {
                            Text("No favorite albums yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.favoriteAlbums.forEach { album ->
                                LibraryRowItem(
                                    title = album.title,
                                    subtitle = "${album.artist.name} · liked album",
                                    icon = Icons.Default.Favorite,
                                    onClick = { onAlbumClick(album.id) },
                                )
                            }
                        }
                    }

                    SectionBlock(title = "Favorite Songs", count = state.favoriteTracks.size) {
                        if (state.favoriteTracks.isEmpty()) {
                            Text("No favorite songs yet.", fontSize = 14.sp, color = colors.textMuted)
                        } else {
                            state.favoriteTracks.forEachIndexed { index, track ->
                                TrackRow(
                                    track = track,
                                    index = index + 1,
                                    isFavorite = true,
                                    isInLibrary = track.id in state.libraryTrackIds,
                                    showAlbum = true,
                                    onPlay = { onPlayTrack(track, state.favoriteTracks) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    PlaylistSheet(
        open = showPlaylistSheet,
        onClose = { showPlaylistSheet = false },
        onCreate = { name, desc, isPublic ->
            viewModel.createPlaylist(name, desc, isPublic)
        },
    )
}

private val Transparent = androidx.compose.ui.graphics.Color.Transparent

@Composable
private fun SectionBlock(
    title: String,
    count: Int,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = myndralColors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.glassBg, RoundedCornerShape(18.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = title,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = colors.text,
            )
            Text(
                text = "$count ${if (count == 1) "item" else "items"}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textSubtle,
            )
        }
        content()
    }
}

@Composable
private fun LibraryRowItem(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    val colors = myndralColors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surfaceRaised, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(colors.primaryDim, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
            Text(text = subtitle, fontSize = 12.sp, color = colors.textMuted)
        }
    }
}
