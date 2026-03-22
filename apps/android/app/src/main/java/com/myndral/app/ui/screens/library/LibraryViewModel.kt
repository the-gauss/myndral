package com.myndral.app.ui.screens.library

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

enum class LibraryView { SAVED, FAVORITES }

data class LibraryUiState(
    val view: LibraryView = LibraryView.SAVED,
    // Saved
    val libraryTracks: List<Track> = emptyList(),
    val libraryAlbums: List<Album> = emptyList(),
    val libraryArtists: List<Artist> = emptyList(),
    val libraryPlaylists: List<Playlist> = emptyList(),
    // Favorites
    val favoriteTracks: List<Track> = emptyList(),
    val favoriteAlbums: List<Album> = emptyList(),
    val favoriteArtists: List<Artist> = emptyList(),
    // Collection state (for TrackRow badges)
    val favoriteTrackIds: Set<String> = emptySet(),
    val libraryTrackIds: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val catalog: CatalogRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LibraryUiState())
    val state: StateFlow<LibraryUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun setView(view: LibraryView) = _state.update { it.copy(view = view) }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val lTracks = async { catalog.getLibraryTracks() }
                val lAlbums = async { catalog.getLibraryAlbums() }
                val lArtists = async { catalog.getLibraryArtists() }
                val lPlaylists = async { catalog.getLibraryPlaylists() }
                val fTracks = async { catalog.getFavoriteTracks() }
                val fAlbums = async { catalog.getFavoriteAlbums() }
                val fArtists = async { catalog.getFavoriteArtists() }

                val libraryTracksResult = lTracks.await()
                val favTracksResult = fTracks.await()

                val allTrackIds = (libraryTracksResult.items + favTracksResult.items)
                    .map { it.id }.distinct()
                val collection = runCatching {
                    catalog.getCollectionState(trackIds = allTrackIds)
                }.getOrNull()

                _state.update {
                    it.copy(
                        libraryTracks = libraryTracksResult.items,
                        libraryAlbums = lAlbums.await().items,
                        libraryArtists = lArtists.await().items,
                        libraryPlaylists = lPlaylists.await().items,
                        favoriteTracks = favTracksResult.items,
                        favoriteAlbums = fAlbums.await().items,
                        favoriteArtists = fArtists.await().items,
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

    fun createPlaylist(name: String, description: String, isPublic: Boolean) {
        viewModelScope.launch {
            runCatching {
                catalog.createPlaylist(name, description.ifBlank { null }, isPublic, null)
            }
            load() // Refresh to include the new playlist
        }
    }
}
