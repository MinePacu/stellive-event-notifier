package dev.minepacu.stelliveeventnotifier.feature.reservations.system

import android.app.AlertDialog
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.ImageView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.doOnLayout
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import com.google.android.material.card.MaterialCardView
import dagger.hilt.android.AndroidEntryPoint
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.databinding.ActivityReservationQuickAddBinding
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.RoomReservationRepository
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftSelection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationQuickAddPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationQuickAddScreenTitle
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLValidation
import dev.minepacu.stelliveeventnotifier.ui.components.HubBottomSheetDialog
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@AndroidEntryPoint
class ReservationQuickAddActivity : AppCompatActivity() {
    @Inject lateinit var repository: RoomReservationRepository

    private lateinit var binding: ActivityReservationQuickAddBinding
    private var selectedDraft: ReservationDraft? = null
    private var isCheckingExistingRecord = false
    private var isSaving = false
    private var topBarScrolled: Boolean? = null
    private var invalidClipboardSheet: HubBottomSheetDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityReservationQuickAddBinding.inflate(layoutInflater)
        setContentView(binding.root)
        configureWindowChrome()
        configureViews()
        updateTopBarGlass(scrolled = false)
        constrainContentWidthOnLargeScreens()
        lifecycleScope.launch { loadDrafts() }
    }

    private fun configureWindowChrome() {
        window.statusBarColor = ContextCompat.getColor(this, R.color.hub_background)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.hub_card)
        val isDark = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isDark
            isAppearanceLightNavigationBars = !isDark
        }
    }

    private fun configureViews() = with(binding) {
        quickAddBack.setOnClickListener { finish() }
        quickAddEmptyGoGoodsEvents.setOnClickListener { openGoodsEvents() }
        quickAddPaste.setOnClickListener { pasteFirstHttpsURL() }
        quickAddLinkless.setOnClickListener { confirm(detailUrl = null, allowSensitive = false) }
        quickAddPrimary.setOnClickListener { validateAndConfirm() }
        quickAddScroll.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            updateTopBarGlass(scrolled = scrollY > dp(TOP_BAR_SCROLL_THRESHOLD_DP))
        }
        quickAddDetailUrl.doAfterTextChanged {
            quickAddLinkError.visibility = View.GONE
            updateActionState()
        }
        quickAddDetailUrl.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus && quickAddDetailUrl.text?.isNotBlank() == true) showUrlErrorIfInvalid()
        }
        quickAddDetailUrl.setOnEditorActionListener { _, _, _ ->
            if (ReservationQuickAddPresentationPolicy.isPrimaryActionEnabled(quickAddDetailUrl.text?.toString())) {
                validateAndConfirm()
            } else if (quickAddDetailUrl.text?.isNotBlank() == true) {
                showUrlErrorIfInvalid()
            }
            true
        }
    }

    private fun updateTopBarGlass(scrolled: Boolean) {
        if (topBarScrolled == scrolled) return
        topBarScrolled = scrolled
        binding.quickAddTopGlassOverlay.setBackgroundResource(
            if (scrolled) R.drawable.bg_top_bar_glass_scrolled else R.drawable.bg_top_bar_glass,
        )
    }

    private fun constrainContentWidthOnLargeScreens() {
        binding.quickAddScroll.doOnLayout {
            val content = binding.quickAddScroll.getChildAt(0) ?: return@doOnLayout
            val params = content.layoutParams as? FrameLayout.LayoutParams ?: return@doOnLayout
            val width = minOf(binding.quickAddScroll.width, dp(LARGE_SCREEN_CONTENT_MAX_WIDTH_DP))
            if (params.width != width || params.gravity != Gravity.CENTER_HORIZONTAL) {
                params.width = width
                params.gravity = Gravity.CENTER_HORIZONTAL
                content.layoutParams = params
            }
        }
    }

    private suspend fun loadDrafts() {
        repository.cleanupExpired()
        val drafts = repository.drafts.first()
        val requested = intent.getStringExtra(EXTRA_SESSION_ID)
            ?.let { raw -> drafts.firstOrNull { it.sessionId.toString() == raw } }
        when (val selection = requested?.let { ReservationDraftSelection.Selected(it) } ?: ReservationDraftPolicy.selection(drafts)) {
            ReservationDraftSelection.None -> showEmpty()
            is ReservationDraftSelection.Selected -> showForm(selection.draft)
            is ReservationDraftSelection.Choose -> showDraftPicker(selection.drafts)
        }
    }

    private fun showEmpty() = with(binding) {
        setToolbarTitle(screenTitle(ReservationQuickAddPresentationPolicy.screenTitle(kind = null)))
        selectedDraft = null
        quickAddEmptyState.visibility = View.VISIBLE
        quickAddPickerState.visibility = View.GONE
        quickAddFormState.visibility = View.GONE
        quickAddActions.visibility = View.GONE
    }

    private fun showDraftPicker(drafts: List<ReservationDraft>) = with(binding) {
        setToolbarTitle(screenTitle(ReservationQuickAddPresentationPolicy.screenTitle(kind = null)))
        selectedDraft = null
        quickAddEmptyState.visibility = View.GONE
        quickAddPickerState.visibility = View.VISIBLE
        quickAddFormState.visibility = View.GONE
        quickAddActions.visibility = View.GONE
        quickAddPickerList.removeAllViews()
        drafts.forEach { quickAddPickerList.addView(draftPickerCard(it)) }
    }

    private fun showForm(draft: ReservationDraft) = with(binding) {
        val presentation = ReservationQuickAddPresentationPolicy.presentation(draft)
        selectedDraft = draft
        setToolbarTitle(screenTitle(presentation.screenTitle))
        quickAddEmptyState.visibility = View.GONE
        quickAddPickerState.visibility = View.GONE
        quickAddFormState.visibility = View.VISIBLE
        quickAddActions.visibility = View.VISIBLE
        quickAddSummaryKind.text = presentation.inProgressLabel
        quickAddSummaryTitle.text = presentation.title
        quickAddSummaryProvider.text = getString(
            R.string.reservation_quick_add_provider,
            draft.providerHost.ifBlank { draft.eventSnapshot.sourceLabel },
        )
        quickAddSummaryExpiry.text = presentation.expiry?.let(::expiryText)
        quickAddSummaryExpiry.visibility = if (presentation.expiry == null) View.GONE else View.VISIBLE
        quickAddLinkLabel.text = presentation.detailLinkLabel
        quickAddPrimary.text = presentation.primaryActionLabel
        quickAddDetailUrl.setText(intent.getStringExtra(EXTRA_DETAIL_URL).orEmpty())
        quickAddDetailUrl.setSelection(quickAddDetailUrl.text?.length ?: 0)
        updateActionState()
    }

    private fun draftPickerCard(draft: ReservationDraft): MaterialCardView {
        val presentation = ReservationQuickAddPresentationPolicy.presentation(draft)
        return MaterialCardView(this).apply {
            isClickable = true
            isFocusable = true
            cardElevation = 0f
            radius = dp(16).toFloat()
            strokeWidth = dp(1)
            strokeColor = ContextCompat.getColor(context, R.color.hub_line)
            setCardBackgroundColor(ContextCompat.getColor(context, R.color.hub_card_surface))
            contentDescription = getString(
                R.string.reservation_quick_add_picker_item_description,
                presentation.inProgressLabel,
                presentation.title,
                draft.providerHost.ifBlank { draft.eventSnapshot.sourceLabel },
                presentation.expiry?.let(::expiryText).orEmpty(),
            )
            setOnClickListener { showForm(draft) }
            addView(LinearLayout(context).apply {
                gravity = Gravity.CENTER_VERTICAL
                minimumHeight = dp(76)
                orientation = LinearLayout.HORIZONTAL
                setPadding(dp(14), dp(12), dp(12), dp(12))
                addView(ImageView(context).apply {
                    setImageResource(R.drawable.ic_reservation_ticket)
                    imageTintList = ContextCompat.getColorStateList(context, R.color.hub_primary)
                    contentDescription = null
                }, LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginEnd = dp(12) })
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = presentation.inProgressLabel
                        textSize = 12f
                        setTextColor(ContextCompat.getColor(context, R.color.hub_primary))
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                    })
                    addView(TextView(context).apply {
                        text = presentation.title
                        maxLines = 1
                        ellipsize = android.text.TextUtils.TruncateAt.END
                        textSize = 15f
                        setTextColor(ContextCompat.getColor(context, R.color.hub_text))
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        setPadding(0, dp(3), 0, 0)
                    })
                    addView(TextView(context).apply {
                        text = getString(R.string.reservation_quick_add_provider, draft.providerHost.ifBlank { draft.eventSnapshot.sourceLabel })
                        maxLines = 1
                        ellipsize = android.text.TextUtils.TruncateAt.END
                        textSize = 12f
                        setTextColor(ContextCompat.getColor(context, R.color.hub_text_muted))
                        setPadding(0, dp(3), 0, 0)
                    })
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(ImageView(context).apply {
                    setImageResource(R.drawable.ic_chevron_right)
                    imageTintList = ContextCompat.getColorStateList(context, R.color.hub_text_subtle)
                    contentDescription = null
                }, LinearLayout.LayoutParams(dp(20), dp(20)))
            })
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(10) }
        }
    }

    private fun updateActionState() = with(binding) {
        val canSave = selectedDraft != null &&
            !isCheckingExistingRecord &&
            !isSaving &&
            ReservationQuickAddPresentationPolicy.isPrimaryActionEnabled(quickAddDetailUrl.text?.toString())
        quickAddPrimary.isEnabled = canSave
        quickAddPrimary.alpha = if (canSave) 1f else DISABLED_ACTION_ALPHA
        quickAddPrimary.text = if (isSaving) {
            getString(R.string.reservation_quick_add_saving)
        } else {
            selectedDraft?.let { ReservationQuickAddPresentationPolicy.presentation(it).primaryActionLabel }.orEmpty()
        }
        quickAddPrimary.contentDescription = quickAddPrimary.text
        val canAddWithoutLink = selectedDraft != null && !isCheckingExistingRecord && !isSaving
        quickAddLinkless.isEnabled = canAddWithoutLink
        quickAddLinkless.alpha = if (canAddWithoutLink) 1f else DISABLED_ACTION_ALPHA
        quickAddLinkless.contentDescription = getString(R.string.reservation_quick_add_linkless)
        quickAddPaste.isEnabled = !isCheckingExistingRecord && !isSaving
    }

    private fun showUrlErrorIfInvalid(): Boolean {
        val validation = ReservationURLPolicy.validate(binding.quickAddDetailUrl.text?.toString())
        binding.quickAddLinkError.text = validation.error
        binding.quickAddLinkError.visibility = if (validation.isValid) View.GONE else View.VISIBLE
        return validation.isValid
    }

    private fun validateAndConfirm() {
        if (isCheckingExistingRecord || isSaving) return
        val validation = ReservationURLPolicy.validate(binding.quickAddDetailUrl.text?.toString())
        if (!validation.isValid) {
            showUrlErrorIfInvalid()
            return
        }
        val normalizedUrl = validation.normalizedUrl ?: return
        isCheckingExistingRecord = true
        updateActionState()
        lifecycleScope.launch {
            runCatching { repository.findReservationByDetailUrl(normalizedUrl) }
                .onSuccess { existingRecord ->
                    isCheckingExistingRecord = false
                    updateActionState()
                    if (existingRecord != null) {
                        showDuplicateLinkDialog(existingRecord.id.toString(), validation)
                    } else {
                        confirmAfterSensitivity(validation)
                    }
                }
                .onFailure {
                    isCheckingExistingRecord = false
                    updateActionState()
                    Toast.makeText(this@ReservationQuickAddActivity, R.string.reservation_error_save_failed, Toast.LENGTH_SHORT).show()
                }
        }
    }

    private fun showDuplicateLinkDialog(recordId: String, validation: ReservationURLValidation) {
        AlertDialog.Builder(this)
            .setTitle(R.string.reservation_error_duplicate_title)
            .setMessage(R.string.reservation_error_duplicate_message)
            .setNegativeButton(R.string.dialog_cancel, null)
            .setNeutralButton(R.string.reservation_help_action_view_existing) { _, _ ->
                startActivity(Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("stellivehub://reservations/$recordId"),
                    this@ReservationQuickAddActivity,
                    MainActivity::class.java,
                ))
                finish()
            }
            .setPositiveButton(R.string.reservation_action_save_anyway) { _, _ -> confirmAfterSensitivity(validation) }
            .show()
    }

    private fun confirmAfterSensitivity(validation: ReservationURLValidation) {
        if (validation.isSensitive) {
            AlertDialog.Builder(this)
                .setTitle(R.string.reservation_error_sensitive_title)
                .setMessage(R.string.reservation_error_sensitive_message)
                .setNegativeButton(R.string.dialog_cancel, null)
                .setPositiveButton(R.string.reservation_action_save_locally) { _, _ ->
                    confirm(validation.normalizedUrl, allowSensitive = true)
                }
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
        binding.quickAddDetailUrl.setText(url)
        binding.quickAddDetailUrl.setSelection(url.length)
    }

    private fun showInvalidClipboardLinkDialog() {
        if (invalidClipboardSheet != null) return
        hideKeyboardForBottomSheet()
        var focusUrlAfterDismiss = false
        var confirmWithoutLinkAfterDismiss = false
        val sheet = HubBottomSheetDialog(this, getString(R.string.reservation_quick_add_invalid_clipboard_title))
        invalidClipboardSheet = sheet
        sheet.setOnDismissListener {
            invalidClipboardSheet = null
            if (focusUrlAfterDismiss && !isFinishing && !isDestroyed) focusDetailUrlInput()
            if (confirmWithoutLinkAfterDismiss && !isFinishing && !isDestroyed) {
                confirm(detailUrl = null, allowSensitive = false)
            }
        }
        sheet.addContent(TextView(this).apply {
            setText(R.string.reservation_quick_add_invalid_clipboard_body)
            textSize = 14f
            setTextColor(ContextCompat.getColor(context, R.color.hub_text_muted))
            includeFontPadding = false
        })
        sheet.addContent(bottomSheetAction(sheet, R.string.reservation_quick_add_enter_link, primary = true) {
            focusUrlAfterDismiss = true
            sheet.dismiss()
        })
        sheet.addContent(bottomSheetAction(sheet, R.string.reservation_quick_add_add_without_link, primary = false) {
            confirmWithoutLinkAfterDismiss = true
            sheet.dismiss()
        })
        sheet.addContent(bottomSheetAction(sheet, R.string.dialog_close, primary = false) {
            sheet.dismiss()
        }.apply {
            alpha = 0.82f
        })
        sheet.show()
    }

    private fun bottomSheetAction(
        sheet: HubBottomSheetDialog,
        labelRes: Int,
        primary: Boolean,
        onClick: () -> Unit,
    ) = sheet.actionButton(getString(labelRes), primary, onClick).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(10) }
    }

    private fun hideKeyboardForBottomSheet() {
        binding.quickAddDetailUrl.clearFocus()
        WindowInsetsControllerCompat(window, binding.root).hide(WindowInsetsCompat.Type.ime())
    }

    private fun focusDetailUrlInput() {
        binding.quickAddScroll.post {
            binding.quickAddScroll.smoothScrollTo(0, binding.quickAddDetailUrl.top)
            binding.quickAddDetailUrl.requestFocus()
            (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                .showSoftInput(binding.quickAddDetailUrl, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    override fun onDestroy() {
        invalidClipboardSheet?.dismiss()
        invalidClipboardSheet = null
        super.onDestroy()
    }

    private fun confirm(detailUrl: String?, allowSensitive: Boolean) {
        val draft = selectedDraft ?: return
        if (isSaving) return
        isSaving = true
        updateActionState()
        lifecycleScope.launch {
            runCatching {
                repository.confirm(
                    sessionId = draft.sessionId,
                    detailUrl = detailUrl,
                    linkSource = if (intent.action == Intent.ACTION_SEND) ReservationLinkSource.BROWSER_SHARE else ReservationLinkSource.SYSTEM_SHORTCUT,
                    allowSensitiveUrl = allowSensitive,
                )
            }.onSuccess {
                ReservationTileService.requestRefresh(this@ReservationQuickAddActivity)
                Toast.makeText(
                    this@ReservationQuickAddActivity,
                    getString(R.string.reservation_quick_add_success, ReservationQuickAddPresentationPolicy.presentation(draft).primaryActionLabel),
                    Toast.LENGTH_SHORT,
                ).show()
                finish()
            }.onFailure {
                isSaving = false
                updateActionState()
                Toast.makeText(this@ReservationQuickAddActivity, R.string.reservation_error_save_failed, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun openGoodsEvents() {
        startActivity(Intent(this, MainActivity::class.java).apply {
            putExtra(EXTRA_APP_DEEP_LINK, GOODS_EVENTS_DEEP_LINK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        })
        finish()
    }

    private fun setToolbarTitle(value: String) {
        title = value
        binding.quickAddToolbarTitle.text = value
    }

    private fun screenTitle(title: ReservationQuickAddScreenTitle): String = getString(
        when (title) {
            ReservationQuickAddScreenTitle.GENERIC -> R.string.reservation_quick_add_title
            ReservationQuickAddScreenTitle.TICKET -> R.string.reservation_quick_add_ticket_title
            ReservationQuickAddScreenTitle.PURCHASE -> R.string.reservation_quick_add_purchase_title
            ReservationQuickAddScreenTitle.RESERVATION -> R.string.reservation_quick_add_reservation_title
        },
    )

    private fun expiryText(expiry: dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryPresentation): String = when (expiry.kind) {
        ReservationDraftExpiryKind.HOURS -> getString(R.string.reservation_draft_expiry_hours, expiry.value ?: 1)
        ReservationDraftExpiryKind.MINUTES -> getString(R.string.reservation_draft_expiry_minutes, expiry.value ?: 1)
        ReservationDraftExpiryKind.SOON -> getString(R.string.reservation_draft_expiry_soon)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_SESSION_ID = "reservationSessionId"
        const val EXTRA_DETAIL_URL = "reservationDetailUrl"
        private const val EXTRA_APP_DEEP_LINK = "appDeepLink"
        private const val GOODS_EVENTS_DEEP_LINK = "stellivehub://goods-events"
        private const val DISABLED_ACTION_ALPHA = 0.45f
        private const val LARGE_SCREEN_CONTENT_MAX_WIDTH_DP = 760
        private const val TOP_BAR_SCROLL_THRESHOLD_DP = 8
    }
}
