package dev.minepacu.stelliveeventnotifier.feature.reservations.system

import android.app.Activity
import android.app.AlertDialog
import android.app.StatusBarManager
import android.content.ComponentName
import android.graphics.drawable.Icon
import android.os.Build
import android.widget.Toast
import dev.minepacu.stelliveeventnotifier.R

object ReservationSystemShortcutCoordinator {
    private const val PREFERENCES = "reservation_shortcuts"
    private const val TILE_PROMPTED = "tile_prompted"

    fun promptOnce(activity: Activity, afterPrompt: () -> Unit) {
        val preferences = activity.getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE)
        if (preferences.getBoolean(TILE_PROMPTED, false)) {
            afterPrompt()
            return
        }
        preferences.edit().putBoolean(TILE_PROMPTED, true).apply()
        AlertDialog.Builder(activity)
            .setTitle("내역 추가 버튼")
            .setMessage("예매·구매·예약 후 빠르게 기록할 수 있도록 빠른 설정에 ‘내역에 추가’ 버튼을 추가할까요?")
            .setNegativeButton("나중에") { _, _ -> afterPrompt() }
            .setPositiveButton("추가") { _, _ -> requestTile(activity, afterPrompt) }
            .setOnCancelListener { afterPrompt() }
            .show()
    }

    fun requestTile(activity: Activity, onComplete: () -> Unit = {}) {
        if (Build.VERSION.SDK_INT < 33) {
            Toast.makeText(activity, "빠른 설정 편집에서 ‘내역에 추가’ 타일을 직접 추가해 주세요.", Toast.LENGTH_LONG).show()
            onComplete()
            return
        }
        val statusBarManager = activity.getSystemService(StatusBarManager::class.java)
        statusBarManager.requestAddTileService(
            ComponentName(activity, ReservationTileService::class.java),
            "내역에 추가",
            Icon.createWithResource(activity, R.drawable.ic_reservation_ticket),
            activity.mainExecutor,
        ) { onComplete() }
    }
}
