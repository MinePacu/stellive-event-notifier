package dev.minepacu.stelliveeventnotifier.feature.update

import java.util.Locale

object AndroidUpdatePolicy {
    const val SUPPORTED_SCHEMA_VERSION = 1
    const val MANIFEST_ASSET_NAME = "android-update.json"
    const val AUTOMATIC_CHECK_INTERVAL_MILLIS = 24L * 60L * 60L * 1_000L
    const val MAX_APK_SIZE_BYTES = 200L * 1_024L * 1_024L

    private val androidTagPattern = Regex("""^android-v[0-9]+(?:\.[0-9]+){1,3}(?:[-+][0-9A-Za-z.-]+)?$""")
    private val sha256Pattern = Regex("""^[0-9a-fA-F]{64}$""")

    internal fun isEligibleRelease(release: GitHubReleaseDto): Boolean =
        !release.draft &&
            !release.prerelease &&
            androidTagPattern.matches(release.tagName) &&
            release.assets.any { it.name == MANIFEST_ASSET_NAME }

    internal fun selectLatest(
        payloads: List<AndroidUpdateCandidatePayload>,
        installedPackageName: String,
        installedVersionCode: Long,
    ): AndroidUpdateCandidate? = payloads
        .asSequence()
        .filter { isValidPayload(it, installedPackageName, installedVersionCode) }
        .maxByOrNull { it.manifest.versionCode }
        ?.let { payload ->
            AndroidUpdateCandidate(
                manifest = payload.manifest.copy(sha256 = payload.manifest.sha256.lowercase(Locale.US)),
                tagName = payload.tagName,
                apkDownloadUrl = payload.apkAsset.browserDownloadUrl,
                releaseHtmlUrl = payload.releaseHtmlUrl,
            )
        }

    fun isMandatory(manifest: AndroidUpdateManifest, installedVersionCode: Long): Boolean =
        manifest.mandatory || installedVersionCode < manifest.minimumSupportedVersionCode

    fun shouldRunAutomaticCheck(
        lastCheckEpochMillis: Long?,
        nowEpochMillis: Long,
        intervalMillis: Long = AUTOMATIC_CHECK_INTERVAL_MILLIS,
    ): Boolean = lastCheckEpochMillis == null ||
        nowEpochMillis - lastCheckEpochMillis >= intervalMillis ||
        nowEpochMillis < lastCheckEpochMillis

    private fun isValidPayload(
        payload: AndroidUpdateCandidatePayload,
        installedPackageName: String,
        installedVersionCode: Long,
    ): Boolean {
        val manifest = payload.manifest
        val expectedTag = "android-v${manifest.versionName}"
        return manifest.schemaVersion == SUPPORTED_SCHEMA_VERSION &&
            manifest.packageName == installedPackageName &&
            manifest.versionCode > installedVersionCode &&
            manifest.versionName.isNotBlank() &&
            payload.tagName == expectedTag &&
            manifest.minimumSupportedVersionCode > 0 &&
            manifest.minimumSupportedVersionCode <= manifest.versionCode &&
            manifest.apkAssetName == payload.apkAsset.name &&
            manifest.apkAssetName.endsWith(".apk", ignoreCase = true) &&
            '/' !in manifest.apkAssetName &&
            '\\' !in manifest.apkAssetName &&
            manifest.apkSize > 0 &&
            manifest.apkSize <= MAX_APK_SIZE_BYTES &&
            manifest.apkSize == payload.apkAsset.size &&
            sha256Pattern.matches(manifest.sha256) &&
            payload.apkAsset.browserDownloadUrl.startsWith("https://") &&
            payload.releaseHtmlUrl.startsWith("https://")
    }
}

object DownloadedApkValidator {
    fun validate(
        manifest: AndroidUpdateManifest,
        metadata: DownloadedApkMetadata,
        installedTrustedSignerSha256: Set<String>,
    ): DownloadedApkValidationResult {
        val errors = buildSet {
            if (metadata.packageName != manifest.packageName) {
                add(DownloadedApkValidationError.PACKAGE_NAME)
            }
            if (metadata.versionCode != manifest.versionCode) {
                add(DownloadedApkValidationError.VERSION_CODE)
            }
            if (metadata.fileSize != manifest.apkSize) {
                add(DownloadedApkValidationError.FILE_SIZE)
            }
            if (manifest.apkSize > AndroidUpdatePolicy.MAX_APK_SIZE_BYTES ||
                metadata.fileSize > AndroidUpdatePolicy.MAX_APK_SIZE_BYTES
            ) {
                add(DownloadedApkValidationError.FILE_SIZE_LIMIT)
            }
            if (!metadata.sha256.equals(manifest.sha256, ignoreCase = true)) {
                add(DownloadedApkValidationError.SHA256)
            }
            if (installedTrustedSignerSha256.isEmpty() ||
                metadata.signerSha256.none(installedTrustedSignerSha256::contains)
            ) {
                add(DownloadedApkValidationError.SIGNING_CERTIFICATE)
            }
        }
        return DownloadedApkValidationResult(errors)
    }
}
