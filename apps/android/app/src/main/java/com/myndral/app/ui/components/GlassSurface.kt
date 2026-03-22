package com.myndral.app.ui.components

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shader
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.myndral.app.ui.theme.myndralColors

/**
 * Glassmorphic container — the primary surface component in the Myndral design system.
 *
 * On Android 12+ (API 31) uses [RenderEffect] with a blur radius to create the
 * frosted-glass look that matches `expo-glass-effect` on iOS. On older API levels
 * (not supported per minSdk = 31) the blur is always applied.
 *
 * Design decisions:
 *  - Semi-transparent [glassBg] background mimics the CSS `backdrop-filter: blur(18px)`.
 *  - A 1 dp border using [glassBorder] creates the subtle edge highlight.
 *  - Corner radius defaults to 18 dp (--radius-lg token).
 */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 18.dp,
    heavy: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val colors = myndralColors
    val shape = RoundedCornerShape(cornerRadius)
    val bgColor = if (heavy) colors.glassBgHeavy else colors.glassBg

    Box(
        modifier = modifier
            .clip(shape)
            .background(bgColor, shape)
            .border(1.dp, colors.glassBorder, shape)
            // RenderEffect blur — simulates backdrop-filter on Android 12+
            .graphicsLayer {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    renderEffect = android.graphics.RenderEffect
                        .createBlurEffect(
                            if (heavy) 30f else 18f,
                            if (heavy) 30f else 18f,
                            android.graphics.Shader.TileMode.CLAMP
                        )
                        .asComposeRenderEffect()
                }
            },
        content = content,
    )
}
