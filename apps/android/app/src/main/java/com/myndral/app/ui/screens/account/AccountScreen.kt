package com.myndral.app.ui.screens.account

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Studio
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.data.datastore.AppTheme
import com.myndral.app.domain.model.SubscriptionPlan
import com.myndral.app.domain.model.hasStudioAccess
import com.myndral.app.ui.theme.myndralColors

@Composable
fun AccountScreen(
    onNavigateToStudio: () -> Unit,
    onNavigateToStudioAccess: () -> Unit,
    onLogout: () -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors
    val user = state.user

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 20.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Text(text = "Account", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)

        // Profile card
        if (user != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(colors.glassBg, RoundedCornerShape(18.dp))
                    .padding(18.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Avatar placeholder
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(colors.primaryDim),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = user.displayName.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(text = user.displayName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)
                    Text(text = "@${user.username}", fontSize = 13.sp, color = colors.textMuted)
                    Text(
                        text = when (user.subscriptionPlan) {
                            SubscriptionPlan.PREMIUM_MONTHLY -> "Premium Monthly"
                            SubscriptionPlan.PREMIUM_ANNUAL -> "Premium Annual"
                            SubscriptionPlan.FREE -> "Free Plan"
                        },
                        fontSize = 12.sp,
                        color = colors.primary,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }

        // Theme selector
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.glassBg, RoundedCornerShape(18.dp))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(text = "Appearance", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.text)

            val themes = listOf(
                AppTheme.LIGHT to "Light",
                AppTheme.DARK to "Dark",
                AppTheme.PAPER to "Minkowski Paper${if (user?.subscriptionPlan == SubscriptionPlan.FREE) " (Premium)" else ""}",
            )

            themes.forEach { (theme, label) ->
                val selected = state.currentTheme == theme
                val isPremiumLocked = theme == AppTheme.PAPER && user?.subscriptionPlan == SubscriptionPlan.FREE

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (selected) colors.primaryDim else colors.fillSubtle)
                        .border(
                            width = if (selected) 1.5.dp else 1.dp,
                            color = if (selected) colors.primary else colors.surfaceBorder,
                            shape = RoundedCornerShape(12.dp),
                        )
                        .clickable(enabled = !isPremiumLocked) { viewModel.setTheme(theme) }
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = label,
                        fontSize = 14.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isPremiumLocked) colors.textSubtle else colors.text,
                    )
                    if (selected) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(colors.primary),
                        )
                    }
                }
            }
        }

        // Studio access
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.glassBg, RoundedCornerShape(18.dp))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(text = "Creator Studio", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.text)

            if (user != null && user.role.hasStudioAccess()) {
                Button(
                    onClick = onNavigateToStudio,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
                ) {
                    Icon(imageVector = Icons.Default.Studio, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Open Studio", fontWeight = FontWeight.Bold)
                }
            } else {
                Text(
                    text = "Have an access token? Claim studio access to create and manage content.",
                    fontSize = 13.sp,
                    color = colors.textMuted,
                )
                OutlinedButton(
                    onClick = onNavigateToStudioAccess,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.primary),
                ) {
                    Text("Claim Studio Access", fontWeight = FontWeight.Bold)
                }
            }
        }

        // Logout
        OutlinedButton(
            onClick = { viewModel.logout(onLogout) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.danger),
        ) {
            Icon(imageVector = Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Sign Out", fontWeight = FontWeight.SemiBold)
        }
    }
}
