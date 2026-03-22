package com.myndral.app.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.repository.AuthRepository
import com.myndral.app.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val user: User? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

/**
 * Shared ViewModel for authentication screens.
 * On init it tries to restore the session from the persisted token.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init {
        // Restore session if a token was previously saved
        val token = authRepository.getSavedToken()
        if (token != null) {
            viewModelScope.launch {
                try {
                    val user = authRepository.getMe()
                    _state.update { it.copy(user = user) }
                } catch (e: Exception) {
                    // Token expired or invalid — stay on login
                    authRepository.logout()
                }
            }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = authRepository.login(username, password)
                _state.update { it.copy(isLoading = false, user = result.user) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Login failed") }
            }
        }
    }

    fun register(username: String, email: String, password: String, displayName: String?) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = authRepository.register(username, email, password, displayName)
                _state.update { it.copy(isLoading = false, user = result.user) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Registration failed") }
            }
        }
    }

    fun logout() {
        authRepository.logout()
        _state.update { AuthUiState() }
    }

    fun clearError() = _state.update { it.copy(error = null) }
}
