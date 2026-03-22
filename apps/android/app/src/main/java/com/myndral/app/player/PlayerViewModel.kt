package com.myndral.app.player

import android.content.ComponentName
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.myndral.app.domain.model.RepeatMode
import com.myndral.app.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlayerState(
    val currentTrack: Track? = null,
    val queue: List<Track> = emptyList(),
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    /** 0.0 – 1.0 playback progress. */
    val progress: Float = 0f,
    val elapsedMs: Long = 0L,
    val durationMs: Long = 0L,
    val volume: Float = 1f,
    val shuffle: Boolean = false,
    val repeat: RepeatMode = RepeatMode.NONE,
)

/**
 * Singleton ViewModel that owns the Media3 [MediaController] connection to
 * [MyndralPlayerService]. All playback state is exposed as [StateFlow] so any
 * screen can observe it without creating another connection.
 */
@HiltViewModel
class PlayerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(PlayerState())
    val state: StateFlow<PlayerState> = _state.asStateFlow()

    private var controller: MediaController? = null

    init {
        connectController()
    }

    private fun connectController() {
        val token = SessionToken(
            context,
            ComponentName(context, MyndralPlayerService::class.java)
        )
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = future.get()
            registerPlayerListeners()
            startProgressPolling()
        }, MoreExecutors.directExecutor())
    }

    private fun registerPlayerListeners() {
        val player = controller ?: return
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _state.update { it.copy(isPlaying = isPlaying) }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                _state.update {
                    it.copy(isBuffering = playbackState == Player.STATE_BUFFERING)
                }
            }
        })
    }

    /** Polls position every 500 ms to update the progress slider. */
    private fun startProgressPolling() {
        viewModelScope.launch {
            while (true) {
                val player = controller
                if (player != null && player.duration > 0) {
                    val elapsed = player.currentPosition
                    val duration = player.duration
                    _state.update {
                        it.copy(
                            progress = elapsed.toFloat() / duration.toFloat(),
                            elapsedMs = elapsed,
                            durationMs = duration,
                        )
                    }
                }
                delay(500)
            }
        }
    }

    /** Starts playback of [track] with [queue] context for next/previous support. */
    fun play(track: Track, queue: List<Track> = listOf(track)) {
        val player = controller ?: return
        val queueIndex = queue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)

        player.clearMediaItems()
        queue.forEach { t ->
            val audioUrl = t.audioUrl ?: return@forEach
            player.addMediaItem(MediaItem.fromUri(audioUrl))
        }
        player.seekTo(queueIndex, 0L)
        player.prepare()
        player.play()

        _state.update { it.copy(currentTrack = track, queue = queue) }
    }

    fun togglePlay() {
        val player = controller ?: return
        if (player.isPlaying) player.pause() else player.play()
    }

    fun next() {
        controller?.seekToNextMediaItem()
        syncCurrentTrack()
    }

    fun previous() {
        controller?.seekToPreviousMediaItem()
        syncCurrentTrack()
    }

    fun seekTo(fraction: Float) {
        val player = controller ?: return
        if (player.duration > 0) {
            player.seekTo((fraction * player.duration).toLong())
        }
    }

    fun setVolume(volume: Float) {
        controller?.volume = volume
        _state.update { it.copy(volume = volume) }
    }

    fun toggleShuffle() {
        val newShuffle = !_state.value.shuffle
        controller?.shuffleModeEnabled = newShuffle
        _state.update { it.copy(shuffle = newShuffle) }
    }

    fun cycleRepeat() {
        val next = when (_state.value.repeat) {
            RepeatMode.NONE -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.NONE
        }
        controller?.repeatMode = when (next) {
            RepeatMode.NONE -> Player.REPEAT_MODE_OFF
            RepeatMode.ALL -> Player.REPEAT_MODE_ALL
            RepeatMode.ONE -> Player.REPEAT_MODE_ONE
        }
        _state.update { it.copy(repeat = next) }
    }

    private fun syncCurrentTrack() {
        val player = controller ?: return
        val idx = player.currentMediaItemIndex
        val queue = _state.value.queue
        if (idx in queue.indices) {
            _state.update { it.copy(currentTrack = queue[idx]) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        controller?.release()
        controller = null
    }
}
