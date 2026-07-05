package dev.minepacu.stelliveeventnotifier

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Test

class BottomNavigationIconPolicyTest {
    @Test
    fun bottomNavigationUsesDistinctAppOwnedIcons() {
        val menuFile = File("src/main/res/menu/bottom_navigation.xml")
        val document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(menuFile)
        val items = document.getElementsByTagName("item")

        val iconsById = (0 until items.length).associate { index ->
            val item = items.item(index)
            val id = item.attributes.getNamedItem("android:id").nodeValue
            val icon = item.attributes.getNamedItem("android:icon").nodeValue
            id to icon
        }

        assertEquals("@drawable/ic_tab_home", iconsById["@+id/tab_home"])
        assertEquals("@drawable/ic_tab_live", iconsById["@+id/tab_live"])
        assertEquals("@drawable/ic_tab_songs", iconsById["@+id/tab_songs"])
        assertEquals("@drawable/ic_tab_goods_events", iconsById["@+id/tab_goods_events"])
        assertEquals(4, iconsById.values.toSet().size)
    }
}
