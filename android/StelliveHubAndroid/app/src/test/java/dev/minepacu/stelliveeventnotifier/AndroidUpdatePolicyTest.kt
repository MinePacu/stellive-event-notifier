package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateCandidatePayload
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateManifest
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdatePolicy
import dev.minepacu.stelliveeventnotifier.feature.update.GitHubReleaseAssetDto
import dev.minepacu.stelliveeventnotifier.feature.update.GitHubReleaseDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidUpdatePolicyTest {
    @Test
    fun `release must be published android tag with update manifest`() {
        assertTrue(AndroidUpdatePolicy.isEligibleRelease(release()))
        assertFalse(AndroidUpdatePolicy.isEligibleRelease(release(tagName = "v1.2.0")))
        assertFalse(AndroidUpdatePolicy.isEligibleRelease(release(draft = true)))
        assertFalse(AndroidUpdatePolicy.isEligibleRelease(release(prerelease = true)))
        assertFalse(
            AndroidUpdatePolicy.isEligibleRelease(
                release(assets = listOf(apkAsset(versionName = "1.2.0"))),
            ),
        )
    }

    @Test
    fun `selects highest strictly newer valid version`() {
        val selected = AndroidUpdatePolicy.selectLatest(
            payloads = listOf(payload("1.1.0", 11), payload("1.3.0", 13), payload("1.2.0", 12)),
            installedPackageName = PACKAGE_NAME,
            installedVersionCode = 10,
        )

        assertEquals(13L, selected?.manifest?.versionCode)
        assertEquals("android-v1.3.0", selected?.tagName)
    }

    @Test
    fun `rejects manifest and release asset mismatches`() {
        val invalid = payload("1.2.0", 12).copy(
            manifest = manifest("1.2.0", 12).copy(
                packageName = "example.invalid",
                apkSize = APK_SIZE + 1,
            ),
        )

        assertNull(
            AndroidUpdatePolicy.selectLatest(
                payloads = listOf(invalid),
                installedPackageName = PACKAGE_NAME,
                installedVersionCode = 10,
            ),
        )
    }

    @Test
    fun `rejects path-like apk asset name and tag version mismatch`() {
        val pathLike = payload("1.2.0", 12).copy(
            manifest = manifest("1.2.0", 12).copy(apkAssetName = "../release.apk"),
            apkAsset = apkAsset("1.2.0").copy(name = "../release.apk"),
        )
        val mismatchedTag = payload("1.2.0", 12).copy(tagName = "android-v1.2.1")

        assertNull(AndroidUpdatePolicy.selectLatest(listOf(pathLike), PACKAGE_NAME, 10))
        assertNull(AndroidUpdatePolicy.selectLatest(listOf(mismatchedTag), PACKAGE_NAME, 10))
    }

    @Test
    fun `rejects release manifest over apk size limit`() {
        val oversized = payload("1.2.0", 12).let { payload ->
            val size = AndroidUpdatePolicy.MAX_APK_SIZE_BYTES + 1
            payload.copy(
                manifest = payload.manifest.copy(apkSize = size),
                apkAsset = payload.apkAsset.copy(size = size),
            )
        }

        assertNull(AndroidUpdatePolicy.selectLatest(listOf(oversized), PACKAGE_NAME, 10))
    }

    @Test
    fun `minimum supported version makes update mandatory`() {
        assertTrue(
            AndroidUpdatePolicy.isMandatory(
                manifest("1.2.0", 12).copy(minimumSupportedVersionCode = 11),
                installedVersionCode = 10,
            ),
        )
        assertTrue(
            AndroidUpdatePolicy.isMandatory(
                manifest("1.2.0", 12).copy(mandatory = true),
                installedVersionCode = 11,
            ),
        )
        assertFalse(AndroidUpdatePolicy.isMandatory(manifest("1.2.0", 12), installedVersionCode = 11))
    }

    @Test
    fun `automatic checks run after twenty four hours and tolerate clock rollback`() {
        val day = AndroidUpdatePolicy.AUTOMATIC_CHECK_INTERVAL_MILLIS
        assertFalse(AndroidUpdatePolicy.shouldRunAutomaticCheck(1_000, 1_000 + day - 1))
        assertTrue(AndroidUpdatePolicy.shouldRunAutomaticCheck(1_000, 1_000 + day))
        assertTrue(AndroidUpdatePolicy.shouldRunAutomaticCheck(2_000, 1_000))
        assertTrue(AndroidUpdatePolicy.shouldRunAutomaticCheck(null, 1_000))
    }

    private fun payload(versionName: String, versionCode: Long): AndroidUpdateCandidatePayload =
        AndroidUpdateCandidatePayload(
            manifest = manifest(versionName, versionCode),
            tagName = "android-v$versionName",
            releaseHtmlUrl = "https://github.com/MinePacu/stellive-event-notifier/releases/tag/android-v$versionName",
            apkAsset = apkAsset(versionName),
        )

    private fun manifest(versionName: String, versionCode: Long) = AndroidUpdateManifest(
        schemaVersion = 1,
        packageName = PACKAGE_NAME,
        versionCode = versionCode,
        versionName = versionName,
        minimumSupportedVersionCode = 1,
        mandatory = false,
        apkAssetName = "stellive-hub-android-v$versionName.apk",
        apkSize = APK_SIZE,
        sha256 = "a".repeat(64),
    )

    private fun release(
        tagName: String = "android-v1.2.0",
        draft: Boolean = false,
        prerelease: Boolean = false,
        assets: List<GitHubReleaseAssetDto> = listOf(
            GitHubReleaseAssetDto(
                name = AndroidUpdatePolicy.MANIFEST_ASSET_NAME,
                size = 512,
                browserDownloadUrl = "https://example.com/android-update.json",
            ),
            apkAsset("1.2.0"),
        ),
    ) = GitHubReleaseDto(
        tagName = tagName,
        htmlUrl = "https://github.com/MinePacu/stellive-event-notifier/releases/tag/$tagName",
        draft = draft,
        prerelease = prerelease,
        assets = assets,
    )

    private fun apkAsset(versionName: String) = GitHubReleaseAssetDto(
        name = "stellive-hub-android-v$versionName.apk",
        size = APK_SIZE,
        browserDownloadUrl = "https://example.com/stellive-hub-android-v$versionName.apk",
    )

    companion object {
        private const val PACKAGE_NAME = "dev.minepacu.stelliveeventnotifier"
        private const val APK_SIZE = 1_024L
    }
}
