package com.myndral.app.ui.screens.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.myndral.app.data.repository.AuthRepository
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import com.myndral.app.ui.components.PrimaryButton
import com.myndral.app.ui.theme.myndralColors
import javax.inject.Inject

data class StudioAccessUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class StudioAccessViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StudioAccessUiState())
    val state: StateFlow<StudioAccessUiState> = _state.asStateFlow()

    fun claim(username: String, password: String, token: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                authRepository.studioClaim(username, password, token)
                _state.update { it.copy(isLoading = false, success = true) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Invalid access token") }
            }
        }
    }
}

@Composable
fun StudioAccessScreen(
    onBack: () -> Unit,
    onSuccess: () -> Unit,
    viewModel: StudioAccessViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val colors = myndralColors

    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var token by remember { mutableStateOf("") }

    LaunchedEffect(state.success) {
        if (state.success) onSuccess()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(horizontal = 24.dp)
            .padding(top = 16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = colors.text,
                )
            }
        }

        Text(text = "Claim Studio Access", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
        Text(
            text = "Enter your credentials and the access token provided by an administrator.",
            fontSize = 14.sp,
            color = colors.textMuted,
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

        OutlinedTextField(
            value = token,
            onValueChange = { token = it },
            label = { Text("Studio Access Token") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                focusedLabelColor = colors.primary,
                unfocusedBorderColor = colors.surfaceBorder,
            ),
        )

        if (state.error != null) {
            Text(text = state.error!!, color = colors.danger, fontSize = 13.sp)
        }

        PrimaryButton(
            label = if (state.isLoading) "Claiming access…" else "Claim Access",
            onClick = { viewModel.claim(username.trim(), password, token.trim()) },
            enabled = !state.isLoading && username.isNotBlank() && password.isNotBlank() && token.isNotBlank(),
        )
    }
}
