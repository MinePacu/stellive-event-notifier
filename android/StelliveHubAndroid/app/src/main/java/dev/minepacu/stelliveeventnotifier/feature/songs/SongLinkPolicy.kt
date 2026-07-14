package dev.minepacu.stelliveeventnotifier.feature.songs

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import java.net.URI

object SongLinkPolicy {
    private val allowedHosts = setOf("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be")
    private val videoIdPattern = Regex("^[A-Za-z0-9_-]{11}$")
    private val playlistIdPattern = Regex("^[A-Za-z0-9_-]{10,}$")

    fun videoUrl(song: SongCatalogItem): String? = videoUrl(song, SongOpenTarget.YOUTUBE)

    fun videoUrl(song: SongCatalogItem, target: SongOpenTarget): String? =
        videoId(song)?.let { videoId ->
            when (target) {
                SongOpenTarget.YOUTUBE -> "https://www.youtube.com/watch?v=$videoId"
                SongOpenTarget.YOUTUBE_MUSIC -> "https://music.youtube.com/watch?v=$videoId"
            }
        }

    fun validatedYoutubeUrl(raw: String?): String? {
        val normalized = raw?.trim().orEmpty()
        return normalized.takeIf { validatedVideoId(it) != null }
    }

    private fun videoId(song: SongCatalogItem): String? {
        val directId = song.youtubeVideoId.trim()
        if (videoIdPattern.matches(directId)) return directId
        return validatedVideoId(song.youtubeUrl) ?: validatedVideoId(song.sourceUrl)
    }

    private fun validatedVideoId(raw: String?): String? {
        val uri = runCatching { URI(raw?.trim().orEmpty()) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true)) return null
        val host = uri.host?.lowercase() ?: return null
        if (host !in allowedHosts) return null
        val videoId = if (host == "youtu.be") {
            uri.path.trim('/').substringBefore('/')
        } else if (uri.path == "/watch") {
            uri.rawQuery.orEmpty().split('&').firstNotNullOfOrNull { part ->
                part.split('=', limit = 2).takeIf { it.firstOrNull() == "v" }?.getOrNull(1)
            }
        } else {
            listOf("/shorts/", "/live/", "/embed/").firstNotNullOfOrNull { prefix ->
                uri.path.takeIf { it.startsWith(prefix) }?.removePrefix(prefix)?.substringBefore('/')
            }
        }
        return videoId?.takeIf(videoIdPattern::matches)
    }

    fun playlistUrl(playlistId: String?): String? = playlistId?.trim()
        ?.takeIf(playlistIdPattern::matches)
        ?.let { "https://www.youtube.com/playlist?list=$it" }

    const val unavailableReason = "유효한 YouTube HTTPS 링크가 없어 사용할 수 없습니다"
}
