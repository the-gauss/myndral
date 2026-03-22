package com.myndral.app.ui.screens.studio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.StudioRepository
import com.myndral.app.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StudioAlbumsUiState(
    val albums: List<AlbumItem> = emptyList(),
    val artists: List<ArtistItem> = emptyList(),
    val genres: List<Genre> = emptyList(),
    val statusFilter: ContentStatus? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val showCreateSheet: Boolean = false,
    val createTitle: String = "",
    val createArtistId: String = "",
    val createDescription: String = "",
    val createAlbumType: String = "album",
    val createGenreIds: List<String> = emptyList(),
    val isSaving: Boolean = false,
    val saveError: String? = null,
)

@HiltViewModel
class StudioAlbumsViewModel @Inject constructor(
    private val studio: StudioRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StudioAlbumsUiState())
    val state: StateFlow<StudioAlbumsUiState> = _state.asStateFlow()

    init {
        load()
        viewModelScope.launch {
            val artists = runCatching { studio.listArtists(limit = 100) }.getOrNull()
            val genres = runCatching { studio.listGenres() }.getOrNull()
            _state.update {
                it.copy(
                    artists = artists?.items ?: emptyList(),
                    genres = genres ?: emptyList(),
                )
            }
        }
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = studio.listAlbums(status = _state.value.statusFilter)
                _state.update { it.copy(albums = result.items, isLoading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun setStatusFilter(status: ContentStatus?) {
        _state.update { it.copy(statusFilter = status) }
        load()
    }

    fun openCreateSheet() = _state.update { it.copy(showCreateSheet = true) }
    fun closeCreateSheet() = _state.update { it.copy(showCreateSheet = false) }

    fun updateField(field: String, value: String) = _state.update {
        when (field) {
            "title" -> it.copy(createTitle = value)
            "description" -> it.copy(createDescription = value)
            "artistId" -> it.copy(createArtistId = value)
            "albumType" -> it.copy(createAlbumType = value)
            else -> it
        }
    }

    fun toggleGenre(genreId: String) = _state.update {
        val current = it.createGenreIds.toMutableList()
        if (genreId in current) current.remove(genreId) else current.add(genreId)
        it.copy(createGenreIds = current)
    }

    fun createAlbum() {
        val s = _state.value
        if (s.createTitle.isBlank() || s.createArtistId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isSaving = true, saveError = null) }
            try {
                studio.createAlbum(
                    title = s.createTitle.trim(),
                    slug = null,
                    artistId = s.createArtistId,
                    coverUrl = null,
                    description = s.createDescription.trim().ifBlank { null },
                    releaseDate = null,
                    albumType = s.createAlbumType,
                    genreIds = s.createGenreIds,
                )
                _state.update {
                    it.copy(
                        isSaving = false, showCreateSheet = false,
                        createTitle = "", createDescription = "",
                        createArtistId = "", createGenreIds = emptyList(),
                    )
                }
                load()
            } catch (e: Exception) {
                _state.update { it.copy(isSaving = false, saveError = e.message) }
            }
        }
    }
}
