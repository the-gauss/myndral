package com.myndral.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.data.datastore.AppTheme

// ── Color constants — sourced directly from shared/brand/tokens.css ─────────

// Light theme
private val LightBg = Color(0xFFEEF4F8)
private val LightBgOffset = Color(0xFFDBE6EF)
private val LightSurface = Color(0x94F8FBFD)
private val LightSurfaceRaised = Color(0xC2FCFDFF)
private val LightSurfaceBorder = Color(0x1A1A2730)
private val LightText = Color(0xFF1A2730)
private val LightTextMuted = Color(0xFF45586C)
private val LightTextSubtle = Color(0xFF6F8192)
private val LightPrimary = Color(0xFFE95D2C)
private val LightPrimaryDim = Color(0x29E95D2C)
private val LightPrimaryHover = Color(0xFFA63E1B)
private val LightSecondary = Color(0xFFB0CEE2)
private val LightCta = Color(0xFFE95D2C)
private val LightCtaText = Color(0xFFFFFFFF)
private val LightFillSoft = Color(0xFFD5DFE8)
private val LightFillSubtle = Color(0xFFEDF3F7)
private val LightSuccess = Color(0xFF22C55E)
private val LightWarning = Color(0xFFF59E0B)
private val LightDanger = Color(0xFFEF4444)
private val LightGlassBg = Color(0x7AF4F9FC)
private val LightGlassBgHeavy = Color(0xADFCFDFF)
private val LightGlassBorder = Color(0x1A1A2730)
private val LightGlassHighlight = Color(0xD1FFFFFF)

// Dark theme
private val DarkBg = Color(0xFF0D171E)
private val DarkBgOffset = Color(0xFF1A2730)
private val DarkSurface = Color(0xB81A2730)
private val DarkSurfaceRaised = Color(0xE125333E)
private val DarkSurfaceBorder = Color(0x12B0CEE2)
private val DarkText = Color(0xFFE7EEF3)
private val DarkTextMuted = Color(0xFF93A2B1)
private val DarkTextSubtle = Color(0xFF627180)
private val DarkPrimary = Color(0xFFE95D2C)
private val DarkPrimaryDim = Color(0x2EE95D2C)
private val DarkPrimaryHover = Color(0xFFFF7441)
private val DarkSecondary = Color(0xFFB0CEE2)
private val DarkCta = Color(0xFFE95D2C)
private val DarkCtaText = Color(0xFFFFFFFF)
private val DarkFillSoft = Color(0xFF16232B)
private val DarkFillSubtle = Color(0xFF121D25)
private val DarkSuccess = Color(0xFF34D86B)
private val DarkWarning = Color(0xFFFBBF24)
private val DarkDanger = Color(0xFFF87171)
private val DarkGlassBg = Color(0xA8111B23)
private val DarkGlassBgHeavy = Color(0xD118242E)
private val DarkGlassBorder = Color(0x14B0CEE2)
private val DarkGlassHighlight = Color(0x14B0CEE2)

// Paper theme (premium)
private val PaperBg = Color(0xFFFDF5EC)
private val PaperBgOffset = Color(0xFFEDDFC8)
private val PaperSurface = Color(0xE0FDF5EC)
private val PaperSurfaceRaised = Color(0xF5EDDFC8)
private val PaperSurfaceBorder = Color(0x2EB4946E)
private val PaperText = Color(0xFF3D2B1A)
private val PaperTextMuted = Color(0xFF7A5C42)
private val PaperTextSubtle = Color(0xFFA88C70)
private val PaperPrimary = Color(0xFF8C3D2E)
private val PaperPrimaryDim = Color(0x1F8C3D2E)
private val PaperPrimaryHover = Color(0xFF7A3326)
private val PaperSecondary = Color(0xFFC4956A)
private val PaperCta = Color(0xFF722F37)
private val PaperCtaText = Color(0xFFFDF5EC)
private val PaperFillSoft = Color(0xFFE4D4BA)
private val PaperFillSubtle = Color(0xFFF5ECE0)
private val PaperSuccess = Color(0xFF6B7A4E)
private val PaperWarning = Color(0xFFB87A2E)
private val PaperDanger = Color(0xFFA83228)
private val PaperGlassBg = Color(0xB8EDDFC8)
private val PaperGlassBgHeavy = Color(0xF0FDF5EC)
private val PaperGlassBorder = Color(0x38B4946E)
private val PaperGlassHighlight = Color(0xF0FFFCF8)

// ── Extended color tokens passed through CompositionLocal ────────────────────

/**
 * Myndral-specific colors beyond the Material 3 color scheme.
 * Injected via [LocalMyndralColors] so any Composable can read them.
 */
@Immutable
data class MyndralColors(
    val bg: Color,
    val bgOffset: Color,
    val surface: Color,
    val surfaceRaised: Color,
    val surfaceBorder: Color,
    val text: Color,
    val textMuted: Color,
    val textSubtle: Color,
    val primary: Color,
    val primaryDim: Color,
    val secondary: Color,
    val cta: Color,
    val ctaText: Color,
    val fillSoft: Color,
    val fillSubtle: Color,
    val success: Color,
    val warning: Color,
    val danger: Color,
    val glassBg: Color,
    val glassBgHeavy: Color,
    val glassBorder: Color,
    val glassHighlight: Color,
    val isLight: Boolean,
)

