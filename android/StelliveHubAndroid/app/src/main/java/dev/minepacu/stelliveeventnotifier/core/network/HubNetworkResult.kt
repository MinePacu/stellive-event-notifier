package dev.minepacu.stelliveeventnotifier.core.network

sealed interface HubNetworkResult<out T> {
    data class Success<T>(val value: T) : HubNetworkResult<T>
    data class Failure(
        val code: String? = null,
        val throwableType: String? = null,
    ) : HubNetworkResult<Nothing>
}
