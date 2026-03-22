package com.myndral.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
fun RegisterScreen(
    uiState: AuthUiState,
    onRegister: (username: String, email: String, password: String, displayName: String?) -> Unit,
    onNavigateToLogin: () -> Unit,
) {
    val colors = myndralColors
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 80.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Create Account",
                fontSize = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                color = colors.text,
            )
            Text(
                text = "Join Myndral and start listening",
                fontSize = 16.sp,
                color = colors.textMuted,
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Display Name (optional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colors.primary,
                    focusedLabelColor = colors.primary,
                    unfocusedBorderColor = colors.surfaceBorder,
                ),
            )

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
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
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

            if (uiState.error != null) {
                Text(text = uiState.error, color = colors.danger, fontSize = 13.sp)
            }

            PrimaryButton(
                label = if (uiState.isLoading) "Creating account..." else "Create Account",
                onClick = {
                    onRegister(
                        username.trim(),
                        email.trim(),
                        password,
                        displayName.trim().ifBlank { null },
                    )
                },
                enabled = !uiState.isLoading && username.isNotBlank()
                        && email.isNotBlank() && password.isNotBlank(),
            )

            TextButton(onClick = onNavigateToLogin) {
                Text(
                    text = "Already have an account? Sign In",
                    color = colors.primary,
                    fontSize = 14.sp,
                )
            }
        }
    }
}
