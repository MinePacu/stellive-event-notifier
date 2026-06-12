package dev.stellive.hub

import dev.stellive.hub.core.model.HubEventImage
import dev.stellive.hub.core.model.HubEventImagePolicyState
import dev.stellive.hub.feature.hubevents.HubEventImagePolicy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventImagePolicyTest {
    @Test
    fun displaysOnlyAllowedHttpsImagePolicies() {
        assertTrue(
            HubEventImagePolicy.canDisplay(
                HubEventImage(HubEventImagePolicyState.OFFICIAL_RUNTIME_URL, url = "https://example.com/event.jpg")
            )
        )
        assertTrue(
            HubEventImagePolicy.canDisplay(
                HubEventImage(HubEventImagePolicyState.THIRD_PARTY_ALLOWED, url = "https://example.com/event.jpg")
            )
        )
    }

    @Test
    fun hidesNonDisplayableImagePolicies() {
        assertFalse(HubEventImagePolicy.canDisplay(HubEventImage(HubEventImagePolicyState.NONE, url = "https://example.com/event.jpg")))
        assertFalse(HubEventImagePolicy.canDisplay(HubEventImage(HubEventImagePolicyState.VERIFY_REQUIRED, url = "https://example.com/event.jpg")))
        assertFalse(HubEventImagePolicy.canDisplay(HubEventImage(HubEventImagePolicyState.BLOCKED, url = "https://example.com/event.jpg")))
    }

    @Test
    fun hidesMissingInvalidAndHttpUrls() {
        assertFalse(HubEventImagePolicy.canDisplay(null))
        assertFalse(HubEventImagePolicy.canDisplay(HubEventImage(HubEventImagePolicyState.OFFICIAL_RUNTIME_URL)))
        assertFalse(HubEventImagePolicy.canDisplay(HubEventImage(HubEventImagePolicyState.OFFICIAL_RUNTIME_URL, url = "not-a-url")))
        assertFalse(HubEventImagePolicy.canDisplay(HubEventImage(HubEventImagePolicyState.OFFICIAL_RUNTIME_URL, url = "http://example.com/event.jpg")))
    }
}
