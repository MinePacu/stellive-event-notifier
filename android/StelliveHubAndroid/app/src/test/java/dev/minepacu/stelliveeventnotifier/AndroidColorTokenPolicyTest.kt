package dev.minepacu.stelliveeventnotifier

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidColorTokenPolicyTest {
    @Test
    fun lightThemeSeparatesBackgroundFromCards() {
        val colors = colorsFrom("src/main/res/values/colors.xml")

        assertEquals("#F5F7F8", colors["hub_background"])
        assertEquals("#FFFFFF", colors["hub_card"])
        assertEquals("#D9E2E4", colors["hub_line"])
        assertTrue(colors.containsKey("hub_card_surface"))
        assertNotEquals(colors["hub_background"], colors["hub_card_surface"])
    }

    @Test
    fun darkThemeSeparatesBackgroundFromCards() {
        val colors = colorsFrom("src/main/res/values-night/colors.xml")

        assertEquals("#000000", colors["hub_background"])
        assertEquals("#181818", colors["hub_card"])
        assertEquals("#2A2A2A", colors["hub_line"])
        assertEquals("#D1000000", colors["hub_top_bar_glass"])
        assertEquals("#F2000000", colors["hub_top_bar_glass_scrolled"])
        assertTrue(colors.containsKey("hub_card_surface"))
        assertNotEquals(colors["hub_background"], colors["hub_card_surface"])
    }

    private fun colorsFrom(path: String): Map<String, String> {
        val document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File(path))
        val nodes = document.getElementsByTagName("color")
        return (0 until nodes.length).associate { index ->
            val node = nodes.item(index)
            val name = node.attributes.getNamedItem("name").nodeValue
            name to node.textContent.trim().uppercase()
        }
    }
}
