package com.myndral.app.ui.screens.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.domain.model.Track
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@Composable
fun ArtistDetailScreen(
    onBack: () -> Unit,
    onAlbumClick: (String) -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: ArtistDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = colors.text,
                )
            }
        }

        if (state.isLoading) {
            LoadingView(label = "Loading artist…")
        } else if (state.artist != null) {
            val artist = state.artist!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                // Hero image
                RemoteArtwork(
                    uri = artist.imageUrl,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp),
                    cornerRadius = 18.dp,
                )

                // Artist info
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(text = artist.name, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
                    Text(
                        text = "${String.format("%,d", artist.monthlyListeners)} monthly listeners",
                        fontSize = 14.sp,
                        color = colors.textMuted,
                    )
                    if (artist.bio != null) {
                        Text(text = artist.bio, fontSize = 14.sp, color = colors.textMuted)
                    }
                    if (artist.styleTags.isNotEmpty()) {
                        Text(
                            text = artist.styleTags.joinToString(", "),
                            fontSize = 12.sp,
                            color = colors.textSubtle,
                        )
                    }
                }

                // Top Tracks
                if (state.topTracks.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader("Top Tracks")
                        state.topTracks.forEachIndexed { index, track ->
                            TrackRow(
                                track = track,
                                index = index + 1,
                                isFavorite = track.id in state.favoriteTrackIds,
                                isInLibrary = track.id in state.libraryTrackIds,
                                showAlbum = true,
                                onPlay = { onPlayTrack(track, state.topTracks) },
                            )
                        }
                    }
                }

                // Albums
                if (state.albums.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader("Discography")
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(state.albums) { album ->
                                AlbumCard(album = album, onClick = { onAlbumClick(album.id) })
                            }
                        }
                    }
                }
            }
        }
    }
}
