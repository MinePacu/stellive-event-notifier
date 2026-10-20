# Moshi + KotlinJsonAdapterFactory reflects on Kotlin metadata, constructors and field names
# of every model it (de)serializes, so these must keep their names and members.
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations, RuntimeVisibleTypeAnnotations, AnnotationDefault, *Annotation*
-keep class kotlin.Metadata { *; }

# Hub API DTOs (Retrofit responses/requests): HubApiModels.kt, HubEventGoodsGalleryDto.kt.
-keep class dev.minepacu.stelliveeventnotifier.core.network.*Dto { *; }

# GitHub release / update manifest models parsed in AndroidUpdateRepository.
-keep class dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateManifest { *; }
-keep class dev.minepacu.stelliveeventnotifier.feature.update.GitHubReleaseDto { *; }
-keep class dev.minepacu.stelliveeventnotifier.feature.update.GitHubReleaseAssetDto { *; }
