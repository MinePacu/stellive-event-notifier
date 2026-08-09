package dev.minepacu.stelliveeventnotifier.feature.update

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.GET
import retrofit2.http.Headers

interface AndroidUpdateRepository {
    suspend fun latestUpdate(
        installedPackageName: String,
        installedVersionCode: Long,
    ): AndroidUpdateCandidate?
}

internal interface GitHubReleasesApi {
    @Headers(
        "Accept: application/vnd.github+json",
        "X-GitHub-Api-Version: 2022-11-28",
    )
    @GET("repos/MinePacu/stellive-event-notifier/releases?per_page=30")
    suspend fun releases(): List<GitHubReleaseDto>
}

class GitHubReleaseAndroidUpdateRepository internal constructor(
    private val api: GitHubReleasesApi,
    private val okHttpClient: OkHttpClient,
    private val moshi: Moshi,
) : AndroidUpdateRepository {
    override suspend fun latestUpdate(
        installedPackageName: String,
        installedVersionCode: Long,
    ): AndroidUpdateCandidate? = withContext(Dispatchers.IO) {
        val payloads = api.releases()
            .asSequence()
            .filter(AndroidUpdatePolicy::isEligibleRelease)
            .mapNotNull(::loadCandidatePayload)
            .toList()
        AndroidUpdatePolicy.selectLatest(payloads, installedPackageName, installedVersionCode)
    }

    private fun loadCandidatePayload(release: GitHubReleaseDto): AndroidUpdateCandidatePayload? {
        val manifestAsset = release.assets.singleOrNull {
            it.name == AndroidUpdatePolicy.MANIFEST_ASSET_NAME
        } ?: return null
        val request = Request.Builder()
            .url(manifestAsset.browserDownloadUrl)
            .header("Accept", "application/octet-stream")
            .build()
        val manifest = runCatching {
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@runCatching null
                response.body?.source()?.let {
                    moshi.adapter(AndroidUpdateManifest::class.java).fromJson(it)
                }
            }
        }.getOrNull() ?: return null
        val apkAsset = release.assets.singleOrNull { it.name == manifest.apkAssetName } ?: return null
        return AndroidUpdateCandidatePayload(
            manifest = manifest,
            tagName = release.tagName,
            releaseHtmlUrl = release.htmlUrl,
            apkAsset = apkAsset,
        )
    }

    companion object {
        fun create(okHttpClient: OkHttpClient = OkHttpClient()): AndroidUpdateRepository {
            val moshi = Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
            val retrofit = Retrofit.Builder()
                .baseUrl("https://api.github.com/")
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
            return GitHubReleaseAndroidUpdateRepository(
                api = retrofit.create(GitHubReleasesApi::class.java),
                okHttpClient = okHttpClient,
                moshi = moshi,
            )
        }
    }
}
