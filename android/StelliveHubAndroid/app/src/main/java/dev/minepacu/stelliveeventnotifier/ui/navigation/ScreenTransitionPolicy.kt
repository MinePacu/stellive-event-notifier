package dev.minepacu.stelliveeventnotifier.ui.navigation

import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen

enum class ScreenNavigationMotion {
    ROOT_FORWARD,
    ROOT_BACKWARD,
    PUSH,
    POP,
    CROSS_FADE,
    NONE,
}

enum class ScreenTransitionReason {
    ROOT_SELECTION,
    PUSH,
    POP,
    INITIAL_RENDER,
    DATA_REFRESH,
    WINDOW_CHANGE,
    TWO_PANE_SELECTION,
}

object ScreenTransitionPolicy {
    private val rootOrder = listOf(
        HubScreen.HOME,
        HubScreen.LIVE,
        HubScreen.SONGS,
        HubScreen.GOODS_EVENTS,
    )

    fun motion(
        from: HubScreen?,
        to: HubScreen,
        reason: ScreenTransitionReason,
    ): ScreenNavigationMotion {
        if (reason == ScreenTransitionReason.INITIAL_RENDER ||
            reason == ScreenTransitionReason.DATA_REFRESH ||
            reason == ScreenTransitionReason.WINDOW_CHANGE
        ) {
            return ScreenNavigationMotion.NONE
        }
        if (reason == ScreenTransitionReason.TWO_PANE_SELECTION) {
            return ScreenNavigationMotion.CROSS_FADE
        }
        if (from == null || from == to) return ScreenNavigationMotion.NONE

        return when (reason) {
            ScreenTransitionReason.ROOT_SELECTION -> rootMotion(from, to)
            ScreenTransitionReason.PUSH -> ScreenNavigationMotion.PUSH
            ScreenTransitionReason.POP -> ScreenNavigationMotion.POP
            ScreenTransitionReason.INITIAL_RENDER,
            ScreenTransitionReason.DATA_REFRESH,
            ScreenTransitionReason.WINDOW_CHANGE,
            ScreenTransitionReason.TWO_PANE_SELECTION -> ScreenNavigationMotion.NONE
        }
    }

    fun horizontalDirection(motion: ScreenNavigationMotion, isRtl: Boolean): Int {
        val ltrDirection = when (motion) {
            ScreenNavigationMotion.ROOT_FORWARD,
            ScreenNavigationMotion.PUSH -> 1
            ScreenNavigationMotion.ROOT_BACKWARD,
            ScreenNavigationMotion.POP -> -1
            ScreenNavigationMotion.CROSS_FADE,
            ScreenNavigationMotion.NONE -> 0
        }
        return if (isRtl) -ltrDirection else ltrDirection
    }

    private fun rootMotion(from: HubScreen, to: HubScreen): ScreenNavigationMotion {
        val fromIndex = rootOrder.indexOf(from)
        val toIndex = rootOrder.indexOf(to)
        if (fromIndex < 0 || toIndex < 0 || fromIndex == toIndex) return ScreenNavigationMotion.NONE
        return if (toIndex > fromIndex) {
            ScreenNavigationMotion.ROOT_FORWARD
        } else {
            ScreenNavigationMotion.ROOT_BACKWARD
        }
    }
}

internal class LatestNavigationRequestQueue<T> {
    private var pendingKey: String? = null
    private var pendingRequest: T? = null

    fun offer(activeKey: String?, key: String, request: T): Boolean {
        if (key == activeKey || key == pendingKey) return false
        pendingKey = key
        pendingRequest = request
        return true
    }

    fun take(): T? {
        val request = pendingRequest
        pendingKey = null
        pendingRequest = null
        return request
    }

    fun clear() {
        pendingKey = null
        pendingRequest = null
    }
}
