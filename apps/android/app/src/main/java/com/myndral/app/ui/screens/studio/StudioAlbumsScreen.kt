package com.myndral.app.ui.screens.studio

import androidx.compose.foundation.background
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
fun StudioAlbumsScreen(
    viewModel: StudioAlbumsViewModel = hiltViewModel(),
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
            Text(text = "Albums", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
            FloatingActionButton(
                onClick = { viewModel.openCreateSheet() },
                containerColor = colors.cta,
                contentColor = colors.ctaText,
                modifier = Modifier.size(40.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create Album", modifier = Modifier.size(20.dp))
            }
        }

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
        } else if (state.albums.isEmpty()) {
            EmptyState(title = "No albums yet", message = "Create your first album.")
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                state.albums.forEach { album ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(colors.glassBg, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        RemoteArtwork(uri = album.coverUrl, modifier = Modifier.size(52.dp), cornerRadius = 10.dp)
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(text = album.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                            Text(text = "${album.artistName} · ${album.trackCount} tracks", fontSize = 12.sp, color = colors.textMuted)
                            Text(
                                text = album.albumType.name.lowercase().replaceFirstChar { it.uppercase() },
                                fontSize = 11.sp,
                                color = colors.textSubtle,
                            )
                        }
                        StatusBadge(status = album.status)
                    }
                }
            }
        }
    }

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
                Text(text = "Create Album", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)

                OutlinedTextField(
                    value = state.createTitle,
                    onValueChange = { viewModel.updateField("title", it) },
                    label = { Text("Title *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, focusedLabelColor = colors.primary),
                )

                // Artist dropdown
                if (state.artists.isNotEmpty()) {
                    var expanded by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
                    val selectedArtist = state.artists.find { it.id == state.createArtistId }
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
                                    onClick = {
                                        viewModel.updateField("artistId", artist.id)
                                        expanded = false
                                    },
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = state.createDescription,
                    onValueChange = { viewModel.updateField("description", it) },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, focusedLabelColor = colors.primary),
                )

                if (state.saveError != null) {
                    Text(text = state.saveError!!, color = colors.danger, fontSize = 13.sp)
                }

                PrimaryButton(
                    label = if (state.isSaving) "Creating…" else "Create Album",
                    onClick = { viewModel.createAlbum() },
                    enabled = !state.isSaving && state.createTitle.isNotBlank() && state.createArtistId.isNotBlank(),
                )
            }
        }
    }
}
