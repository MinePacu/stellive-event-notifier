package dev.minepacu.stelliveeventnotifier.ui.navigation

import android.animation.ValueAnimator
import android.view.View
import android.view.animation.DecelerateInterpolator
import androidx.core.view.doOnPreDraw

class ScreenTransitionController(
    private val screenBody: View,
    private val dp: (Int) -> Float,
    private val onIdle: () -> Unit = {},
) {
    private data class Request(
        val key: String,
        val motion: ScreenNavigationMotion,
        val isRtl: Boolean,
        val targetProvider: () -> View?,
        val commit: () -> Unit,
    )

    private val pendingRequests = LatestNavigationRequestQueue<Request>()
    private var activeKey: String? = null
    private var activeView: View? = null

    val isTransitionRunning: Boolean
        get() = activeKey != null

    fun transition(
        key: String,
        motion: ScreenNavigationMotion,
        isRtl: Boolean,
        targetProvider: () -> View? = { screenBody },
        commit: () -> Unit,
    ): Boolean {
        val request = Request(key, motion, isRtl, targetProvider, commit)
        if (isTransitionRunning) {
            return pendingRequests.offer(activeKey, key, request)
        }
        start(request)
        return true
    }

    fun runWhenIdle(key: String, action: () -> Unit): Boolean = transition(
        key = key,
        motion = ScreenNavigationMotion.NONE,
        isRtl = false,
        targetProvider = { null },
        commit = action,
    )

    fun cancelAndClear() {
        pendingRequests.clear()
        activeView?.animate()?.cancel()
        activeView?.normalize()
        screenBody.normalize()
        activeView = null
        activeKey = null
    }

    private fun start(request: Request) {
        activeKey = request.key
        val outgoing = request.targetProvider() ?: screenBody
        activeView = outgoing
        outgoing.normalize()

        if (request.motion == ScreenNavigationMotion.NONE || !ValueAnimator.areAnimatorsEnabled() || !outgoing.isLaidOut) {
            request.commit()
            (request.targetProvider() ?: screenBody).normalize()
            finishRequest()
            return
        }

        val direction = ScreenTransitionPolicy.horizontalDirection(request.motion, request.isRtl)
        val distances = distancesFor(request.motion)
        val durations = durationsFor(request.motion)
        outgoing.animate()
            .alpha(0f)
            .translationX(-direction * dp(distances.first))
            .setDuration(durations.first)
            .setInterpolator(DecelerateInterpolator())
            .withEndAction {
                outgoing.normalize()
                request.commit()
                val incoming = request.targetProvider() ?: screenBody
                activeView = incoming
                incoming.animate().cancel()
                incoming.alpha = 0f
                incoming.translationX = direction * dp(distances.second)
                incoming.translationY = 0f
                incoming.doOnPreDraw {
                    incoming.postOnAnimation {
                        incoming.animate()
                            .alpha(1f)
                            .translationX(0f)
                            .translationY(0f)
                            .setDuration(durations.second)
                            .setInterpolator(DecelerateInterpolator())
                            .withEndAction {
                                incoming.normalize()
                                finishRequest()
                            }
                            .start()
                    }
                }
            }
            .start()
    }

    private fun finishRequest() {
        activeView?.normalize()
        activeView = null
        activeKey = null
        val next = pendingRequests.take()
        if (next != null) {
            start(next)
        } else {
            onIdle()
        }
    }

    private fun distancesFor(motion: ScreenNavigationMotion): Pair<Int, Int> = when (motion) {
        ScreenNavigationMotion.ROOT_FORWARD,
        ScreenNavigationMotion.ROOT_BACKWARD -> 12 to 20
        ScreenNavigationMotion.PUSH,
        ScreenNavigationMotion.POP -> 26 to 26
        ScreenNavigationMotion.CROSS_FADE,
        ScreenNavigationMotion.NONE -> 0 to 0
    }

    private fun durationsFor(motion: ScreenNavigationMotion): Pair<Long, Long> = when (motion) {
        ScreenNavigationMotion.CROSS_FADE -> 70L to 100L
        ScreenNavigationMotion.NONE -> 0L to 0L
        else -> 90L to 170L
    }

    private fun View.normalize() {
        alpha = 1f
        translationX = 0f
        translationY = 0f
    }
}
