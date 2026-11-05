package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventGoodsGalleryPreferenceStore
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventGoodsGalleryPreferenceStoreTest {
    private class Backing(var value: Boolean? = null) {
        fun store() = HubEventGoodsGalleryPreferenceStore(readStoredValue = { value }, writeStoredValue = { value = it })
    }

    @Test
    fun defaultsToCollapsedWhenNothingIsStored() {
        assertFalse(Backing().store().readExpandedByDefault())
    }

    @Test
    fun persistsTheChosenValueAcrossStoreInstances() {
        val backing = Backing()
        backing.store().writeExpandedByDefault(true)

        assertTrue(backing.value == true)
        assertTrue(backing.store().readExpandedByDefault())

        backing.store().writeExpandedByDefault(false)
        assertFalse(backing.store().readExpandedByDefault())
    }
}
