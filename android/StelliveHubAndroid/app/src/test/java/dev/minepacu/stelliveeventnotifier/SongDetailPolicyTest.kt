package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongMemberSummary
import dev.minepacu.stelliveeventnotifier.core.model.SongType
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberMatchMode
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDetailPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenPreferenceStore
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenTarget
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SongDetailPolicyTest {
    @Test
    fun `video id wins and produces one canonical URL for actions`() {
        val song = song(videoId = "AbCdEf123_-", youtubeUrl = "https://youtu.be/otherVideo1")
        assertEquals("https://www.youtube.com/watch?v=AbCdEf123_-", SongLinkPolicy.videoUrl(song))
        assertEquals(
            "https://music.youtube.com/watch?v=AbCdEf123_-",
            SongLinkPolicy.videoUrl(song, SongOpenTarget.YOUTUBE_MUSIC),
        )
    }

    @Test
    fun `only approved HTTPS YouTube hosts are accepted without homepage fallback`() {
        assertEquals(
            "https://www.youtube.com/watch?v=AbCdEf123_-",
            SongLinkPolicy.videoUrl(song(videoId = "bad", youtubeUrl = "https://youtu.be/AbCdEf123_-")),
        )
        assertNull(SongLinkPolicy.videoUrl(song(videoId = "bad", youtubeUrl = "http://www.youtube.com/watch?v=AbCdEf123_-")))
        assertNull(SongLinkPolicy.videoUrl(song(videoId = "bad", youtubeUrl = "https://example.com/watch?v=AbCdEf123_-")))
        assertNull(SongLinkPolicy.videoUrl(song(videoId = "bad", youtubeUrl = "not a url")))
        assertNull(SongLinkPolicy.videoUrl(song(videoId = "bad", youtubeUrl = "https://www.youtube.com")))
        assertNull(SongLinkPolicy.videoUrl(song(videoId = "bad", youtubeUrl = "https://www.youtube.com/watch?v=bad")))
    }

    @Test
    fun `song open target defaults and restores stable stored values`() {
        assertEquals(SongOpenTarget.YOUTUBE, SongOpenTarget.fromStoredValue(null))
        assertEquals(SongOpenTarget.YOUTUBE, SongOpenTarget.fromStoredValue("youtube"))
        assertEquals(SongOpenTarget.YOUTUBE_MUSIC, SongOpenTarget.fromStoredValue("youtube_music"))
        assertEquals(SongOpenTarget.YOUTUBE, SongOpenTarget.fromStoredValue("damaged"))
        assertEquals("YouTube에서 열기", SongOpenTarget.YOUTUBE.openButtonLabel)
        assertEquals("YouTube Music에서 열기", SongOpenTarget.YOUTUBE_MUSIC.openButtonLabel)
    }

    @Test
    fun `song open preference store persists changes and recovers damaged values`() {
        var storedValue: String? = null
        val store = SongOpenPreferenceStore(
            readStoredValue = { storedValue },
            writeStoredValue = { storedValue = it },
        )

        assertEquals(SongOpenTarget.YOUTUBE, store.read())
        store.write(SongOpenTarget.YOUTUBE_MUSIC)
        assertEquals("youtube_music", storedValue)
        assertEquals(SongOpenTarget.YOUTUBE_MUSIC, store.read())
        storedValue = "damaged"
        assertEquals(SongOpenTarget.YOUTUBE, store.read())
    }

    @Test
    fun `duration and optional detail rows follow display policy`() {
        assertEquals("3:21", SongDetailPolicy.durationText(song(durationSeconds = 201)))
        assertEquals("1:01:01", SongDetailPolicy.durationText(song(durationSeconds = 3661)))
        assertEquals("2:05", SongDetailPolicy.durationText(song(duration = "PT2M5S")))
        val rows = SongDetailPolicy.rows(song(isInstrumental = false, classificationStatus = null))
        assertFalse(rows.any { it.label == "반주곡" })
        assertFalse(rows.any { it.label == "분류 상태" })
        assertTrue(SongDetailPolicy.rows(song(isInstrumental = true)).any { it.label == "반주곡" })
    }

    @Test
    fun `related member filters preserve ANY and ALL semantics`() {
        val song = song(members = listOf(member("a"), member("b")))
        assertEquals(setOf("a"), SongDetailPolicy.memberFilter("a").selectedMemberIds)
        val all = SongDetailPolicy.allMembersFilter(song)
        assertEquals(setOf("a", "b"), all.selectedMemberIds)
        assertEquals(SongMemberMatchMode.ALL, all.matchMode)
    }

    private fun member(id: String) = SongMemberSummary(id = id, nameKo = id)

    private fun song(
        videoId: String = "AbCdEf123_-",
        youtubeUrl: String = "https://www.youtube.com/watch?v=AbCdEf123_-",
        duration: String? = null,
        durationSeconds: Int? = null,
        isInstrumental: Boolean = false,
        classificationStatus: String? = null,
        members: List<SongMemberSummary> = emptyList(),
    ) = SongCatalogItem(
        id = "song-1",
        youtubeVideoId = videoId,
        title = "Song",
        type = SongType.COVER,
        duration = duration,
        durationSeconds = durationSeconds,
        isInstrumental = isInstrumental,
        classificationStatus = classificationStatus,
        members = members,
        youtubeUrl = youtubeUrl,
    )
}
