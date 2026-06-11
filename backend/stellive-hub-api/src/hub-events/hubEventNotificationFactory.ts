import type { PlatformEvent, PlatformEventType } from "../types.js";
import type { AdminHubEvent, HubEventAdminAction } from "./hubEventAdminTypes.js";

export interface HubEventNotificationCandidateInput {
  before?: AdminHubEvent;
  after: AdminHubEvent;
  action: HubEventAdminAction;
  now: Date;
}

function memberIdFor(event: AdminHubEvent): string {
  return event.memberId ?? (event.generationId === "official" ? "stellive-official" : `hub-event:${event.id}`);
}

function eventTimestamp(event: AdminHubEvent, now: Date): string {
  return event.updatedAt ?? now.toISOString();
}

function metadataFor(event: AdminHubEvent, action: HubEventAdminAction) {
  return {
    hubEventId: event.id,
    revision: event.revision,
    adminAction: action
  };
}

function candidate(
  event: AdminHubEvent,
  type: PlatformEventType,
  dedupeKey: string,
  action: HubEventAdminAction,
  now: Date
): PlatformEvent {
  const timestamp = eventTimestamp(event, now);

  return {
    id: dedupeKey,
    source: "hub_event",
    type,
    memberId: memberIdFor(event),
    generationId: event.generationId,
    title: event.title,
    body: event.summary ?? event.sourceLabel,
    platformUrl: event.purchaseUrl ?? event.ticketUrl ?? event.sourceUrl,
    appDeepLink: `stellivehub://hub-events/${event.id}`,
    occurredAt: timestamp,
    receivedAt: now.toISOString(),
    dedupeKey,
    rawPayload: metadataFor(event, action),
    realtimeEligible: false,
    deliveryMode: "standard"
  };
}

function isPastOrNow(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime();
}

export function buildHubEventNotificationCandidates(input: HubEventNotificationCandidateInput): PlatformEvent[] {
  const { after, action, now } = input;
  if (!after.notificationEligible) return [];

  if (action === "publish") {
    const candidates = [
      candidate(after, "event_announced", `hub_event:${after.id}:event_announced:${after.revision}`, action, now)
    ];

    if (isPastOrNow(after.startsAt, now)) {
      candidates.push(
        candidate(after, "event_sales_open", `hub_event:${after.id}:event_sales_open:${after.startsAt}`, action, now)
      );
    }

    return candidates;
  }

  if (action === "cancel") {
    return [
      candidate(
        after,
        "event_cancelled",
        `hub_event:${after.id}:event_cancelled:${after.cancelledAt ?? now.toISOString()}`,
        action,
        now
      )
    ];
  }

  if (action === "update" && input.before) {
    return [candidate(after, "event_updated", `hub_event:${after.id}:event_updated:${after.revision}`, action, now)];
  }

  return [];
}
