package dev.minepacu.stelliveeventnotifier

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsItem
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventGoodsChecklistStore
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class HubEventGoodsChecklistStoreTest {
    private lateinit var file: File
    private lateinit var scope: CoroutineScope
    private lateinit var store: HubEventGoodsChecklistStore

    private fun item(id: String, limit: Int? = null, bonus: Boolean = false) =
        HubEventGoodsItem(id = id, name = "굿즈 $id", purchaseLimit = limit, isBonus = bonus)

    private fun open() {
        scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        store = HubEventGoodsChecklistStore(PreferenceDataStoreFactory.create(scope = scope, produceFile = { file }))
    }

    @Before
    fun setUp() {
        file = File.createTempFile("goods-checklist", ".preferences_pb").also { it.delete() }
        open()
    }

    @After
    fun tearDown() {
        scope.cancel()
        file.delete()
    }

    @Test
    fun toggleChecksWithQuantityOneAndUnchecks() = runTest {
        val a = item("a")

        store.toggle("e1", a)
        assertEquals(mapOf("a" to 1), store.quantities("e1").first())

        store.toggle("e1", a)
        assertEquals(emptyMap<String, Int>(), store.quantities("e1").first())
    }

    @Test
    fun bonusItemsCannotBeChecked() = runTest {
        val bonus = item("bonus", bonus = true)

        store.toggle("e1", bonus)
        store.setQuantity("e1", bonus, 2)

        assertEquals(emptyMap<String, Int>(), store.quantities("e1").first())
    }

    @Test
    fun quantityIsClampedToPurchaseLimitAndDefaultMax() = runTest {
        val limited = item("limited", limit = 3)
        val unlimited = item("unlimited")

        store.setQuantity("e1", limited, 10)
        store.setQuantity("e1", unlimited, 500)
        assertEquals(mapOf("limited" to 3, "unlimited" to 99), store.quantities("e1").first())

        store.setQuantity("e1", limited, 0)
        assertEquals(1, store.quantities("e1").first().getValue("limited"))
    }

    @Test
    fun entriesAreKeyedPerEventAndClearOnlyAffectsThatEvent() = runTest {
        val a = item("a")
        store.toggle("e1", a)
        store.toggle("e2", a)
        store.setQuantity("e1", item("b"), 4)

        assertEquals(mapOf("a" to 1, "b" to 4), store.quantities("e1").first())
        assertEquals(mapOf("a" to 1), store.quantities("e2").first())

        store.clear("e1")

        assertEquals(emptyMap<String, Int>(), store.quantities("e1").first())
        assertEquals(mapOf("a" to 1), store.quantities("e2").first())
    }

    @Test
    fun pruneRemovesItemsMissingFromLatestListAndKeepsOtherEvents() = runTest {
        store.setQuantity("e1", item("keep"), 2)
        store.setQuantity("e1", item("gone"), 1)
        store.setQuantity("e2", item("gone"), 1)

        store.prune("e1", listOf(item("keep"), item("new")))

        assertEquals(mapOf("keep" to 2), store.quantities("e1").first())
        assertEquals(mapOf("gone" to 1), store.quantities("e2").first())
    }

    @Test
    fun pruneWithEmptyListClearsTheWholeEvent() = runTest {
        store.setQuantity("e1", item("a"), 2)
        store.setQuantity("e1", item("b"), 1)
        store.setQuantity("e2", item("a"), 1)

        store.prune("e1", emptyList())

        assertEquals(emptyMap<String, Int>(), store.quantities("e1").first())
        assertEquals(mapOf("a" to 1), store.quantities("e2").first())
    }

    @Test
    fun pruneClampsToNewLimitAndDropsItemsThatBecameBonus() = runTest {
        store.setQuantity("e1", item("a"), 5)
        store.setQuantity("e1", item("b"), 2)

        store.prune("e1", listOf(item("a", limit = 2), item("b", bonus = true)))

        assertEquals(mapOf("a" to 2), store.quantities("e1").first())
    }

    @Test
    fun withoutPruneCallStoredEntriesSurviveStaleOrCachedData() = runTest {
        // Cached/fallback data and network failures never call prune(); the entries must stay untouched.
        store.setQuantity("e1", item("a"), 3)

        assertEquals(mapOf("a" to 3), store.quantities("e1").first())
    }

    @Test
    fun checklistPersistsAcrossStoreReopen() = runTest {
        store.setQuantity("e1", item("a"), 3)
        store.toggle("e2", item("b"))

        scope.coroutineContext[Job]!!.cancelAndJoin()
        open()

        assertEquals(
            mapOf("e1" to mapOf("a" to 3), "e2" to mapOf("b" to 1)),
            store.snapshot.first(),
        )
    }

    @Test
    fun idsContainingTheKeySeparatorAreIgnored() = runTest {
        store.toggle("e1", item("bad\u001Fid"))
        store.toggle("bad\u001Fevent", item("a"))

        assertEquals(emptyMap<String, Map<String, Int>>(), store.snapshot.first())
    }
}
