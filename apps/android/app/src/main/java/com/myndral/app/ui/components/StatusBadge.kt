package com.myndral.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.domain.model.ContentStatus
import com.myndral.app.domain.model.humanize
import com.myndral.app.ui.theme.myndralColors

/** Color-coded content status badge — mirrors iOS status chip. */
@Composable
fun StatusBadge(status: ContentStatus, modifier: Modifier = Modifier) {
    val colors = myndralColors
    val (bg, text) = when (status) {
        ContentStatus.PUBLISHED -> colors.success.copy(alpha = 0.15f) to colors.success
        ContentStatus.REVIEW -> colors.warning.copy(alpha = 0.15f) to colors.warning
        ContentStatus.ARCHIVED -> colors.textSubtle.copy(alpha = 0.15f) to colors.textSubtle
    }
    Text(
        text = status.humanize(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = text,
        modifier = modifier
            .background(bg, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}
