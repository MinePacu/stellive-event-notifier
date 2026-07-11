package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongType
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SongFavoritesPolicyTest {
    @Test
    fun identifierPrefersVideoThenSongAndRejectsEmptyValues() {
        assertEquals("youtube:video", MainUiPolicy.songFavoriteIdentifier(song("fallback", "video")))
        assertEquals("song:fallback", MainUiPolicy.songFavoriteIdentifier(song("fallback", "")))
        assertNull(MainUiPolicy.songFavoriteIdentifier(song(" ", " ")))
    }

    @Test
    fun favoritesCombineWithExistingFiltersAndExposeDistinctEmptyStates() {
        val favorite = song("one", "video-1")
        val other = song("two", "video-2")
        val favorites = setOf("youtube:video-1", "song:unknown")
        assertTrue(MainUiPolicy.songMatchesLibrary(favorite, "favorites", favorites))
        assertFalse(MainUiPolicy.songMatchesLibrary(other, "favorites", favorites))
        assertTrue(MainUiPolicy.songMatchesLibrary(other, "all", favorites))
        assertEquals("즐겨찾기한 노래가 없습니다. 노래 카드의 별 버튼으로 추가해 보세요.", MainUiPolicy.songFavoriteEmptyMessage(false))
        assertEquals("현재 필터 조건에 맞는 즐겨찾기가 없습니다.", MainUiPolicy.songFavoriteEmptyMessage(true))
    }

    private fun song(id: String, videoId: String) = SongCatalogItem(
        id = id,
        youtubeVideoId = videoId,
        title = "Song",
        type = SongType.COVER,
    )
}
