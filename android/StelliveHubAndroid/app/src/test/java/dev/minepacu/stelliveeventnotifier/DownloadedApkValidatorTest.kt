package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateManifest
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdatePolicy
import dev.minepacu.stelliveeventnotifier.feature.update.DownloadedApkMetadata
import dev.minepacu.stelliveeventnotifier.feature.update.DownloadedApkValidationError
import dev.minepacu.stelliveeventnotifier.feature.update.DownloadedApkValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadedApkValidatorTest {
    @Test
    fun `accepts exact metadata and a trusted signer`() {
        val result = DownloadedApkValidator.validate(
            manifest = manifest,
            metadata = metadata(),
            installedTrustedSignerSha256 = setOf(SIGNER),
        )

        assertTrue(result.isValid)
    }

    @Test
    fun `reports package version size and hash mismatches`() {
        val result = DownloadedApkValidator.validate(
            manifest = manifest,
            metadata = metadata().copy(
                packageName = "example.invalid",
                versionCode = 13,
                fileSize = 999,
                sha256 = "b".repeat(64),
            ),
            installedTrustedSignerSha256 = setOf(SIGNER),
        )

        assertEquals(
            setOf(
                DownloadedApkValidationError.PACKAGE_NAME,
                DownloadedApkValidationError.VERSION_CODE,
                DownloadedApkValidationError.FILE_SIZE,
                DownloadedApkValidationError.SHA256,
            ),
            result.errors,
        )
    }

    @Test
    fun `rejects apk without a signer trusted by installed app`() {
        val result = DownloadedApkValidator.validate(
            manifest = manifest,
            metadata = metadata().copy(signerSha256 = setOf("new-signer")),
            installedTrustedSignerSha256 = setOf(SIGNER),
        )

        assertEquals(setOf(DownloadedApkValidationError.SIGNING_CERTIFICATE), result.errors)
    }

    @Test
    fun `rejects manifest and downloaded apk over size limit`() {
        val size = AndroidUpdatePolicy.MAX_APK_SIZE_BYTES + 1
        val oversizedManifest = manifest.copy(apkSize = size)
        val result = DownloadedApkValidator.validate(
            manifest = oversizedManifest,
            metadata = metadata().copy(fileSize = size),
            installedTrustedSignerSha256 = setOf(SIGNER),
        )

        assertEquals(setOf(DownloadedApkValidationError.FILE_SIZE_LIMIT), result.errors)
    }

    private fun metadata() = DownloadedApkMetadata(
        packageName = manifest.packageName,
        versionCode = manifest.versionCode,
        fileSize = manifest.apkSize,
        sha256 = manifest.sha256.uppercase(),
        signerSha256 = setOf(SIGNER),
    )

    private val manifest = AndroidUpdateManifest(
        schemaVersion = 1,
        packageName = "dev.minepacu.stelliveeventnotifier",
        versionCode = 12,
        versionName = "1.2.0",
        minimumSupportedVersionCode = 1,
        mandatory = false,
        apkAssetName = "stellive-hub-android-v1.2.0.apk",
        apkSize = 1_024,
        sha256 = "a".repeat(64),
    )

    companion object {
        private const val SIGNER = "trusted-signer"
    }
}
