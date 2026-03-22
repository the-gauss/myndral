package com.myndral.app.ui.screens.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.myndral.app.data.datastore.AppTheme
import com.myndral.app.data.datastore.ThemeDataStore
import com.myndral.app.data.repository.AuthRepository
import com.myndral.app.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountUiState(
    val user: User? = null,
    val currentTheme: AppTheme = AppTheme.LIGHT,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val themeDataStore: ThemeDataStore,
) : ViewModel() {

    private val _user = MutableStateFlow<User?>(null)

    val state: StateFlow<AccountUiState> = combine(
        _user,
        themeDataStore.themeFlow,
    ) { user, theme ->
        AccountUiState(user = user, currentTheme = theme)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AccountUiState())

    init {
        viewModelScope.launch {
            runCatching { authRepository.getMe() }
                .onSuccess { _user.value = it }
        }
    }

    fun setTheme(theme: AppTheme) {
        viewModelScope.launch { themeDataStore.setTheme(theme) }
    }

    fun logout(onComplete: () -> Unit) {
        authRepository.logout()
        onComplete()
    }
}
