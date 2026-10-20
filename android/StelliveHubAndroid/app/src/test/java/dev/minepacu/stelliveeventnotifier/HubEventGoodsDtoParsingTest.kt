package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.HubEventDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class HubEventGoodsDtoParsingTest {
    private val adapter = HubApiClient.moshi().adapter(HubEventDto::class.java)

    private fun parse(extra: String): HubEventDto =
        checkNotNull(adapter.fromJson("""{"id":"e1","title":"행사"$extra}"""))

    @Test
    fun missingGoodsFieldsParseAsEmpty() {
        val dto = parse("")

        assertEquals(emptyList<Any>(), dto.goodsItems)
        assertNull(dto.goodsCount)
    }

    @Test
    fun goodsCountOnlyListPayloadParses() {
        val dto = parse(""","goodsCount":32""")

        assertEquals(32, dto.goodsCount)
        assertEquals(emptyList<Any>(), dto.goodsItems)
    }

    @Test
    fun goodsItemsParseOptionalFieldsAndIgnoreUnknownKeys() {
        val dto = parse(
            ""","goodsItems":[
              {"id":"g1","name":"아크릴","memberIds":["m1","m2"],"priceKrw":12000,"salesChannel":"onsite",
               "purchaseLimit":2,"limitNote":"1인 2개","isBonus":false,"sortOrder":3,"futureField":{"x":1},
               "image":{"policyState":"none"}},
              {"id":"g2","name":"특전","salesChannel":"someday","isBonus":true}
            ]""",
        )

        val first = dto.goodsItems[0]
        assertEquals("g1", first.id)
        assertEquals(listOf("m1", "m2"), first.memberIds)
        assertEquals(12000, first.priceKrw)
        assertEquals("onsite", first.salesChannel)
        assertEquals(2, first.purchaseLimit)
        assertEquals(3, first.sortOrder)
        assertNotNull(first.image)
        val second = dto.goodsItems[1]
        assertEquals("someday", second.salesChannel)
        assertEquals(true, second.isBonus)
        assertNull(second.priceKrw)
        assertEquals(emptyList<String>(), second.memberIds)
    }
}
