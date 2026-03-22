package com.myndral.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.domain.model.Track
import com.myndral.app.ui.theme.myndralColors
import kotlin.math.floor

/** Formats milliseconds → "m:ss" */
fun Long.toMinutesSeconds(): String {
    val totalSeconds = this / 1000
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "$m:${s.toString().padStart(2, '0')}"
}

/**
 * Compact track row — mirrors the iOS TrackRow component.
 * Shows: index, artwork thumbnail, title, artist/album, duration, favorite toggle, overflow menu.
 */
@Composable
fun TrackRow(
    track: Track,
    index: Int,
    isFavorite: Boolean,
    isInLibrary: Boolean,
    showAlbum: Boolean = false,
    onPlay: () -> Unit = {},
    onFavoriteToggle: () -> Unit = {},
    onMoreClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val colors = myndralColors

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onPlay() }
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Track number
        Text(
            text = index.toString(),
            fontSize = 13.sp,
            color = colors.textSubtle,
            modifier = Modifier.widthIn(min = 20.dp),
        )

        // Album art thumbnail
        RemoteArtwork(
            uri = track.album.coverUrl,
            modifier = Modifier.size(44.dp),
            cornerRadius = 8.dp,
        )

        // Title + subtitle
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = track.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val subtitle = if (showAlbum) {
                "${track.artist.name} · ${track.album.title}"
            } else {
                track.artist.name
            }
            Text(
                text = subtitle,
                fontSize = 12.sp,
                color = colors.textMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        // Duration
        Text(
            text = track.durationMs.toMinutesSeconds(),
            fontSize = 12.sp,
            color = colors.textSubtle,
        )

        // Favorite toggle
        IconButton(onClick = onFavoriteToggle, modifier = Modifier.size(36.dp)) {
            Icon(
                imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                contentDescription = if (isFavorite) "Unlike" else "Like",
                tint = if (isFavorite) colors.primary else colors.textSubtle,
                modifier = Modifier.size(18.dp),
            )
        }

        // Overflow menu
        IconButton(onClick = onMoreClick, modifier = Modifier.size(36.dp)) {
            Icon(
                imageVector = Icons.Default.MoreVert,
                contentDescription = "More options",
                tint = colors.textSubtle,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
