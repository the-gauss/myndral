package com.myndral.app.ui.screens.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import com.myndral.app.domain.model.ContentStatus
import com.myndral.app.domain.model.humanize
import com.myndral.app.ui.components.*
import com.myndral.app.ui.theme.myndralColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudioArtistsScreen(
    viewModel: StudioArtistsViewModel = hiltViewModel(),
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
            Text(text = "Artists", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
            FloatingActionButton(
                onClick = { viewModel.openCreateSheet() },
                containerColor = colors.cta,
                contentColor = colors.ctaText,
                modifier = Modifier.size(40.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create Artist", modifier = Modifier.size(20.dp))
            }
        }

        // Status filter chips
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FilterChip(
                    selected = state.statusFilter == null,
                    onClick = { viewModel.setStatusFilter(null) },
                    label = { Text("All") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = colors.primaryDim,
                        selectedLabelColor = colors.primary,
                    ),
                )
            }
            items(ContentStatus.entries) { status ->
                FilterChip(
                    selected = state.statusFilter == status,
                    onClick = { viewModel.setStatusFilter(status) },
                    label = { Text(status.humanize()) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = colors.primaryDim,
                        selectedLabelColor = colors.primary,
                    ),
                )
            }
        }

        if (state.isLoading) {
            LoadingView()
        } else if (state.artists.isEmpty()) {
            EmptyState(
                title = "No artists yet",
                message = "Create your first artist to get started.",
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                state.artists.forEach { artist ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(colors.glassBg, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        RemoteArtwork(
                            uri = artist.imageUrl,
                            modifier = Modifier.size(52.dp),
                            cornerRadius = 12.dp,
                        )
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(text = artist.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                            if (!artist.bio.isNullOrBlank()) {
                                Text(
                                    text = artist.bio,
                                    fontSize = 12.sp,
                                    color = colors.textMuted,
                                    maxLines = 2,
                                )
                            }
                        }
                        StatusBadge(status = artist.status)
                    }
                }
            }
        }
    }

    // Create Artist Bottom Sheet
    if (state.showCreateSheet) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.closeCreateSheet() },
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
                Text(text = "Create Artist", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)

                OutlinedTextField(
                    value = state.createName,
                    onValueChange = { viewModel.updateCreateField("name", it) },
                    label = { Text("Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = colors.primary,
                        focusedLabelColor = colors.primary,
                    ),
                )

                OutlinedTextField(
                    value = state.createBio,
                    onValueChange = { viewModel.updateCreateField("bio", it) },
                    label = { Text("Bio") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = colors.primary,
                        focusedLabelColor = colors.primary,
                    ),
                )

                OutlinedTextField(
                    value = state.createPersonaPrompt,
                    onValueChange = { viewModel.updateCreateField("persona", it) },
                    label = { Text("AI Persona Prompt") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = colors.primary,
                        focusedLabelColor = colors.primary,
                    ),
                )

                OutlinedTextField(
                    value = state.createStyleTags,
                    onValueChange = { viewModel.updateCreateField("tags", it) },
                    label = { Text("Style Tags (comma-separated)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = colors.primary,
                        focusedLabelColor = colors.primary,
                    ),
                )

                // Genre chips
                if (state.genres.isNotEmpty()) {
                    Text(text = "Genres", fontSize = 14.sp, color = colors.text, fontWeight = FontWeight.Medium)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(state.genres) { genre ->
                            FilterChip(
                                selected = genre.id in state.createGenreIds,
                                onClick = { viewModel.toggleGenre(genre.id) },
                                label = { Text(genre.name) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = colors.primaryDim,
                                    selectedLabelColor = colors.primary,
                                ),
                            )
                        }
                    }
                }

                if (state.saveError != null) {
                    Text(text = state.saveError!!, color = colors.danger, fontSize = 13.sp)
                }

                PrimaryButton(
                    label = if (state.isSaving) "Creating…" else "Create Artist",
                    onClick = { viewModel.createArtist() },
                    enabled = !state.isSaving && state.createName.isNotBlank(),
                )
            }
        }
    }
}
