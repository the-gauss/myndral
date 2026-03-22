package com.myndral.app.ui.screens.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.domain.model.Track
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@Composable
fun AlbumDetailScreen(
    onBack: () -> Unit,
    onArtistClick: (String) -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: AlbumDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
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
            LoadingView(label = "Loading album…")
        } else if (state.album != null) {
            val album = state.album!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Cover
                RemoteArtwork(
                    uri = album.coverUrl,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f),
                    cornerRadius = 18.dp,
                )

                // Album metadata
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(text = album.title, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
                    TextButton(
                        onClick = { onArtistClick(album.artistId) },
                        contentPadding = PaddingValues(0.dp),
                    ) {
                        Text(text = album.artist.name, fontSize = 16.sp, color = colors.primary)
                    }
                    Text(
                        text = "${album.albumType.name.lowercase().replaceFirstChar { it.uppercase() }} · ${album.releaseDate.take(4)}",
                        fontSize = 13.sp,
                        color = colors.textMuted,
                    )
                    if (album.genreTags.isNotEmpty()) {
                        Text(
                            text = album.genreTags.joinToString(", "),
                            fontSize = 12.sp,
                            color = colors.textSubtle,
                        )
                    }
                }

                // Track list
                if (state.tracks.isNotEmpty()) {
                    SectionHeader("Tracks")
                    state.tracks.forEachIndexed { index, track ->
                        TrackRow(
                            track = track,
                            index = index + 1,
                            isFavorite = track.id in state.favoriteTrackIds,
                            isInLibrary = track.id in state.libraryTrackIds,
                            showAlbum = false,
                            onPlay = { onPlayTrack(track, state.tracks) },
                        )
                    }
                }
            }
        }
    }
}
