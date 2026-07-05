package dev.minepacu.stelliveeventnotifier

import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isRegularFile
import kotlin.io.path.readText

class ChzzkBackendBoundaryTest {
    @Test
    fun androidAppDoesNotContainChzzkSecretsOrDirectHosts() {
        val projectRoot = findProjectRoot()
        val sourceRoot = projectRoot.resolve("app/src/main")
        val forbidden = listOf(
            "CHZZK_CLIENT_ID",
            "CHZZK_CLIENT_SECRET",
            "CHZZK_ACCESS_TOKEN",
            "CHZZK_REFRESH_TOKEN",
            "api.chzzk",
            "chzzk.naver",
            "NID_AUT",
            "NID_SES",
        )

        val violations = Files.walk(sourceRoot).use { paths ->
            paths
                .filter { it.isRegularFile() }
                .filter { path -> path.toString().endsWith(".kt") || path.toString().endsWith(".xml") }
                .flatMap { path ->
                    val text = path.readText()
                    forbidden
                        .filter { token -> text.contains(token) }
                        .map { token -> "${sourceRoot.relativize(path)} contains $token" }
                        .stream()
                }
                .toList()
        }

        assertTrue("Android app must use backend-mediated CHZZK access only: $violations", violations.isEmpty())
    }

    private fun findProjectRoot(): Path {
        var current = Path.of("").toAbsolutePath()
        while (current.fileName?.toString() != "StelliveHubAndroid") {
            current = current.parent ?: error("Could not find Android project root")
        }
        return current
    }
}
