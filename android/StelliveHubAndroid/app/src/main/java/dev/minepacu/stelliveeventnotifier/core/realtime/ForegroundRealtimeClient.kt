package dev.minepacu.stelliveeventnotifier.core.realtime

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener

class ForegroundRealtimeClient(
    private val okHttpClient: OkHttpClient = OkHttpClient()
) {
    private val events = MutableSharedFlow<String>(extraBufferCapacity = 16)
    private var socket: WebSocket? = null

    fun observeEvents(): Flow<String> = events.asSharedFlow()

    fun connect(url: String) {
        val request = Request.Builder().url(url).build()
        socket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                events.tryEmit(text)
            }
        })
    }

    fun disconnect() {
        socket?.close(1000, "foreground ended")
        socket = null
    }
}

