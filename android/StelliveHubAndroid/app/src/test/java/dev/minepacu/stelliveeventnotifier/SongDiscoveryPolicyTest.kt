package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongType
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDiscoveryPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDiscoveryStateV1
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class SongDiscoveryPolicyTest {
    private val baseline = Instant.parse("2026-07-01T00:00:00Z")

    @Test fun catalogAddedAtTakesPriorityOverOldPublishedAt() {
        val song = song("new", published = "2020-01-01T00:00:00Z", added = "2026-07-02T00:00:00Z")
        assertTrue(SongDiscoveryPolicy.isNew(song, SongDiscoveryStateV1(true, baseline)))
    }

    @Test fun epochMissingIdentityAndAcknowledgedSongsAreNotNew() {
        val state = SongDiscoveryStateV1(true, baseline, setOf("youtube:known"))
        assertFalse(SongDiscoveryPolicy.isNew(song("known", published = "2026-07-02T00:00:00Z"), state))
        assertFalse(SongDiscoveryPolicy.isNew(SongCatalogItem(" ", " ", "bad", SongType.COVER), state))
        assertFalse(SongDiscoveryPolicy.isNew(SongCatalogItem("epoch", "epoch", "old", SongType.COVER), state))
    }

    private fun song(id: String, published: String, added: String? = null) = SongCatalogItem(
        id = id, youtubeVideoId = id, title = id, type = SongType.COVER,
        publishedAt = Instant.parse(published), catalogAddedAt = added?.let(Instant::parse),
    )
}
