package com.myndral.app.player

import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Background media playback service.
 *
 * Extends [MediaSessionService] (Media3) to keep ExoPlayer alive when the app
 * is backgrounded. The OS can then surface a notification with playback controls
 * and allow the user to control playback from the lock screen or notification shade.
 *
 * The service is registered in AndroidManifest.xml with
 * `android:foregroundServiceType="mediaPlayback"`.
 */
@AndroidEntryPoint
class MyndralPlayerService : MediaSessionService() {

    @Inject
    lateinit var player: ExoPlayer

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
