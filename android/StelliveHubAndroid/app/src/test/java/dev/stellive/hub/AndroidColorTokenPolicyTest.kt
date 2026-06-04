package dev.stellive.hub

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidColorTokenPolicyTest {
    @Test
    fun lightThemeSeparatesBackgroundFromCards() {
        val colors = colorsFrom("src/main/res/values/colors.xml")

        assertEquals("#F5F7F8", colors["hub_background"])
        assertEquals("#FFFFFF", colors["hub_card"])
        assertEquals("#D9E2E4", colors["hub_line"])
    }

    @Test
    fun darkThemeSeparatesBackgroundFromCards() {
        val colors = colorsFrom("src/main/res/values-night/colors.xml")

        assertEquals("#0E1416", colors["hub_background"])
        assertEquals("#151D20", colors["hub_card"])
        assertEquals("#2A363A", colors["hub_line"])
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
