package com.myndral.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.domain.model.Playlist
import com.myndral.app.ui.theme.myndralColors

/** Row item for a playlist — mirrors iOS PlaylistListItem. */
@Composable
fun PlaylistListItem(
    playlist: Playlist,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val colors = myndralColors

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RemoteArtwork(
            uri = playlist.coverUrl,
            modifier = Modifier.size(52.dp),
            cornerRadius = 8.dp,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = playlist.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val meta = buildString {
                playlist.ownerDisplayName?.let { append(it) }
                val count = playlist.trackCount ?: playlist.tracks.size
                if (count > 0) {
                    if (isNotEmpty()) append(" · ")
                    append("$count songs")
                }
            }
            if (meta.isNotEmpty()) {
                Text(
                    text = meta,
                    fontSize = 12.sp,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
