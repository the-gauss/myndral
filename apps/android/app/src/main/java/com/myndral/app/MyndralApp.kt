package com.myndral.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Application class — required by Hilt for dependency injection initialisation.
 * Also the entry point for app-wide setup (e.g. Coil image loader configuration).
 */
@HiltAndroidApp
class MyndralApp : Application()
