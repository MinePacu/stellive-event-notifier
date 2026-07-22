package dev.minepacu.stelliveeventnotifier.feature.reservations.system

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy

class ReservationShareActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val shared = intent.getStringExtra(Intent.EXTRA_TEXT)
        val url = ReservationURLPolicy.firstHttpsUrl(shared)
        if (url == null) {
            Toast.makeText(this, "공유 내용에서 HTTPS 링크를 찾지 못했습니다.", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        startActivity(Intent(this, ReservationQuickAddActivity::class.java).apply {
            action = Intent.ACTION_SEND
            putExtra(ReservationQuickAddActivity.EXTRA_DETAIL_URL, url)
        })
        finish()
    }
}
