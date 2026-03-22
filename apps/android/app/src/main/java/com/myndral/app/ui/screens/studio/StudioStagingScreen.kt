package com.myndral.app.ui.screens.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
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
import com.myndral.app.domain.model.StagingArtist
import com.myndral.app.domain.model.StagingAlbum
import com.myndral.app.domain.model.StagingTrack
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@Composable
fun StudioStagingScreen(
    viewModel: StudioStagingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors
    val queue = state.queue

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(horizontal = 20.dp)
            .padding(top = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = "Staging", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
            TextButton(onClick = { viewModel.load() }) {
                Text("Refresh", color = colors.primary)
            }
        }

        if (state.isLoading) {
            LoadingView()
        } else if (queue == null || (queue.artists.isEmpty() && queue.albums.isEmpty() && queue.tracks.isEmpty())) {
            EmptyState(
                title = "Queue is empty",
                message = "No content awaiting review.",
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                // Artists in staging
                if (queue.artists.isNotEmpty()) {
                    SectionHeader("Artists (${queue.totalArtists})")
                    queue.artists.forEach { artist ->
                        StagingArtistCard(
                            artist = artist,
                            onApprove = { viewModel.approveArtist(artist.id) },
                            onReject = { viewModel.rejectArtist(artist.id, "Rejected") },
                        )
                    }
                }

                // Albums in staging
                if (queue.albums.isNotEmpty()) {
                    SectionHeader("Albums (${queue.totalAlbums})")
                    queue.albums.forEach { album ->
                        StagingAlbumCard(
                            album = album,
                            onApprove = { viewModel.approveAlbum(album.id) },
                            onReject = { viewModel.rejectAlbum(album.id, "Rejected") },
                        )
                    }
                }

                // Tracks in staging
                if (queue.tracks.isNotEmpty()) {
                    SectionHeader("Tracks (${queue.totalTracks})")
                    queue.tracks.forEach { track ->
                        StagingTrackCard(
                            track = track,
                            onApprove = { viewModel.approveTrack(track.id) },
                            onReject = { viewModel.rejectTrack(track.id, "Rejected") },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StagingArtistCard(
    artist: StagingArtist,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    val colors = myndralColors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.glassBg, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = artist.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
            StatusBadge(status = artist.status)
        }
        Text(text = "By ${artist.createdByName} (${artist.createdByRole})", fontSize = 12.sp, color = colors.textMuted)
        if (!artist.latestReviewNotes.isNullOrBlank()) {
            Text(text = "Review notes: ${artist.latestReviewNotes}", fontSize = 11.sp, color = colors.textSubtle)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onReject,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.danger),
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("Reject", fontSize = 13.sp)
            }
            Button(
                onClick = onApprove,
                colors = ButtonDefaults.buttonColors(containerColor = colors.success),
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("Approve", fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun StagingAlbumCard(
    album: StagingAlbum,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    val colors = myndralColors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.glassBg, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = album.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
            StatusBadge(status = album.status)
        }
        Text(text = "${album.artistName} · ${album.trackCount} tracks", fontSize = 12.sp, color = colors.textMuted)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onReject,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.danger),
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("Reject", fontSize = 13.sp)
            }
            Button(
                onClick = onApprove,
                colors = ButtonDefaults.buttonColors(containerColor = colors.success),
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("Approve", fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun StagingTrackCard(
    track: StagingTrack,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    val colors = myndralColors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.glassBg, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = track.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
            StatusBadge(status = track.status)
        }
        Text(
            text = "${track.primaryArtistName ?: "Unknown"} · ${track.albumTitle}",
            fontSize = 12.sp,
            color = colors.textMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onReject,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.danger),
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("Reject", fontSize = 13.sp)
            }
            Button(
                onClick = onApprove,
                colors = ButtonDefaults.buttonColors(containerColor = colors.success),
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("Approve", fontSize = 13.sp)
            }
        }
    }
}