val LocalMyndralColors = staticCompositionLocalOf {
    lightMyndralColors() // safe default — overridden by MyndralTheme
}

fun lightMyndralColors() = MyndralColors(
    bg = LightBg, bgOffset = LightBgOffset, surface = LightSurface,
    surfaceRaised = LightSurfaceRaised, surfaceBorder = LightSurfaceBorder,
    text = LightText, textMuted = LightTextMuted, textSubtle = LightTextSubtle,
    primary = LightPrimary, primaryDim = LightPrimaryDim, secondary = LightSecondary,
    cta = LightCta, ctaText = LightCtaText, fillSoft = LightFillSoft,
    fillSubtle = LightFillSubtle, success = LightSuccess, warning = LightWarning,
    danger = LightDanger, glassBg = LightGlassBg, glassBgHeavy = LightGlassBgHeavy,
    glassBorder = LightGlassBorder, glassHighlight = LightGlassHighlight, isLight = true,
)

fun darkMyndralColors() = MyndralColors(
    bg = DarkBg, bgOffset = DarkBgOffset, surface = DarkSurface,
    surfaceRaised = DarkSurfaceRaised, surfaceBorder = DarkSurfaceBorder,
    text = DarkText, textMuted = DarkTextMuted, textSubtle = DarkTextSubtle,
    primary = DarkPrimary, primaryDim = DarkPrimaryDim, secondary = DarkSecondary,
    cta = DarkCta, ctaText = DarkCtaText, fillSoft = DarkFillSoft,
    fillSubtle = DarkFillSubtle, success = DarkSuccess, warning = DarkWarning,
    danger = DarkDanger, glassBg = DarkGlassBg, glassBgHeavy = DarkGlassBgHeavy,
    glassBorder = DarkGlassBorder, glassHighlight = DarkGlassHighlight, isLight = false,
)

fun paperMyndralColors() = MyndralColors(
    bg = PaperBg, bgOffset = PaperBgOffset, surface = PaperSurface,
    surfaceRaised = PaperSurfaceRaised, surfaceBorder = PaperSurfaceBorder,
    text = PaperText, textMuted = PaperTextMuted, textSubtle = PaperTextSubtle,
    primary = PaperPrimary, primaryDim = PaperPrimaryDim, secondary = PaperSecondary,
    cta = PaperCta, ctaText = PaperCtaText, fillSoft = PaperFillSoft,
    fillSubtle = PaperFillSubtle, success = PaperSuccess, warning = PaperWarning,
    danger = PaperDanger, glassBg = PaperGlassBg, glassBgHeavy = PaperGlassBgHeavy,
    glassBorder = PaperGlassBorder, glassHighlight = PaperGlassHighlight, isLight = true,
)

// ── Material 3 colour schemes (uses matching primaries) ──────────────────────

private val LightColorScheme = lightColorScheme(
    primary = LightPrimary, onPrimary = Color.White,
    background = LightBg, onBackground = LightText,
    surface = LightSurface, onSurface = LightText,
    surfaceVariant = LightSurfaceRaised, onSurfaceVariant = LightTextMuted,
    error = LightDanger, onError = Color.White,
)

private val DarkColorScheme = darkColorScheme(
    primary = DarkPrimary, onPrimary = Color.White,
    background = DarkBg, onBackground = DarkText,
    surface = DarkSurface, onSurface = DarkText,
    surfaceVariant = DarkSurfaceRaised, onSurfaceVariant = DarkTextMuted,
    error = DarkDanger, onError = Color.White,
)

private val PaperColorScheme = lightColorScheme(
    primary = PaperCta, onPrimary = PaperCtaText,
    background = PaperBg, onBackground = PaperText,
    surface = PaperSurface, onSurface = PaperText,
    surfaceVariant = PaperSurfaceRaised, onSurfaceVariant = PaperTextMuted,
    error = PaperDanger, onError = PaperCtaText,
)

// ── Typography ────────────────────────────────────────────────────────────────

private val MyndralTypography = Typography(
    displayLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp),
    displayMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold, fontSize = 24.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold, fontSize = 20.sp),
    headlineSmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.SemiBold, fontSize = 18.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 14.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 14.sp),
    bodySmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 12.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.SemiBold, fontSize = 13.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold, fontSize = 11.sp),
)

// ── Theme entry point ─────────────────────────────────────────────────────────

/**
 * Top-level theming composable.
 * Applies one of three brand themes (light / dark / paper) based on [appTheme],
 * making the custom [MyndralColors] available via [LocalMyndralColors].
 */
@Composable
fun MyndralTheme(
    appTheme: AppTheme = AppTheme.LIGHT,
    content: @Composable () -> Unit,
) {
    val myndralColors = when (appTheme) {
        AppTheme.LIGHT -> lightMyndralColors()
        AppTheme.DARK -> darkMyndralColors()
        AppTheme.PAPER -> paperMyndralColors()
    }
    val colorScheme = when (appTheme) {
        AppTheme.LIGHT -> LightColorScheme
        AppTheme.DARK -> DarkColorScheme
        AppTheme.PAPER -> PaperColorScheme
    }

    CompositionLocalProvider(LocalMyndralColors provides myndralColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = MyndralTypography,
            content = content,
        )
    }
}

/** Convenience accessor — avoids importing [LocalMyndralColors] everywhere. */
val myndralColors: MyndralColors
    @Composable get() = LocalMyndralColors.current
