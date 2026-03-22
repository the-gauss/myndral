package com.myndral.app.ui.screens.studio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.StudioRepository
import com.myndral.app.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StudioSongsUiState(
    val jobs: List<MusicGenerationJob> = emptyList(),
    val tracks: List<TrackItem> = emptyList(),
    val artists: List<ArtistItem> = emptyList(),
    val albums: List<AlbumItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val showGenerateSheet: Boolean = false,
    val genArtistId: String = "",
    val genAlbumId: String = "",
    val genTrackTitle: String = "",
    val genPrompt: String = "",
    val genExplicit: Boolean = false,
    val isGenerating: Boolean = false,
    val genError: String? = null,
)

@HiltViewModel
class StudioSongsViewModel @Inject constructor(
    private val studio: StudioRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StudioSongsUiState())
    val state: StateFlow<StudioSongsUiState> = _state.asStateFlow()

    init {
        load()
        viewModelScope.launch {
            val artists = runCatching { studio.listArtists(limit = 100) }.getOrNull()
            val albums = runCatching { studio.listAlbums(limit = 100) }.getOrNull()
            _state.update {
                it.copy(
                    artists = artists?.items ?: emptyList(),
                    albums = albums?.items ?: emptyList(),
                )
            }
        }
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            try {
                val jobs = studio.listMusicJobs()
                val tracks = studio.listTracks()
                _state.update { it.copy(jobs = jobs.items, tracks = tracks.items, isLoading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun openGenerateSheet() = _state.update { it.copy(showGenerateSheet = true) }
    fun closeGenerateSheet() = _state.update { it.copy(showGenerateSheet = false) }

    fun updateField(field: String, value: String) = _state.update {
        when (field) {
            "artistId" -> it.copy(genArtistId = value)
            "albumId" -> it.copy(genAlbumId = value)
            "title" -> it.copy(genTrackTitle = value)
            "prompt" -> it.copy(genPrompt = value)
            else -> it
        }
    }

    fun toggleExplicit() = _state.update { it.copy(genExplicit = !it.genExplicit) }

    fun generate() {
        val s = _state.value
        if (s.genArtistId.isBlank() || s.genAlbumId.isBlank() || s.genTrackTitle.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isGenerating = true, genError = null) }
            try {
                studio.generateMusic(
                    artistId = s.genArtistId,
                    albumId = s.genAlbumId,
                    trackTitle = s.genTrackTitle.trim(),
                    explicit = s.genExplicit,
                    prompt = s.genPrompt.trim().ifBlank { null },
                )
                _state.update {
                    it.copy(
                        isGenerating = false, showGenerateSheet = false,
                        genArtistId = "", genAlbumId = "", genTrackTitle = "", genPrompt = "",
                    )
                }
                load()
            } catch (e: Exception) {
                _state.update { it.copy(isGenerating = false, genError = e.message) }
            }
        }
    }
}
