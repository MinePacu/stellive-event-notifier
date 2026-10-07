package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListImageKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListLayout
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImagePolicyState
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.HubEventDto
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventGoodsGalleryPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HubEventGoodsGalleryDtoParsingTest {
    private val adapter = HubApiClient.moshi().adapter(HubEventDto::class.java)

    private fun parse(extra: String): HubEventDto =
        checkNotNull(adapter.fromJson("""{"id":"e1","title":"행사"$extra}"""))

    private fun images(extra: String) = HubEventGoodsGalleryPolicy.fromDtos(parse(extra).goodsListImages)

    @Test
    fun absentFieldParsesAsNullAndMapsToEmpty() {
        val dto = parse("")

        assertNull(dto.goodsListImages)
        assertEquals(emptyList<Any>(), HubEventGoodsGalleryPolicy.fromDtos(dto.goodsListImages))
    }

    @Test
    fun emptyAndNullFieldMapToEmpty() {
        assertEquals(emptyList<Any>(), images(""","goodsListImages":[]"""))
        assertEquals(emptyList<Any>(), images(""","goodsListImages":null"""))
    }

    @Test
    fun validEntriesKeepNoticeOrderAndFields() {
        val parsed = images(
            ""","goodsListImages":[
              {"policyState":"official_runtime_url","url":"https://stellive.me/a/2.png","sourceLabel":"공식 공지",
               "sourceUrl":"https://stellive.me/notice/1","altText":"MD 리스트 2","futureField":1},
              {"policyState":"third_party_allowed","url":" https://pbs.twimg.com/media/1.png "}
            ]""",
        )

        assertEquals(listOf("https://stellive.me/a/2.png", "https://pbs.twimg.com/media/1.png"), parsed.map { it.image.url })
        assertEquals(HubEventImagePolicyState.OFFICIAL_RUNTIME_URL, parsed[0].image.policyState)
        assertEquals("MD 리스트 2", parsed[0].image.altText)
        assertEquals("공식 공지", parsed[0].image.sourceLabel)
        assertEquals("https://stellive.me/notice/1", parsed[0].image.sourceUrl)
        assertNull(parsed[1].image.altText)
    }

    @Test
    fun invalidEntriesAreDroppedWithoutFailingTheEvent() {
        val parsed = images(
            ""","goodsListImages":[
              null,
              {},
              {"policyState":"official_runtime_url"},
              {"policyState":"official_runtime_url","url":"http://stellive.me/insecure.png"},
              {"policyState":"official_runtime_url","url":"https://"},
              {"policyState":"official_runtime_url","url":"not-a-url"},
              {"policyState":"blocked","url":"https://stellive.me/blocked.png"},
              {"policyState":"verify_required","url":"https://stellive.me/verify.png"},
              {"policyState":"none","url":"https://stellive.me/none.png"},
              {"policyState":"mystery","url":"https://stellive.me/mystery.png"},
              {"policyState":"official_runtime_url","url":"https://stellive.me/ok.png"}
            ]""",
        )

        assertEquals(listOf("https://stellive.me/ok.png"), parsed.map { it.image.url })
    }

    @Test
    fun resultIsCappedAtTwentyImagesInOrder() {
        val entries = (1..25).joinToString(",") {
            """{"policyState":"official_runtime_url","url":"https://stellive.me/$it.png"}"""
        }

        val parsed = images(""","goodsListImages":[$entries]""")

        assertEquals(20, parsed.size)
        assertEquals("https://stellive.me/1.png", parsed.first().image.url)
        assertEquals("https://stellive.me/20.png", parsed.last().image.url)
    }

    @Test
    fun kindParsesAndAbsentOrUnknownFallsBackToMd() {
        val parsed = images(
            ""","goodsListImages":[
              {"policyState":"official_runtime_url","url":"https://stellive.me/1.png","kind":"md"},
              {"policyState":"official_runtime_url","url":"https://stellive.me/2.png","kind":"bonus"},
              {"policyState":"official_runtime_url","url":"https://stellive.me/3.png"},
              {"policyState":"official_runtime_url","url":"https://stellive.me/4.png","kind":"future"},
              {"policyState":"official_runtime_url","url":"https://stellive.me/5.png","kind":null},
              {"policyState":"official_runtime_url","url":"https://stellive.me/6.png","kind":" bonus "}
            ]""",
        )

        assertEquals(
            listOf(
                HubEventGoodsListImageKind.MD,
                HubEventGoodsListImageKind.BONUS,
                HubEventGoodsListImageKind.MD,
                HubEventGoodsListImageKind.MD,
                HubEventGoodsListImageKind.MD,
                HubEventGoodsListImageKind.BONUS,
            ),
            parsed.map { it.kind },
        )
    }

    @Test
    fun layoutParsesAndAbsentOrUnknownFallsBackToSplit() {
        assertNull(parse("").goodsListLayout)
        assertEquals(HubEventGoodsListLayout.SPLIT, HubEventGoodsListLayout.fromApiValue(parse("").goodsListLayout))
        assertEquals(HubEventGoodsListLayout.SPLIT, HubEventGoodsListLayout.fromApiValue(parse(""","goodsListLayout":"split"""").goodsListLayout))
        assertEquals(HubEventGoodsListLayout.SINGLE, HubEventGoodsListLayout.fromApiValue(parse(""","goodsListLayout":"single"""").goodsListLayout))
        assertEquals(HubEventGoodsListLayout.SPLIT, HubEventGoodsListLayout.fromApiValue(parse(""","goodsListLayout":"grid"""").goodsListLayout))
        assertEquals(HubEventGoodsListLayout.SPLIT, HubEventGoodsListLayout.fromApiValue(parse(""","goodsListLayout":null""").goodsListLayout))
    }
}
