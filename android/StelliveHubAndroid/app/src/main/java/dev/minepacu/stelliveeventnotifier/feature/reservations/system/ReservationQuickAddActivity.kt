package dev.minepacu.stelliveeventnotifier.feature.reservations.system

import android.app.AlertDialog
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.RoomReservationRepository
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftSelection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@AndroidEntryPoint
class ReservationQuickAddActivity : AppCompatActivity() {
    @Inject lateinit var repository: RoomReservationRepository
    private var selectedDraft: ReservationDraft? = null
    private lateinit var content: LinearLayout
    private lateinit var detailUrlInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "내역에 추가"
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(24))
        }
        setContentView(ScrollView(this).apply { addView(content) })
        lifecycleScope.launch { loadDrafts() }
    }

    private suspend fun loadDrafts() {
        repository.cleanupExpired()
        val drafts = repository.drafts.first()
        val requested = intent.getStringExtra(EXTRA_SESSION_ID)?.let { raw -> drafts.firstOrNull { it.sessionId.toString() == raw } }
        when (val selection = requested?.let { ReservationDraftSelection.Selected(it) } ?: ReservationDraftPolicy.selection(drafts)) {
            ReservationDraftSelection.None -> showEmpty()
            is ReservationDraftSelection.Selected -> showForm(selection.draft)
            is ReservationDraftSelection.Choose -> showDraftPicker(selection.drafts)
        }
    }

    private fun showEmpty() {
        title = "내역에 추가"
        content.removeAllViews()
        content.addView(titleText("진행 중인 예약·구매 내역이 없습니다."))
        content.addView(bodyText("앱에서 티켓·구매·예약 링크를 먼저 열어 주세요."))
    }

    private fun showDraftPicker(drafts: List<ReservationDraft>) {
        title = "내역에 추가"
        content.removeAllViews()
        content.addView(titleText("추가할 내역을 선택해 주세요"))
        drafts.forEach { draft ->
            content.addView(Button(this).apply {
                text = draft.eventSnapshot.title
                isAllCaps = false
                setOnClickListener { showForm(draft) }
            })
        }
    }

    private fun showForm(draft: ReservationDraft) {
        selectedDraft = draft
        title = ReservationPresentationPolicy.addActionLabel(draft.kind)
        content.removeAllViews()
        content.addView(titleText(ReservationPresentationPolicy.addActionLabel(draft.kind)))
        content.addView(bodyText("${ReservationPresentationPolicy.inProgressLabel(draft.kind)}\n${draft.eventSnapshot.title}"))
        detailUrlInput = EditText(this).apply {
            hint = "${ReservationPresentationPolicy.detailLinkLabel(draft.kind)} (선택)"
            setText(intent.getStringExtra(EXTRA_DETAIL_URL).orEmpty())
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        content.addView(detailUrlInput, matchWidth())
        content.addView(Button(this).apply {
            text = "클립보드에서 HTTPS 링크 붙여넣기"
            isAllCaps = false
            setOnClickListener { pasteFirstHttpsURL() }
        }, matchWidth())
        content.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            addView(Button(context).apply {
                text = "링크 없이 추가"
                isAllCaps = false
                setOnClickListener { confirm(null, allowSensitive = false) }
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(Button(context).apply {
                text = ReservationPresentationPolicy.addActionLabel(draft.kind)
                isAllCaps = false
                setOnClickListener { validateAndConfirm() }
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }, matchWidth())
    }

    private fun validateAndConfirm() {
        val validation = ReservationURLPolicy.validate(detailUrlInput.text?.toString())
        if (!validation.isValid) {
            detailUrlInput.error = validation.error
            return
        }
        val normalizedUrl = validation.normalizedUrl ?: return
        lifecycleScope.launch {
            val existingRecord = repository.findReservationByDetailUrl(normalizedUrl)
            if (existingRecord != null) {
                AlertDialog.Builder(this@ReservationQuickAddActivity)
                    .setTitle(R.string.reservation_error_duplicate_title)
                    .setMessage(R.string.reservation_error_duplicate_message)
                    .setNegativeButton(R.string.dialog_cancel, null)
                    .setNeutralButton(R.string.reservation_help_action_view_existing) { _, _ ->
                        startActivity(Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse("stellivehub://reservations/${existingRecord.id}"),
                            this@ReservationQuickAddActivity,
                            MainActivity::class.java,
                        ))
                        finish()
                    }
                    .setPositiveButton(R.string.reservation_action_save_anyway) { _, _ -> confirmAfterSensitivity(validation) }
                    .show()
            } else {
                confirmAfterSensitivity(validation)
            }
        }
    }

    private fun confirmAfterSensitivity(validation: dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLValidation) {
        if (validation.isSensitive) {
            AlertDialog.Builder(this)
                .setTitle(R.string.reservation_error_sensitive_title)
                .setMessage(R.string.reservation_error_sensitive_message)
                .setNegativeButton(R.string.dialog_cancel, null)
                .setPositiveButton(R.string.reservation_action_save_locally) { _, _ -> confirm(validation.normalizedUrl, allowSensitive = true) }
                .show()
        } else {
            confirm(validation.normalizedUrl, allowSensitive = false)
        }
    }

    private fun pasteFirstHttpsURL() {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = clipboard.primaryClip
        val url = (0 until (clip?.itemCount ?: 0))
            .asSequence()
            .mapNotNull { index -> clip?.getItemAt(index)?.coerceToText(this)?.toString() }
            .mapNotNull(ReservationURLPolicy::firstHttpsUrl)
            .firstOrNull()
        if (url == null) {
            showInvalidClipboardLinkDialog()
            return
        }
        detailUrlInput.setText(url)
        detailUrlInput.setSelection(url.length)
        detailUrlInput.error = null
    }

    private fun showInvalidClipboardLinkDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.reservation_error_invalid_https_title)
            .setMessage(R.string.reservation_error_invalid_https_message)
            .setNegativeButton(R.string.dialog_close, null)
            .setNeutralButton(R.string.reservation_help_action_add_without_link) { _, _ ->
                confirm(null, allowSensitive = false)
            }
            .setPositiveButton(R.string.reservation_action_retry_paste) { _, _ ->
                pasteFirstHttpsURL()
            }
            .show()
    }

    private fun confirm(detailUrl: String?, allowSensitive: Boolean) {
        val draft = selectedDraft ?: return
        lifecycleScope.launch {
            runCatching {
                repository.confirm(
                    sessionId = draft.sessionId,
                    detailUrl = detailUrl,
                    linkSource = if (intent.action == android.content.Intent.ACTION_SEND) ReservationLinkSource.BROWSER_SHARE else ReservationLinkSource.SYSTEM_SHORTCUT,
                    allowSensitiveUrl = allowSensitive,
                )
            }.onSuccess {
                ReservationTileService.requestRefresh(this@ReservationQuickAddActivity)
                Toast.makeText(
                    this@ReservationQuickAddActivity,
                    "${ReservationPresentationPolicy.addActionLabel(draft.kind)}했습니다.",
                    Toast.LENGTH_SHORT,
                ).show()
                finish()
            }.onFailure {
                Toast.makeText(this@ReservationQuickAddActivity, R.string.reservation_error_save_failed, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun titleText(value: String) = TextView(this).apply { text = value; textSize = 22f; gravity = Gravity.START }
    private fun bodyText(value: String) = TextView(this).apply { text = value; textSize = 15f; setPadding(0, dp(12), 0, dp(12)) }
    private fun matchWidth() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_SESSION_ID = "reservationSessionId"
        const val EXTRA_DETAIL_URL = "reservationDetailUrl"
    }
}
