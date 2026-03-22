package com.myndral.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.ui.components.PrimaryButton
import com.myndral.app.ui.theme.myndralColors

private data class PlanOption(
    val id: String,
    val name: String,
    val price: String,
    val features: List<String>,
)

private val plans = listOf(
    PlanOption(
        id = "free",
        name = "Free",
        price = "Free forever",
        features = listOf("Stream all tracks", "Create playlists", "Search & browse"),
    ),
    PlanOption(
        id = "premium_monthly",
        name = "Premium Monthly",
        price = "\$9.99/month",
        features = listOf(
            "Everything in Free", "Download tracks", "Paper theme", "No ads",
        ),
    ),
    PlanOption(
        id = "premium_annual",
        name = "Premium Annual",
        price = "\$79.99/year · Save 33%",
        features = listOf(
            "Everything in Premium Monthly", "Priority support",
        ),
    ),
)

/**
 * Onboarding plan selection screen — mirrors iOS choose-plan.tsx.
 * Currently UI-only (billing integration is handled server-side).
 */
@Composable
fun ChoosePlanScreen(
    onContinue: () -> Unit,
) {
    val colors = myndralColors
    var selectedPlan by remember { mutableStateOf("free") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = 60.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Text(
            text = "Choose Your Plan",
            fontSize = 30.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.text,
        )
        Text(
            text = "You can upgrade or cancel anytime.",
            fontSize = 15.sp,
            color = colors.textMuted,
        )

        plans.forEach { plan ->
            val selected = selectedPlan == plan.id
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (selected) colors.primaryDim else colors.surfaceRaised)
                    .border(
                        width = if (selected) 2.dp else 1.dp,
                        color = if (selected) colors.primary else colors.surfaceBorder,
                        shape = RoundedCornerShape(16.dp),
                    )
                    .clickable { selectedPlan = plan.id }
                    .padding(18.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = plan.name,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.text,
                        )
                        if (selected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Selected",
                                tint = colors.primary,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                    Text(
                        text = plan.price,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = colors.primary,
                    )
                    plan.features.forEach { feature ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = colors.success,
                                modifier = Modifier.size(14.dp),
                            )
                            Text(text = feature, fontSize = 13.sp, color = colors.textMuted)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        PrimaryButton(
            label = if (selectedPlan == "free") "Continue for Free" else "Get Started",
            onClick = onContinue,
        )
    }
}
