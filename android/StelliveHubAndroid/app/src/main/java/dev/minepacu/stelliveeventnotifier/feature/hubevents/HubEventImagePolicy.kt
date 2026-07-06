package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEventImage
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImagePolicyState

object HubEventImagePolicy {
    fun canDisplay(image: HubEventImage?): Boolean {
        val url = image?.url?.trim()
        if (url.isNullOrEmpty() || !url.startsWith("https://")) return false
        return image.policyState == HubEventImagePolicyState.OFFICIAL_RUNTIME_URL ||
            image.policyState == HubEventImagePolicyState.THIRD_PARTY_ALLOWED
    }
}
