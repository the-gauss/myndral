package com.myndral.app.ui.screens.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.CatalogRepository
import com.myndral.app.domain.model.Album
import com.myndral.app.domain.model.Artist
import com.myndral.app.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ArtistDetailUiState(
    val artist: Artist? = null,
    val albums: List<Album> = emptyList(),
    val topTracks: List<Track> = emptyList(),
    val favoriteTrackIds: Set<String> = emptySet(),
    val libraryTrackIds: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ArtistDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val catalog: CatalogRepository,
) : ViewModel() {

    private val artistId: String = checkNotNull(savedStateHandle["artistId"])

    private val _state = MutableStateFlow(ArtistDetailUiState())
    val state: StateFlow<ArtistDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            try {
                val artist = async { catalog.getArtist(artistId) }
                val albums = async { catalog.getArtistAlbums(artistId) }
                val topTracks = async { catalog.getArtistTopTracks(artistId) }

                val artistResult = artist.await()
                val albumsResult = albums.await()
                val topTracksResult = topTracks.await()

                val trackIds = topTracksResult.items.map { it.id }
                val collection = runCatching {
                    catalog.getCollectionState(trackIds = trackIds)
                }.getOrNull()

                _state.update {
                    it.copy(
                        artist = artistResult,
                        albums = albumsResult.items,
                        topTracks = topTracksResult.items,
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
