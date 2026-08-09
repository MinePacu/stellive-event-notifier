package dev.minepacu.stelliveeventnotifier.feature.update

import com.squareup.moshi.Json
import java.io.File

data class AndroidUpdateManifest(
    val schemaVersion: Int,
    val packageName: String,
    val versionCode: Long,
    val versionName: String,
    val minimumSupportedVersionCode: Long,
    val mandatory: Boolean,
    val apkAssetName: String,
    val apkSize: Long,
    val sha256: String,
)

data class AndroidUpdateCandidate(
    val manifest: AndroidUpdateManifest,
    val tagName: String,
    val apkDownloadUrl: String,
    val releaseHtmlUrl: String,
)

internal data class GitHubReleaseDto(
    @Json(name = "tag_name") val tagName: String,
    @Json(name = "html_url") val htmlUrl: String,
    val draft: Boolean,
    val prerelease: Boolean,
    val assets: List<GitHubReleaseAssetDto>,
)

internal data class GitHubReleaseAssetDto(
    val name: String,
    val size: Long,
    @Json(name = "browser_download_url") val browserDownloadUrl: String,
)

internal data class AndroidUpdateCandidatePayload(
    val manifest: AndroidUpdateManifest,
    val tagName: String,
    val releaseHtmlUrl: String,
    val apkAsset: GitHubReleaseAssetDto,
)

data class DownloadedApkMetadata(
    val packageName: String?,
    val versionCode: Long?,
    val fileSize: Long,
    val sha256: String,
    val signerSha256: Set<String>,
)

data class AndroidUpdateDownloadArtifact(
    val temporaryFile: File,
    val finalFile: File,
)

enum class DownloadedApkValidationError {
    PACKAGE_NAME,
    VERSION_CODE,
    FILE_SIZE,
    FILE_SIZE_LIMIT,
    SHA256,
    SIGNING_CERTIFICATE,
}

data class DownloadedApkValidationResult(
    val errors: Set<DownloadedApkValidationError>,
) {
    val isValid: Boolean
        get() = errors.isEmpty()
}
