package dev.minepacu.stelliveeventnotifier.feature.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

class AndroidUpdateDownloader(private val context: Context) {
    private val downloadManager = context.getSystemService(DownloadManager::class.java)

    suspend fun downloadToTemporary(candidate: AndroidUpdateCandidate): AndroidUpdateDownloadArtifact {
        require(candidate.manifest.apkSize in 1..AndroidUpdatePolicy.MAX_APK_SIZE_BYTES) {
            "update_file_size_out_of_policy"
        }
        val directory = File(
            context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            UPDATE_DIRECTORY,
        )
        check(directory.exists() || directory.mkdirs()) { "update_directory_unavailable" }
        val artifact = AndroidUpdateDownloadArtifact(
            temporaryFile = File(directory, "${candidate.manifest.apkAssetName}.part"),
            finalFile = File(directory, candidate.manifest.apkAssetName),
        )
        discard(artifact)
        check(!artifact.temporaryFile.exists() && !artifact.finalFile.exists()) {
            "stale_update_file_unavailable"
        }
        val request = DownloadManager.Request(Uri.parse(candidate.apkDownloadUrl))
            .setTitle("스텔라이브 이벤트 알리미 ${candidate.manifest.versionName}")
            .setDescription("업데이트 파일 다운로드 중")
            .setMimeType(APK_MIME_TYPE)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setDestinationUri(Uri.fromFile(artifact.temporaryFile))
        return try {
            val downloadId = downloadManager.enqueue(request)
            awaitDownload(downloadId)
            check(artifact.temporaryFile.isFile) { "downloaded_update_file_missing" }
            check(artifact.temporaryFile.length() <= AndroidUpdatePolicy.MAX_APK_SIZE_BYTES) {
                "downloaded_update_file_too_large"
            }
            artifact
        } catch (throwable: Throwable) {
            discard(artifact)
            throw throwable
        }
    }

    fun promoteValidated(artifact: AndroidUpdateDownloadArtifact): File {
        check(artifact.temporaryFile.isFile) { "temporary_update_file_missing" }
        check(artifact.temporaryFile.length() <= AndroidUpdatePolicy.MAX_APK_SIZE_BYTES) {
            "validated_update_file_too_large"
        }
        if (artifact.finalFile.exists() && !artifact.finalFile.delete()) {
            error("stale_final_update_file_unavailable")
        }
        check(artifact.temporaryFile.renameTo(artifact.finalFile)) {
            "validated_update_file_promotion_failed"
        }
        return artifact.finalFile
    }

    fun discard(artifact: AndroidUpdateDownloadArtifact) {
        artifact.temporaryFile.takeIf(File::exists)?.delete()
        artifact.finalFile.takeIf(File::exists)?.delete()
    }

    private suspend fun awaitDownload(downloadId: Long) = withContext(Dispatchers.IO) {
        while (true) {
            downloadManager.query(DownloadManager.Query().setFilterById(downloadId)).use { cursor ->
                check(cursor != null && cursor.moveToFirst()) { "download_not_found" }
                when (cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
                    DownloadManager.STATUS_SUCCESSFUL -> return@withContext
                    DownloadManager.STATUS_FAILED -> {
                        val reason = cursor.getInt(
                            cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON),
                        )
                        error("download_failed_$reason")
                    }
                }
            }
            delay(DOWNLOAD_POLL_INTERVAL_MILLIS)
        }
    }

    companion object {
        private const val UPDATE_DIRECTORY = "updates"
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        private const val DOWNLOAD_POLL_INTERVAL_MILLIS = 500L
    }
}

class AndroidApkInspector(private val context: Context) {
    suspend fun validate(
        file: File,
        manifest: AndroidUpdateManifest,
    ): DownloadedApkValidationResult = withContext(Dispatchers.IO) {
        val archive = packageInfoForArchive(file)
        val metadata = DownloadedApkMetadata(
            packageName = archive?.packageName,
            versionCode = archive?.longVersionCodeCompat(),
            fileSize = file.length(),
            sha256 = file.sha256(),
            signerSha256 = archive.signerDigests(),
        )
        val installed = context.packageManager.getPackageInfoCompat(context.packageName)
        DownloadedApkValidator.validate(
            manifest = manifest,
            metadata = metadata,
            installedTrustedSignerSha256 = installed.signerDigests(),
        )
    }

    private fun packageInfoForArchive(file: File): PackageInfo? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getPackageArchiveInfo(
                file.absolutePath,
                PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()),
            )
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageArchiveInfo(
                file.absolutePath,
                PackageManager.GET_SIGNING_CERTIFICATES,
            )
        }
}

class AndroidUpdateInstaller(private val context: Context) {
    fun canRequestPackageInstalls(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()

    fun unknownSourcesSettingsIntent(): Intent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${context.packageName}"),
    )

    fun install(file: File) {
        val contentUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.updates.fileprovider",
            file,
        )
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(contentUri, APK_MIME_TYPE)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    companion object {
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    }
}

private fun PackageManager.getPackageInfoCompat(packageName: String): PackageInfo =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getPackageInfo(
            packageName,
            PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()),
        )
    } else {
        @Suppress("DEPRECATION")
        getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
    }

private fun PackageInfo?.signerDigests(): Set<String> {
    if (this == null) return emptySet()
    val signatures = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val signing = signingInfo ?: return emptySet()
        if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
    } else {
        @Suppress("DEPRECATION")
        signatures
    }).orEmpty()
    return signatures.mapTo(linkedSetOf()) { signature ->
        MessageDigest.getInstance("SHA-256")
            .digest(signature.toByteArray())
            .toHex()
    }
}

private fun PackageInfo.longVersionCodeCompat(): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) longVersionCode else {
        @Suppress("DEPRECATION")
        versionCode.toLong()
    }

private fun File.sha256(): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(this).use { input ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
        }
    }
    return digest.digest().toHex()
}

private fun ByteArray.toHex(): String =
    joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
