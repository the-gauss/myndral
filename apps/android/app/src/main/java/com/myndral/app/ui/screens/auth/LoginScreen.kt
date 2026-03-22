package com.myndral.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.myndral.app.ui.components.PrimaryButton
import com.myndral.app.ui.theme.myndralColors

@Composable
fun LoginScreen(
    uiState: AuthUiState,
    onLogin: (username: String, password: String) -> Unit,
    onNavigateToRegister: () -> Unit,
) {
    val colors = myndralColors
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Wordmark
            Text(
                text = "Myndral",
                fontSize = 36.sp,
                fontWeight = FontWeight.ExtraBold,
                color = colors.primary,
            )
            Text(
                text = "Sign in to continue",
                fontSize = 16.sp,
                color = colors.textMuted,
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Username") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colors.primary,
                    focusedLabelColor = colors.primary,
                    unfocusedBorderColor = colors.surfaceBorder,
                ),
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colors.primary,
                    focusedLabelColor = colors.primary,
                    unfocusedBorderColor = colors.surfaceBorder,
                ),
            )

            // Error
            if (uiState.error != null) {
                Text(
                    text = uiState.error,
                    color = colors.danger,
                    fontSize = 13.sp,
                )
            }

            PrimaryButton(
                label = if (uiState.isLoading) "Signing in..." else "Sign In",
                onClick = { onLogin(username.trim(), password) },
                enabled = !uiState.isLoading && username.isNotBlank() && password.isNotBlank(),
            )

            TextButton(onClick = onNavigateToRegister) {
                Text(
                    text = "Don't have an account? Register",
                    color = colors.primary,
                    fontSize = 14.sp,
                )
            }
        }

        if (uiState.isLoading) {
            CircularProgressIndicator(
                color = colors.primary,
                modifier = Modifier.align(Alignment.Center),
            )
        }
    }
}
