package com.myndral.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.domain.model.Album
import com.myndral.app.ui.theme.myndralColors

/**
 * Horizontal-scroll card for an album — mirrors iOS AlbumCard.
 * Fixed 140 dp wide with square artwork and two lines of text.
 */
@Composable
fun AlbumCard(
    album: Album,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val colors = myndralColors

    Column(
        modifier = modifier
            .width(140.dp)
            .clickable { onClick() },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        RemoteArtwork(
            uri = album.coverUrl,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f),
            cornerRadius = 12.dp,
        )
        Text(
            text = album.title,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = album.artist.name,
            fontSize = 11.sp,
            color = colors.textMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
