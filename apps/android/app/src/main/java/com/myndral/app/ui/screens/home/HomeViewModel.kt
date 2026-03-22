package com.myndral.app.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.CatalogRepository
import com.myndral.app.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val albums: List<Album> = emptyList(),
    val artists: List<Artist> = emptyList(),
    val featuredTracks: List<Track> = emptyList(),
    val browseTracks: List<Track> = emptyList(),
    val playlists: List<Playlist> = emptyList(),
    val favoriteTrackIds: Set<String> = emptySet(),
    val libraryTrackIds: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val catalog: CatalogRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val albums = async { catalog.getAlbums(10) }
                val artists = async { catalog.getArtists(8) }
                val featured = async { catalog.getFeaturedTracks(10) }
                val browse = async { catalog.getTracks(8) }
                val playlists = async { catalog.getPlaylists(4) }

                val albumsResult = albums.await()
                val artistsResult = artists.await()
                val featuredResult = featured.await()
                val browseResult = browse.await()
                val playlistsResult = playlists.await()

                // Fetch collection state for all visible track IDs
                val allTrackIds = (featuredResult.items + browseResult.items).map { it.id }.distinct()
                val collection = runCatching {
                    catalog.getCollectionState(trackIds = allTrackIds)
                }.getOrNull()

                _state.update {
                    it.copy(
                        albums = albumsResult.items,
                        artists = artistsResult.items,
                        featuredTracks = featuredResult.items,
                        browseTracks = browseResult.items,
                        playlists = playlistsResult.items,
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
