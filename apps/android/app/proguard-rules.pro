# Retrofit / OkHttp
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-dontwarn retrofit2.**

# Gson — keep all DTO fields for serialisation
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Media3 / ExoPlayer
-keep class androidx.media3.** { *; }

# App domain / API models (never obfuscate field names — they must match JSON keys)
-keep class com.myndral.app.data.api.dto.** { *; }
-keep class com.myndral.app.domain.model.** { *; }
