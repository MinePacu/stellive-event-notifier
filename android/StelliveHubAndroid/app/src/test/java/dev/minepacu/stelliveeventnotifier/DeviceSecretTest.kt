package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.device.DeviceIdStore
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesRequestDto
import dev.minepacu.stelliveeventnotifier.feature.home.MockHubRepository
import dev.minepacu.stelliveeventnotifier.feature.home.ServerHubRepository
import kotlinx.coroutines.test.runTest
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceSecretTest {
    private val secret = "s".repeat(43)
    private val registerOk = """{"deviceId":"device-new","registered":true,"serverTime":"t","deviceSecret":"$secret"}"""
    private val registerOkNoSecret = """{"deviceId":"device-new","registered":true,"serverTime":"t"}"""
    private val authFailed = 401 to """{"error":"device_auth_failed"}"""
    private val bootstrapOk = """{"config":{"unofficialProject":true,"catalogVersion":"x","officialYoutubeLiveExcluded":true,"hubCalendarEnabled":true}}"""

    private class RecordedRequest(val method: String, val path: String, val secretHeader: String?, val body: String)

    /** Replays [responses] in order (last one repeats) through the real Retrofit/OkHttp stack, no network. */
    private class FakeServer(vararg responses: Pair<Int, String>) {
        private val queue = responses.toMutableList()
        val requests = mutableListOf<RecordedRequest>()

        val interceptor = Interceptor { chain ->
            val request = chain.request()
            requests += RecordedRequest(
                method = request.method,
                path = request.url.encodedPath,
                secretHeader = request.header("X-Device-Secret"),
                body = request.body?.let { Buffer().also { b -> it.writeTo(b) }.readUtf8() }.orEmpty(),
            )
            val (code, body) = if (queue.size > 1) queue.removeAt(0) else queue.first()
            respond(request, code, body)
        }

        private fun respond(request: Request, code: Int, body: String) = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(code)
            .message("fake")
            .body(body.toResponseBody("application/json".toMediaType()))
            .build()
    }

    private fun client(server: FakeServer, store: DeviceIdStore) = HubApiClient.create(
        baseUrl = "https://hub.test/",
        okHttpClient = OkHttpClient.Builder().addInterceptor(server.interceptor).build(),
        deviceSecret = store::getDeviceSecret,
    )

    private fun repository(server: FakeServer, store: DeviceIdStore, onFlush: () -> Unit = {}) = ServerHubRepository(
        remoteDataSource = ServerHubRepository.HubApiRemoteDataSource(client(server, store)),
        deviceIdStore = store,
        fallback = MockHubRepository(),
        flushPendingPushToken = { onFlush() },
    )

    private fun newStore() = DeviceIdStore(DeviceIdStore.InMemoryStorage())

    @Test
    fun storeKeepsSecretNextToDeviceIdAndDropsItOnIdChangeOrClear() {
        val store = newStore()
        store.saveDeviceId("device-1")
        store.saveDeviceSecret("secret-1")
        store.saveDeviceId("device-1")
        assertEquals("secret-1", store.getDeviceSecret())

        store.saveDeviceId("device-2")
        assertNull(store.getDeviceSecret())

        store.saveDeviceSecret("secret-2")
        store.clearCredentials()
        assertNull(store.getDeviceId())
        assertNull(store.getDeviceSecret())
    }

    @Test
    fun registerSendsSecretSupportedAndSavesReturnedSecret() = runTest {
        val server = FakeServer(200 to bootstrapOk, 200 to registerOk)
        val store = newStore()

        repository(server, store).bootstrap()

        val register = server.requests.single { it.path == "/v1/devices/register" }
        assertTrue(register.body, register.body.contains("\"deviceSecretSupported\":true"))
        assertEquals("device-new", store.getDeviceId())
        assertEquals(secret, store.getDeviceSecret())
    }

    @Test
    fun oldServerWithoutSecretKeepsWorkingWithoutHeader() = runTest {
        val server = FakeServer(200 to bootstrapOk, 200 to registerOkNoSecret)
        val store = newStore()

        repository(server, store).bootstrap()

        assertEquals("device-new", store.getDeviceId())
        assertNull(store.getDeviceSecret())
        client(server, store).preferences("device-new")
        assertTrue(server.requests.all { it.secretHeader == null })
    }

    @Test
    fun reRegisteringExistingDeviceKeepsStoredSecret() = runTest {
        val server = FakeServer(200 to bootstrapOk, 200 to registerOkNoSecret)
        val store = newStore().apply { saveDeviceId("device-new"); saveDeviceSecret(secret) }

        repository(server, store).bootstrap()

        assertEquals(secret, store.getDeviceSecret())
        assertEquals(secret, server.requests.single { it.path == "/v1/devices/register" }.secretHeader)
    }

    @Test
    fun headerIsSentOnExactlyTheFiveDeviceEndpoints() = runTest {
        val server = FakeServer(200 to "{}")
        val store = newStore().apply { saveDeviceId("d"); saveDeviceSecret(secret) }
        val api = client(server, store)

        api.bootstrap(deviceId = "d")
        api.registerDevice(RegisterDeviceRequestDto(deviceId = "d"))
        api.updateDeviceToken(UpdateDeviceTokenRequestDto(deviceId = "d", token = "t"))
        api.preferences("d")
        api.updatePreferences(UpdatePreferencesRequestDto(deviceId = "d", preferences = emptyList(), expectedRevision = 1, clientUpdatedAt = "t"))
        api.hubEvents()
        api.hubEvent("e")
        api.announcements()
        api.announcement("a")
        api.hubEventsCalendar(from = "2026-01-01", to = "2026-01-31", timezone = "Asia/Seoul")
        api.songs()
        api.songFacets()
        api.music()
        api.musicDetail("m")
        api.memberMusic("member")

        val withHeader = server.requests.filter { it.secretHeader != null }.map { "${it.method} ${it.path}" }
        assertEquals(
            listOf(
                "GET /v1/bootstrap",
                "POST /v1/devices/register",
                "PUT /v1/devices/token",
                "GET /v1/preferences",
                "PUT /v1/preferences",
            ),
            withHeader,
        )
        assertTrue(server.requests.filter { it.secretHeader != null }.all { it.secretHeader == secret })
        assertEquals(15, server.requests.size)
    }

    @Test
    fun noHeaderWhenNoSecretStored() = runTest {
        val server = FakeServer(200 to "{}")
        val api = client(server, newStore())

        api.bootstrap(deviceId = null)
        api.preferences("d")

        assertTrue(server.requests.all { it.secretHeader == null })
    }

    @Test
    fun unauthorizedWithDeviceAuthFailedBodyMapsToDedicatedCode() = runTest {
        val api = client(FakeServer(authFailed), newStore())

        val result = api.preferences("d")

        assertEquals("device_auth_failed", (result as HubNetworkResult.Failure).code)
    }

    @Test
    fun otherUnauthorizedBodiesStayNetworkError() = runTest {
        val api = client(FakeServer(401 to """{"error":"nope"}"""), newStore())

        assertEquals("network_error", (api.preferences("d") as HubNetworkResult.Failure).code)
    }

    @Test
    fun registerAuthFailureClearsCredentialsAndRegistersAgainWithoutDeviceId() = runTest {
        val server = FakeServer(200 to bootstrapOk, authFailed, 200 to registerOk)
        val store = newStore().apply { saveDeviceId("old-device"); saveDeviceSecret("stale") }
        var flushes = 0

        repository(server, store) { flushes += 1 }.bootstrap()

        val registers = server.requests.filter { it.path == "/v1/devices/register" }
        assertEquals(2, registers.size)
        assertTrue(registers[0].body.contains("old-device"))
        assertEquals("stale", registers[0].secretHeader)
        assertTrue(registers[1].body, !registers[1].body.contains("deviceId"))
        assertNull(registers[1].secretHeader)
        assertEquals("device-new", store.getDeviceId())
        assertEquals(secret, store.getDeviceSecret())
        assertEquals(1, flushes)
    }

    @Test
    fun registerGivesUpAfterOneRetry() = runTest {
        val server = FakeServer(200 to bootstrapOk, authFailed)
        val store = newStore().apply { saveDeviceId("old-device"); saveDeviceSecret("stale") }

        repository(server, store).bootstrap()

        assertEquals(2, server.requests.count { it.path == "/v1/devices/register" })
        assertNull(store.getDeviceId())
        assertNull(store.getDeviceSecret())
    }

    @Test
    fun bootstrapAuthFailureHealsThroughRegistrationAndRetriesOnce() = runTest {
        val server = FakeServer(authFailed, 200 to registerOk, 200 to bootstrapOk)
        val store = newStore().apply { saveDeviceId("old-device"); saveDeviceSecret("stale") }
        var flushes = 0

        repository(server, store) { flushes += 1 }.bootstrap()

        assertEquals(
            listOf("/v1/bootstrap", "/v1/devices/register", "/v1/bootstrap"),
            server.requests.map { it.path },
        )
        assertEquals(secret, server.requests[2].secretHeader)
        assertEquals("device-new", store.getDeviceId())
        assertEquals(1, flushes)
    }
}
