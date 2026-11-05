package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.goodsChecklistDataStore: DataStore<Preferences> by preferencesDataStore(
    name = HubEventGoodsChecklistStore.FILE_NAME,
)

/**
 * Device-local purchase checklist: (eventId, goodsItemId) -> quantity (>= 1). Never sent to the server.
 * Each entry is its own Int preference so edits are atomic and unrelated events are untouched.
 */
class HubEventGoodsChecklistStore(
    private val dataStore: DataStore<Preferences>,
) {
    constructor(context: Context) : this(context.applicationContext.goodsChecklistDataStore)

    /** eventId -> (goodsItemId -> quantity). Malformed entries are ignored. */
    val snapshot: Flow<Map<String, Map<String, Int>>> = dataStore.data.map { preferences ->
        val result = LinkedHashMap<String, MutableMap<String, Int>>()
        preferences.asMap().forEach { (key, value) ->
            val (eventId, itemId) = parseKey(key.name) ?: return@forEach
            val quantity = (value as? Int)?.takeIf { it >= 1 } ?: return@forEach
            result.getOrPut(eventId) { linkedMapOf() }[itemId] = quantity
        }
        result
    }

    fun quantities(eventId: String): Flow<Map<String, Int>> =
        snapshot.map { it[eventId].orEmpty() }

    /** Checks an unchecked purchasable item with quantity 1, or unchecks a checked one. No-op for bonus items. */
    suspend fun toggle(eventId: String, item: HubEventGoodsItem) {
        if (!isValidId(eventId) || !isValidId(item.id)) return
        val key = intPreferencesKey(keyName(eventId, item.id))
        dataStore.edit { preferences ->
            when {
                preferences[key] != null -> preferences.remove(key)
                HubEventGoodsPolicy.isCheckable(item) -> preferences[key] = 1
            }
        }
    }

    /** Sets the quantity of a purchasable item, clamped to [1, purchaseLimit ?: 99]. No-op for bonus items. */
    suspend fun setQuantity(eventId: String, item: HubEventGoodsItem, quantity: Int) {
        if (!isValidId(eventId) || !isValidId(item.id) || !HubEventGoodsPolicy.isCheckable(item)) return
        dataStore.edit { preferences ->
            preferences[intPreferencesKey(keyName(eventId, item.id))] = HubEventGoodsPolicy.clampQuantity(item, quantity)
        }
    }

    /** Removes every entry for [eventId]. */
    suspend fun clear(eventId: String) {
        if (!isValidId(eventId)) return
        dataStore.edit { preferences ->
            preferences.asMap().keys
                .filter { parseKey(it.name)?.first == eventId }
                .forEach { preferences.remove(intPreferencesKey(it.name)) }
        }
    }

    /**
     * Reconciles [eventId] with the latest server list: drops entries whose goods item is gone (all of them
     * when [latestItems] is empty), drops items that became bonus, and clamps quantities to the current limit.
     * Call this only for a successful detail response, never for cached or fallback data.
     */
    suspend fun prune(eventId: String, latestItems: List<HubEventGoodsItem>) {
        if (!isValidId(eventId)) return
        val byId = latestItems.associateBy { it.id }
        dataStore.edit { preferences ->
            preferences.asMap().forEach { (key, value) ->
                val (entryEventId, itemId) = parseKey(key.name) ?: return@forEach
                if (entryEventId != eventId) return@forEach
                val intKey = intPreferencesKey(key.name)
                val item = byId[itemId]
                val quantity = value as? Int
                when {
                    item == null || !HubEventGoodsPolicy.isCheckable(item) || quantity == null || quantity < 1 ->
                        preferences.remove(intKey)
                    else -> {
                        val clamped = HubEventGoodsPolicy.clampQuantity(item, quantity)
                        if (clamped != quantity) preferences[intKey] = clamped
                    }
                }
            }
        }
    }

    companion object {
        internal const val FILE_NAME = "hub_event_goods_checklist.preferences_pb"
        private const val KEY_PREFIX = "goods_checklist_v1"
        private const val SEPARATOR = '\u001F'

        private fun isValidId(value: String): Boolean = value.isNotEmpty() && SEPARATOR !in value

        internal fun keyName(eventId: String, itemId: String): String =
            "$KEY_PREFIX$SEPARATOR$eventId$SEPARATOR$itemId"

        internal fun parseKey(name: String): Pair<String, String>? {
            val parts = name.split(SEPARATOR)
            if (parts.size != 3 || parts[0] != KEY_PREFIX || parts[1].isEmpty() || parts[2].isEmpty()) return null
            return parts[1] to parts[2]
        }
    }
}
