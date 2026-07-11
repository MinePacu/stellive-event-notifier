package dev.minepacu.stelliveeventnotifier.feature.songs

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem

object SongIdentity {
    fun identifier(song: SongCatalogItem): String? =
        song.youtubeVideoId.trim().takeIf(String::isNotEmpty)?.let { "youtube:$it" }
            ?: song.id.trim().takeIf(String::isNotEmpty)?.let { "song:$it" }
}
