package com.myndral.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import com.myndral.app.ui.theme.myndralColors

/**
 * Lazy-loaded remote image with a placeholder icon.
 * Mirrors the iOS [RemoteArtwork] component which uses expo-image.
 */
@Composable
fun RemoteArtwork(
    uri: String?,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 12.dp,
) {
    val colors = myndralColors
    val shape = RoundedCornerShape(cornerRadius)

    if (uri != null) {
        SubcomposeAsyncImage(
            model = uri,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = modifier.clip(shape),
            loading = {
                Box(
                    modifier = Modifier.background(colors.fillSoft, shape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Default.MusicNote,
                        contentDescription = null,
                        tint = colors.textSubtle,
                    )
                }
            },
            error = {
                Box(
                    modifier = Modifier.background(colors.fillSoft, shape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Default.MusicNote,
                        contentDescription = null,
                        tint = colors.textSubtle,
                    )
                }
            },
        )
    } else {
        Box(
            modifier = modifier.clip(shape).background(colors.fillSoft, shape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Default.MusicNote,
                contentDescription = null,
                tint = colors.textSubtle,
            )
        }
    }
}
