package com.myndral.app.ui.screens.studio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.StudioRepository
import com.myndral.app.domain.model.StagingQueue
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StudioStagingUiState(
    val queue: StagingQueue? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val pendingActionId: String? = null,
)

@HiltViewModel
class StudioStagingViewModel @Inject constructor(
    private val studio: StudioRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StudioStagingUiState())
    val state: StateFlow<StudioStagingUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val queue = studio.listStaging()
                _state.update { it.copy(queue = queue, isLoading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    // Artist actions
    fun approveArtist(artistId: String) = launch { studio.approveStagingArtist(artistId) }
    fun rejectArtist(artistId: String, notes: String) = launch { studio.rejectStagingArtist(artistId, notes) }

    // Album actions
    fun approveAlbum(albumId: String) = launch { studio.approveStagingAlbum(albumId) }
    fun rejectAlbum(albumId: String, notes: String) = launch { studio.rejectStagingAlbum(albumId, notes) }

    // Track actions
    fun approveTrack(trackId: String) = launch { studio.approveTrack(trackId) }
    fun rejectTrack(trackId: String, notes: String) = launch { studio.rejectTrack(trackId, notes) }

    private fun launch(action: suspend () -> Unit) {
        viewModelScope.launch {
            runCatching { action() }
            load()
        }
    }
}
