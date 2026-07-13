package dev.minepacu.stelliveeventnotifier.feature.songs

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import java.net.URI

object SongLinkPolicy {
    private val allowedHosts = setOf("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be")
    private val videoIdPattern = Regex("^[A-Za-z0-9_-]{11}$")
    private val playlistIdPattern = Regex("^[A-Za-z0-9_-]{10,}$")

    fun videoUrl(song: SongCatalogItem): String? {
        val videoId = song.youtubeVideoId.trim()
        if (videoIdPattern.matches(videoId)) return "https://www.youtube.com/watch?v=$videoId"
        return validatedYoutubeUrl(song.youtubeUrl) ?: validatedYoutubeUrl(song.sourceUrl)
    }

    fun validatedYoutubeUrl(raw: String?): String? {
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
        return uri.toString().takeIf { videoId != null && videoIdPattern.matches(videoId) }
    }

    fun playlistUrl(playlistId: String?): String? = playlistId?.trim()
        ?.takeIf(playlistIdPattern::matches)
        ?.let { "https://www.youtube.com/playlist?list=$it" }

    const val unavailableReason = "유효한 YouTube HTTPS 링크가 없어 사용할 수 없습니다"
}
