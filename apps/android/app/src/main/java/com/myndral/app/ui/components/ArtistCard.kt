package com.myndral.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.domain.model.Artist
import com.myndral.app.ui.theme.myndralColors

/** Horizontal-scroll artist card with circular avatar — mirrors iOS ArtistCard. */
@Composable
fun ArtistCard(
    artist: Artist,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val colors = myndralColors

    Column(
        modifier = modifier
            .width(100.dp)
            .clickable { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        RemoteArtwork(
            uri = artist.imageUrl,
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape),
            cornerRadius = 40.dp,
        )
        Text(
            text = artist.name,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = colors.text,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
    }
}
