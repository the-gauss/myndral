package com.myndral.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.ui.theme.myndralColors

/** Centered spinner with optional label — mirrors iOS LoadingView. */
@Composable
fun LoadingView(label: String = "Loading...", modifier: Modifier = Modifier) {
    val colors = myndralColors
    Column(
        modifier = modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp)
        Text(text = label, fontSize = 13.sp, color = colors.textMuted)
    }
}
