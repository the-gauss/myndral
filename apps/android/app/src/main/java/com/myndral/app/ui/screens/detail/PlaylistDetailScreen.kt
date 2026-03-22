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
fun PlaylistDetailScreen(
    onBack: () -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: PlaylistDetailViewModel = hiltViewModel(),
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
            LoadingView(label = "Loading playlist…")
        } else if (state.playlist != null) {
            val playlist = state.playlist!!
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
                    uri = playlist.coverUrl,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f),
                    cornerRadius = 18.dp,
                )

                // Playlist info
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(text = playlist.name, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
                    if (playlist.description != null) {
                        Text(text = playlist.description, fontSize = 14.sp, color = colors.textMuted)
                    }
                    val meta = buildString {
                        if (!playlist.ownerDisplayName.isNullOrBlank()) append(playlist.ownerDisplayName)
                        val count = playlist.trackCount ?: playlist.tracks.size
                        if (isNotEmpty()) append(" · ")
                        append("$count songs")
                    }
                    Text(text = meta, fontSize = 13.sp, color = colors.textSubtle)
                }

                // Tracks
                if (playlist.tracks.isNotEmpty()) {
                    SectionHeader("Tracks")
                    playlist.tracks.forEachIndexed { index, track ->
                        TrackRow(
                            track = track,
                            index = index + 1,
                            isFavorite = track.id in state.favoriteTrackIds,
                            isInLibrary = track.id in state.libraryTrackIds,
                            showAlbum = true,
                            onPlay = { onPlayTrack(track, playlist.tracks) },
                        )
                    }
                } else {
                    EmptyState(
                        title = "Empty playlist",
                        message = "No tracks have been added to this playlist yet.",
                    )
                }
            }
        }
    }
}
