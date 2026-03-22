package com.myndral.app.ui.screens.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.CatalogRepository
import com.myndral.app.domain.model.Playlist
import com.myndral.app.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlaylistDetailUiState(
    val playlist: Playlist? = null,
    val favoriteTrackIds: Set<String> = emptySet(),
    val libraryTrackIds: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PlaylistDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val catalog: CatalogRepository,
) : ViewModel() {

    private val playlistId: String = checkNotNull(savedStateHandle["playlistId"])

    private val _state = MutableStateFlow(PlaylistDetailUiState())
    val state: StateFlow<PlaylistDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            try {
                val playlist = catalog.getPlaylist(playlistId)
                val trackIds = playlist.tracks.map { it.id }
                val collection = runCatching {
                    catalog.getCollectionState(trackIds = trackIds)
                }.getOrNull()

                _state.update {
                    it.copy(
                        playlist = playlist,
                        favoriteTrackIds = collection?.favoriteTrackIds?.toSet() ?: emptySet(),
                        libraryTrackIds = collection?.libraryTrackIds?.toSet() ?: emptySet(),
                        isLoading = false,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }
}
