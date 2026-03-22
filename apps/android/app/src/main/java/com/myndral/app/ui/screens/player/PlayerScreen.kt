package com.myndral.app.ui.screens.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.domain.model.RepeatMode
import com.myndral.app.player.PlayerViewModel
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@Composable
fun PlayerScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors
    val track = state.currentTrack

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(horizontal = 20.dp)
            .padding(top = 12.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        // Back button
        TextButton(
            onClick = onBack,
            contentPadding = PaddingValues(0.dp),
        ) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = "Close player",
                tint = colors.textMuted,
                modifier = Modifier.size(18.dp),
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = if (track != null) "Now Playing" else "Close",
                fontSize = 14.sp,
                color = colors.textMuted,
            )
        }

        if (track == null) {
            Spacer(modifier = Modifier.weight(1f))
            EmptyState(
                title = "Nothing is playing",
                message = "Start playback from Home, Search, Library, or any album or playlist screen.",
                icon = Icons.Default.MusicOff,
            )
            Spacer(modifier = Modifier.weight(1f))
        } else {
            Spacer(modifier = Modifier.height(12.dp))

            GlassSurface(
                modifier = Modifier.fillMaxWidth(),
                heavy = true,
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    // Album art
                    RemoteArtwork(
                        uri = track.album.coverUrl,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f),
                        cornerRadius = 16.dp,
                    )

                    // Track info
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = track.title,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = colors.text,
                        )
                        Text(
                            text = "${track.artist.name} · ${track.album.title}",
                            fontSize = 15.sp,
                            color = colors.textMuted,
                        )
                        if (state.isBuffering) {
                            Text(
                                text = "Buffering…",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = colors.primary,
                            )
                        }
                    }

                    // Progress
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Slider(
                            value = state.progress,
                            onValueChange = { viewModel.seekTo(it) },
                            colors = SliderDefaults.colors(
                                thumbColor = colors.primary,
                                activeTrackColor = colors.primary,
                                inactiveTrackColor = colors.fillSoft,
                            ),
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = state.elapsedMs.toMinutesSeconds(),
                                fontSize = 12.sp,
                                color = colors.textMuted,
                            )
                            Text(
                                text = state.durationMs.toMinutesSeconds(),
                                fontSize = 12.sp,
                                color = colors.textMuted,
                            )
                        }
                    }

                    // Playback controls
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // Shuffle
                        IconButton(onClick = { viewModel.toggleShuffle() }) {
                            Icon(
                                imageVector = Icons.Default.Shuffle,
                                contentDescription = "Shuffle",
                                tint = if (state.shuffle) colors.primary else colors.textMuted,
                                modifier = Modifier.size(22.dp),
                            )
                        }

                        // Previous / Play-Pause / Next
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(20.dp),
                        ) {
                            IconButton(onClick = { viewModel.previous() }) {
                                Icon(
                                    imageVector = Icons.Default.SkipPrevious,
                                    contentDescription = "Previous",
                                    tint = colors.text,
                                    modifier = Modifier.size(26.dp),
                                )
                            }

                            IconButton(
                                onClick = { viewModel.togglePlay() },
                                modifier = Modifier.size(64.dp),
                            ) {
                                Icon(
                                    imageVector = if (state.isPlaying) Icons.Default.PauseCircleFilled else Icons.Default.PlayCircleFilled,
                                    contentDescription = if (state.isPlaying) "Pause" else "Play",
                                    tint = colors.primary,
                                    modifier = Modifier.size(64.dp),
                                )
                            }

                            IconButton(onClick = { viewModel.next() }) {
                                Icon(
                                    imageVector = Icons.Default.SkipNext,
                                    contentDescription = "Next",
                                    tint = colors.text,
                                    modifier = Modifier.size(26.dp),
                                )
                            }
                        }

                        // Repeat
                        IconButton(onClick = { viewModel.cycleRepeat() }) {
                            Icon(
                                imageVector = if (state.repeat == RepeatMode.ONE) Icons.Default.RepeatOne else Icons.Default.Repeat,
                                contentDescription = "Repeat",
                                tint = if (state.repeat == RepeatMode.NONE) colors.textMuted else colors.primary,
                                modifier = Modifier.size(22.dp),
                            )
                        }
                    }

                    // Volume
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "Volume",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.textMuted,
                        )
                        Slider(
                            value = state.volume,
                            onValueChange = { viewModel.setVolume(it) },
                            colors = SliderDefaults.colors(
                                thumbColor = colors.primary,
                                activeTrackColor = colors.primary,
                                inactiveTrackColor = colors.fillSoft,
                            ),
                        )
                    }
                }
            }
        }
    }
}
