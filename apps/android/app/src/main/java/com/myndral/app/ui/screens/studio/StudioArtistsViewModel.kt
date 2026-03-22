package com.myndral.app.ui.screens.studio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.StudioRepository
import com.myndral.app.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StudioArtistsUiState(
    val artists: List<ArtistItem> = emptyList(),
    val genres: List<Genre> = emptyList(),
    val statusFilter: ContentStatus? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val showCreateSheet: Boolean = false,
    // Create form fields
    val createName: String = "",
    val createBio: String = "",
    val createPersonaPrompt: String = "",
    val createStyleTags: String = "",
    val createGenreIds: List<String> = emptyList(),
    val isSaving: Boolean = false,
    val saveError: String? = null,
)

@HiltViewModel
class StudioArtistsViewModel @Inject constructor(
    private val studio: StudioRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StudioArtistsUiState())
    val state: StateFlow<StudioArtistsUiState> = _state.asStateFlow()

    init {
        load()
        viewModelScope.launch {
            runCatching { studio.listGenres() }
                .onSuccess { genres -> _state.update { it.copy(genres = genres) } }
        }
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = studio.listArtists(status = _state.value.statusFilter)
                _state.update { it.copy(artists = result.items, isLoading = false) }
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

    fun updateCreateField(field: String, value: String) = _state.update {
        when (field) {
            "name" -> it.copy(createName = value)
            "bio" -> it.copy(createBio = value)
            "persona" -> it.copy(createPersonaPrompt = value)
            "tags" -> it.copy(createStyleTags = value)
            else -> it
        }
    }

    fun toggleGenre(genreId: String) = _state.update {
        val current = it.createGenreIds.toMutableList()
        if (genreId in current) current.remove(genreId) else current.add(genreId)
        it.copy(createGenreIds = current)
    }

    fun createArtist() {
        val s = _state.value
        if (s.createName.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isSaving = true, saveError = null) }
            try {
                studio.createArtist(
                    name = s.createName.trim(),
                    slug = null,
                    bio = s.createBio.trim().ifBlank { null },
                    imageUrl = null,
                    headerImageUrl = null,
                    personaPrompt = s.createPersonaPrompt.trim().ifBlank { null },
                    styleTags = s.createStyleTags.split(",").map { it.trim() }.filter { it.isNotBlank() },
                    genreIds = s.createGenreIds,
                )
                _state.update {
                    it.copy(
                        isSaving = false, showCreateSheet = false,
                        createName = "", createBio = "", createPersonaPrompt = "",
                        createStyleTags = "", createGenreIds = emptyList(),
                    )
                }
                load()
            } catch (e: Exception) {
                _state.update { it.copy(isSaving = false, saveError = e.message) }
            }
        }
    }
}
