package com.myndral.app.di

import com.myndral.app.data.api.MyndralApiService
import com.myndral.app.data.datastore.AuthDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    /**
     * Priority-ordered list of base URLs.
     * In production the app always reaches `api.myndral.com`.
     * During local development on a device/emulator, the first reachable URL wins.
     */
    private const val BASE_URL = "https://api.myndral.com/"

    @Provides
    @Singleton
    fun provideAuthInterceptor(authDataStore: AuthDataStore): Interceptor =
        Interceptor { chain ->
            val token = authDataStore.getToken()
            val request = if (token != null) {
                chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: Interceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                }
            )
            .build()

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides
    @Singleton
    fun provideMyndralApiService(retrofit: Retrofit): MyndralApiService =
        retrofit.create(MyndralApiService::class.java)
}
