package com.myndral.app.ui.screens.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.domain.model.MusicGenerationStatus
import com.myndral.app.domain.model.formatDurationMs
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudioSongsScreen(
    viewModel: StudioSongsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors

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
            Text(text = "Songs", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
            FloatingActionButton(
                onClick = { viewModel.openGenerateSheet() },
                containerColor = colors.cta,
                contentColor = colors.ctaText,
                modifier = Modifier.size(40.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = "Generate Song", modifier = Modifier.size(20.dp))
            }
        }

        if (state.isLoading) {
            LoadingView()
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Generation jobs
                if (state.jobs.isNotEmpty()) {
                    SectionHeader("Generation Jobs")
                    state.jobs.forEach { job ->
                        val statusColor = when (job.status) {
                            MusicGenerationStatus.COMPLETED -> colors.success
                            MusicGenerationStatus.FAILED -> colors.danger
                            MusicGenerationStatus.IN_PROGRESS, MusicGenerationStatus.PENDING -> colors.warning
                            MusicGenerationStatus.CANCELLED -> colors.textSubtle
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(colors.glassBg, RoundedCornerShape(12.dp))
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(text = job.trackTitle, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                if (!job.artistName.isNullOrBlank()) {
                                    Text(text = "${job.artistName} · ${job.albumTitle ?: ""}", fontSize = 12.sp, color = colors.textMuted)
                                }
                            }
                            Text(
                                text = job.status.name.lowercase().replace('_', ' ')
                                    .replaceFirstChar { it.uppercase() },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = statusColor,
                            )
                        }
                    }
                }

                // Track catalog
                if (state.tracks.isNotEmpty()) {
                    SectionHeader("Track Catalog")
                    state.tracks.forEach { track ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(colors.glassBg, RoundedCornerShape(12.dp))
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(text = track.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                Text(
                                    text = "${track.primaryArtistName ?: "Unknown"} · ${track.albumTitle}",
                                    fontSize = 12.sp,
                                    color = colors.textMuted,
                                )
                                Text(text = track.durationMs.formatDurationMs(), fontSize = 11.sp, color = colors.textSubtle)
                            }
                            StatusBadge(status = track.status)
                        }
                    }
                }

                if (state.jobs.isEmpty() && state.tracks.isEmpty()) {
                    EmptyState(title = "No songs yet", message = "Generate your first track.")
                }
            }
        }
    }

    // Generate Sheet
    if (state.showGenerateSheet) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.closeGenerateSheet() },
            containerColor = colors.surfaceRaised,
            shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(text = "Generate Song", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)

                // Artist picker
                if (state.artists.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    val selectedArtist = state.artists.find { it.id == state.genArtistId }
                    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                        OutlinedTextField(
                            value = selectedArtist?.name ?: "Select Artist *",
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                            label = { Text("Artist") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary),
                        )
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            state.artists.forEach { artist ->
                                DropdownMenuItem(
                                    text = { Text(artist.name) },
                                    onClick = { viewModel.updateField("artistId", artist.id); expanded = false },
                                )
                            }
                        }
                    }
                }

                // Album picker
                val filteredAlbums = if (state.genArtistId.isBlank()) state.albums
                else state.albums.filter { it.artistId == state.genArtistId }
                if (filteredAlbums.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    val selectedAlbum = filteredAlbums.find { it.id == state.genAlbumId }
                    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                        OutlinedTextField(
                            value = selectedAlbum?.title ?: "Select Album *",
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                            label = { Text("Album") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary),
                        )
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            filteredAlbums.forEach { album ->
                                DropdownMenuItem(
                                    text = { Text(album.title) },
                                    onClick = { viewModel.updateField("albumId", album.id); expanded = false },
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = state.genTrackTitle,
                    onValueChange = { viewModel.updateField("title", it) },
                    label = { Text("Track Title *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, focusedLabelColor = colors.primary),
                )

                OutlinedTextField(
                    value = state.genPrompt,
                    onValueChange = { viewModel.updateField("prompt", it) },
                    label = { Text("Generation Prompt") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, focusedLabelColor = colors.primary),
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Explicit content", fontSize = 14.sp, color = colors.text)
                    Switch(
                        checked = state.genExplicit,
                        onCheckedChange = { viewModel.toggleExplicit() },
                        colors = SwitchDefaults.colors(checkedTrackColor = colors.primary),
                    )
                }

                if (state.genError != null) {
                    Text(text = state.genError!!, color = colors.danger, fontSize = 13.sp)
                }

                PrimaryButton(
                    label = if (state.isGenerating) "Generating…" else "Generate",
                    onClick = { viewModel.generate() },
                    enabled = !state.isGenerating && state.genArtistId.isNotBlank()
                            && state.genAlbumId.isNotBlank() && state.genTrackTitle.isNotBlank(),
                )
            }
        }
    }
}
