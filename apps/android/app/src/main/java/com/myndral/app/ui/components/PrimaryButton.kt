package com.myndral.app.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.ui.theme.myndralColors

/** Full-width CTA button — mirrors iOS PrimaryButton. */
@Composable
fun PrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    secondary: Boolean = false,
    enabled: Boolean = true,
) {
    val colors = myndralColors
    val shape = RoundedCornerShape(22.dp)

    if (secondary) {
        OutlinedButton(
            onClick = onClick,
            enabled = enabled,
            shape = shape,
            modifier = modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.primary),
        ) {
            Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
    } else {
        Button(
            onClick = onClick,
            enabled = enabled,
            shape = shape,
            modifier = modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = colors.cta,
                contentColor = colors.ctaText,
            ),
        ) {
            Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
    }
}
