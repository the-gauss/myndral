package com.myndral.app.ui.screens.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.CatalogRepository
import com.myndral.app.domain.model.Album
import com.myndral.app.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AlbumDetailUiState(
    val album: Album? = null,
    val tracks: List<Track> = emptyList(),
    val favoriteTrackIds: Set<String> = emptySet(),
    val libraryTrackIds: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class AlbumDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val catalog: CatalogRepository,
) : ViewModel() {

    private val albumId: String = checkNotNull(savedStateHandle["albumId"])

    private val _state = MutableStateFlow(AlbumDetailUiState())
    val state: StateFlow<AlbumDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            try {
                val album = async { catalog.getAlbum(albumId) }
                val tracks = async { catalog.getAlbumTracks(albumId) }

                val albumResult = album.await()
                val tracksResult = tracks.await()
                val trackIds = tracksResult.items.map { it.id }

                val collection = runCatching {
                    catalog.getCollectionState(trackIds = trackIds)
                }.getOrNull()

                _state.update {
                    it.copy(
                        album = albumResult,
                        tracks = tracksResult.items,
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
