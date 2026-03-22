package com.myndral.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.myndral.app.data.datastore.AppTheme
import com.myndral.app.data.datastore.ThemeDataStore
import com.myndral.app.player.PlayerViewModel
import com.myndral.app.ui.navigation.AppNavigation
import com.myndral.app.ui.screens.auth.AuthViewModel
import com.myndral.app.ui.theme.MyndralTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Single-activity entry point.
 *
 * Responsibilities:
 *  - Bootstraps Compose with edge-to-edge rendering.
 *  - Injects [ThemeDataStore] to observe the user's selected theme and apply
 *    [MyndralTheme] before any UI is rendered — guarantees no flash of wrong theme.
 *  - Provides root-scoped [AuthViewModel] and [PlayerViewModel] to [AppNavigation]
 *    so both are kept alive for the lifetime of the activity.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var themeDataStore: ThemeDataStore

    private val authViewModel: AuthViewModel by viewModels()
    private val playerViewModel: PlayerViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val appTheme by themeDataStore.themeFlow.collectAsState(initial = AppTheme.LIGHT)

            MyndralTheme(appTheme = appTheme) {
                AppNavigation(
                    authViewModel = authViewModel,
                    playerViewModel = playerViewModel,
                )
            }
        }
    }
}
