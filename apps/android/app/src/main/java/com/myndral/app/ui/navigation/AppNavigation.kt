package com.myndral.app.ui.navigation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.myndral.app.domain.model.hasStudioAccess
import com.myndral.app.player.PlayerViewModel
import com.myndral.app.ui.components.MiniPlayer
import com.myndral.app.ui.screens.account.AccountScreen
import com.myndral.app.ui.screens.auth.*
import com.myndral.app.ui.screens.detail.*
import com.myndral.app.ui.screens.home.HomeScreen
import com.myndral.app.ui.screens.library.LibraryScreen
import com.myndral.app.ui.screens.player.PlayerScreen
import com.myndral.app.ui.screens.search.SearchScreen
import com.myndral.app.ui.screens.studio.*
import com.myndral.app.ui.theme.myndralColors

private data class TabItem(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

private val listenerTabs = listOf(
    TabItem(NavRoutes.HOME, "Home", Icons.Default.Home),
    TabItem(NavRoutes.SEARCH, "Search", Icons.Default.Search),
    TabItem(NavRoutes.LIBRARY, "Library", Icons.Default.LibraryMusic),
    TabItem(NavRoutes.ACCOUNT, "Account", Icons.Default.Person),
)

private val studioTabs = listOf(
    TabItem(NavRoutes.STUDIO_ARTISTS, "Artists", Icons.Default.Mic),
    TabItem(NavRoutes.STUDIO_ALBUMS, "Albums", Icons.Default.Album),
    TabItem(NavRoutes.STUDIO_SONGS, "Songs", Icons.Default.MusicNote),
    TabItem(NavRoutes.STUDIO_STAGING, "Staging", Icons.Default.Preview),
)

/**
 * Root navigation component. Renders either the auth flow (no user) or the
 * tabbed main app + full-screen destinations (album/artist/player/studio).
 *
 * Architecture note: [PlayerViewModel] is scoped to the navigation graph root
 * so that both the MiniPlayer (always visible) and the full PlayerScreen share
 * the same playback state instance — exactly the same pattern as iOS's
 * PlayerProvider context that wraps the entire app.
 */
@Composable
fun AppNavigation(
    authViewModel: AuthViewModel,
    playerViewModel: PlayerViewModel,
) {
    val authState by authViewModel.state.collectAsState()
    val playerState by playerViewModel.state.collectAsState()
    val colors = myndralColors
    val user = authState.user

    if (user == null) {
        // ── Auth flow ─────────────────────────────────────────────────────────
        val authNav = rememberNavController()
        NavHost(navController = authNav, startDestination = NavRoutes.LOGIN) {
            composable(NavRoutes.LOGIN) {
                LoginScreen(
                    uiState = authState,
                    onLogin = authViewModel::login,
                    onNavigateToRegister = { authNav.navigate(NavRoutes.REGISTER) },
                )
            }
            composable(NavRoutes.REGISTER) {
                RegisterScreen(
                    uiState = authState,
                    onRegister = authViewModel::register,
                    onNavigateToLogin = { authNav.popBackStack() },
                )
            }
            composable(NavRoutes.CHOOSE_PLAN) {
                ChoosePlanScreen(onContinue = { /* plan selection handled server-side */ })
            }
        }
    } else {
        // ── Main app ──────────────────────────────────────────────────────────
        val isStudioUser = user.role.hasStudioAccess()
        val mainNav = rememberNavController()
        val navBackStack by mainNav.currentBackStackEntryAsState()
        val currentRoute = navBackStack?.destination?.route

        // Determine which tabs to show based on current section
        val inStudio = currentRoute?.startsWith("studio") == true
        val activeTabs = if (inStudio) studioTabs else listenerTabs

        val fullScreenRoutes = setOf(
            NavRoutes.PLAYER,
            NavRoutes.ALBUM_DETAIL,
            NavRoutes.ARTIST_DETAIL,
            NavRoutes.PLAYLIST_DETAIL,
        )
        val showBottomNav = currentRoute !in fullScreenRoutes

        Scaffold(
            bottomBar = {
                if (showBottomNav) {
                    Column {
                        // Mini player above the nav bar
                        if (playerState.currentTrack != null && currentRoute != NavRoutes.PLAYER) {
                            MiniPlayer(
                                currentTrack = playerState.currentTrack!!,
                                isPlaying = playerState.isPlaying,
                                progress = playerState.progress,
                                onPlayPauseClick = { playerViewModel.togglePlay() },
                                onNextClick = { playerViewModel.next() },
                                onExpandClick = { mainNav.navigate(NavRoutes.PLAYER) },
                                modifier = Modifier.padding(bottom = 4.dp),
                            )
                        }

                        NavigationBar(
                            containerColor = colors.glassBgHeavy,
                        ) {
                            activeTabs.forEach { tab ->
                                val selected = navBackStack?.destination?.hierarchy
                                    ?.any { it.route == tab.route } == true
                                NavigationBarItem(
                                    selected = selected,
                                    onClick = {
                                        mainNav.navigate(tab.route) {
                                            popUpTo(mainNav.graph.findStartDestination().id) {
                                                saveState = true
                                            }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    },
                                    icon = {
                                        Icon(
                                            imageVector = tab.icon,
                                            contentDescription = tab.label,
                                        )
                                    },
                                    label = { Text(tab.label) },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = colors.primary,
                                        selectedTextColor = colors.primary,
                                        indicatorColor = colors.primaryDim,
                                        unselectedIconColor = colors.textMuted,
                                        unselectedTextColor = colors.textMuted,
                                    ),
                                )
                            }
                        }
                    }
                }
            }
        ) { innerPadding ->
            NavHost(
                navController = mainNav,
                startDestination = NavRoutes.HOME,
                modifier = Modifier.padding(innerPadding),
            ) {
                // ── Listener tabs ─────────────────────────────────────────────
                composable(NavRoutes.HOME) {
                    HomeScreen(
                        displayName = user.displayName,
                        onAlbumClick = { mainNav.navigate(NavRoutes.albumDetail(it)) },
                        onArtistClick = { mainNav.navigate(NavRoutes.artistDetail(it)) },
                        onPlaylistClick = { mainNav.navigate(NavRoutes.playlistDetail(it)) },
                        onPlayTrack = { track, queue -> playerViewModel.play(track, queue) },
                    )
                }
                composable(NavRoutes.SEARCH) {
                    SearchScreen(
                        onAlbumClick = { mainNav.navigate(NavRoutes.albumDetail(it)) },
                        onArtistClick = { mainNav.navigate(NavRoutes.artistDetail(it)) },
                        onPlaylistClick = { mainNav.navigate(NavRoutes.playlistDetail(it)) },
                        onPlayTrack = { track, queue -> playerViewModel.play(track, queue) },
                    )
                }
                composable(NavRoutes.LIBRARY) {
                    LibraryScreen(
                        onAlbumClick = { mainNav.navigate(NavRoutes.albumDetail(it)) },
                        onArtistClick = { mainNav.navigate(NavRoutes.artistDetail(it)) },
                        onPlaylistClick = { mainNav.navigate(NavRoutes.playlistDetail(it)) },
                        onPlayTrack = { track, queue -> playerViewModel.play(track, queue) },
                    )
                }
                composable(NavRoutes.ACCOUNT) {
                    AccountScreen(
                        onNavigateToStudio = { mainNav.navigate(NavRoutes.STUDIO_ARTISTS) },
                        onNavigateToStudioAccess = { mainNav.navigate(NavRoutes.STUDIO_ACCESS) },
                        onLogout = { authViewModel.logout() },
                    )
                }

                // ── Full-screen destinations ───────────────────────────────────
                composable(NavRoutes.PLAYER) {
                    PlayerScreen(viewModel = playerViewModel, onBack = { mainNav.popBackStack() })
                }
                composable(NavRoutes.ALBUM_DETAIL) {
                    AlbumDetailScreen(
                        onBack = { mainNav.popBackStack() },
                        onArtistClick = { mainNav.navigate(NavRoutes.artistDetail(it)) },
                        onPlayTrack = { track, queue -> playerViewModel.play(track, queue) },
                    )
                }
                composable(NavRoutes.ARTIST_DETAIL) {
                    ArtistDetailScreen(
                        onBack = { mainNav.popBackStack() },
                        onAlbumClick = { mainNav.navigate(NavRoutes.albumDetail(it)) },
                        onPlayTrack = { track, queue -> playerViewModel.play(track, queue) },
                    )
                }
                composable(NavRoutes.PLAYLIST_DETAIL) {
                    PlaylistDetailScreen(
                        onBack = { mainNav.popBackStack() },
                        onPlayTrack = { track, queue -> playerViewModel.play(track, queue) },
                    )
                }

                // ── Studio access ─────────────────────────────────────────────
                composable(NavRoutes.STUDIO_ACCESS) {
                    StudioAccessScreen(
                        onBack = { mainNav.popBackStack() },
                        onSuccess = {
                            mainNav.navigate(NavRoutes.STUDIO_ARTISTS) {
                                popUpTo(NavRoutes.ACCOUNT)
                            }
                        },
                    )
                }

                // ── Studio tabs ───────────────────────────────────────────────
                composable(NavRoutes.STUDIO_ARTISTS) { StudioArtistsScreen() }
                composable(NavRoutes.STUDIO_ALBUMS) { StudioAlbumsScreen() }
                composable(NavRoutes.STUDIO_SONGS) { StudioSongsScreen() }
                composable(NavRoutes.STUDIO_STAGING) { StudioStagingScreen() }
            }
        }
    }
}
