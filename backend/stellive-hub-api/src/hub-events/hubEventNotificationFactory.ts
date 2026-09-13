import type { HubEvent, HubEventScheduleItem, PlatformEvent, PlatformEventType } from "../types.js";
import { normalizeSafeImageUrl } from "../notification/imageUrlPolicy.js";
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

function metadataFor(event: AdminHubEvent, action: HubEventAdminAction, scheduleItem?: HubEventScheduleItem) {
  return {
    hubEventId: event.id,
    revision: event.revision,
    adminAction: action,
    ...(scheduleItem ? {
      scheduleItemId: scheduleItem.id,
      scheduledAt: new Date(scheduleItem.startsAt).toISOString(),
      trigger: scheduleEventType(scheduleItem.kind)
    } : {})
  };
}

function notificationImageUrl(event: AdminHubEvent): string | undefined {
  if (
    event.image?.policyState !== "official_runtime_url" &&
    event.image?.policyState !== "third_party_allowed"
  ) {
    return undefined;
  }

  return normalizeSafeImageUrl(event.image.url);
}

function candidate(
  event: AdminHubEvent,
  type: PlatformEventType,
  dedupeKey: string,
  action: HubEventAdminAction,
  now: Date,
  scheduleItem?: HubEventScheduleItem
): PlatformEvent {
  const timestamp = scheduleItem ? new Date(scheduleItem.startsAt).toISOString() : eventTimestamp(event, now);

  return {
    id: dedupeKey,
    source: "hub_event",
    type,
    memberId: memberIdFor(event),
    generationId: event.generationId,
    title: event.title,
    body: scheduleItem?.description ?? scheduleItem?.label ?? event.summary ?? event.sourceLabel,
    thumbnailUrl: notificationImageUrl(event),
    platformUrl: scheduleItem?.actionUrl ?? scheduleItem?.sourceUrl ?? event.purchaseUrl ?? event.ticketUrl ?? event.sourceUrl,
    appDeepLink: scheduleItem
      ? `stellivehub://hub-events/${event.id}?scheduleItemId=${encodeURIComponent(scheduleItem.id)}`
      : `stellivehub://hub-events/${event.id}`,
    occurredAt: timestamp,
    receivedAt: now.toISOString(),
    dedupeKey,
    rawPayload: metadataFor(event, action, scheduleItem),
    realtimeEligible: false,
    deliveryMode: "standard"
  };
}

function scheduleEventType(kind: HubEventScheduleItem["kind"]): PlatformEventType | undefined {
  if (kind === "sales_open" || kind === "ticket_open") return "event_sales_open";
  if (kind === "deadline") return "event_deadline_soon";
  if (kind === "content_reveal" || kind === "release" || kind === "custom") return "event_milestone_due";
  return undefined;
}

function scheduleCandidates(
  event: AdminHubEvent,
  action: HubEventAdminAction,
  now: Date,
  before?: AdminHubEvent
): PlatformEvent[] {
  return (event.scheduleItems ?? []).flatMap((scheduleItem) => {
    const type = scheduleEventType(scheduleItem.kind);
    if (!type || scheduleItem.cancelledAt || !scheduleItem.notificationEligible) return [];
    const scheduledAt = new Date(scheduleItem.startsAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= now.getTime()) return [];
    const previous = before?.scheduleItems?.find((item) => item.id === scheduleItem.id);
    if (
      action !== "publish" &&
      previous &&
      previous.kind === scheduleItem.kind &&
      new Date(previous.startsAt).getTime() === scheduledAt.getTime() &&
      previous.notificationEligible === scheduleItem.notificationEligible &&
      Boolean(previous.cancelledAt) === Boolean(scheduleItem.cancelledAt)
    ) {
      return [];
    }
    const timestamp = scheduledAt.toISOString();
    return [candidate(
      event,
      type,
      `hub_event:${event.id}:schedule:${scheduleItem.id}:${type}:${timestamp}:r${event.revision}`,
      action,
      now,
      scheduleItem
    )];
  });
}

const userVisibleScalarFields: Array<keyof HubEvent> = [
  "title",
  "summary",
  "status",
  "category",
  "participationMode",
  "announcedAt",
  "startsAt",
  "endsAt",
  "venueName",
  "venueAddress",
  "sourceUrl",
  "sourceLabel",
  "purchaseUrl",
  "ticketUrl",
  "scheduleMode",
  "memberId",
  "generationId",
  "sourceType"
];

function hasUserVisibleChange(before: AdminHubEvent, after: AdminHubEvent): boolean {
  for (const field of userVisibleScalarFields) {
    if (before[field] !== after[field]) {
      return true;
    }
  }
  return (
    JSON.stringify(before.tags ?? []) !== JSON.stringify(after.tags ?? []) ||
    JSON.stringify(before.links ?? []) !== JSON.stringify(after.links ?? []) ||
    JSON.stringify(before.image ?? null) !== JSON.stringify(after.image ?? null) ||
    JSON.stringify(before.scheduleItems ?? []) !== JSON.stringify(after.scheduleItems ?? [])
  );
}

export function buildHubEventNotificationCandidates(input: HubEventNotificationCandidateInput): PlatformEvent[] {
  const { after, action, now } = input;
  if (!after.notificationEligible) return [];
  if (action !== "publish" && action !== "cancel" && after.publicationState !== "published") return [];

  if (action === "publish") {
    const candidates = [
      candidate(after, "event_announced", `hub_event:${after.id}:event_announced:${after.revision}`, action, now)
    ];
    return [...candidates, ...scheduleCandidates(after, action, now)];
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
    const before = input.before;
    const scheduled = scheduleCandidates(after, action, now, before);
    if (!hasUserVisibleChange(before, after)) {
      return scheduled;
    }
    return [
      candidate(after, "event_updated", `hub_event:${after.id}:event_updated:${after.revision}`, action, now),
      ...scheduled
    ];
  }

  if (action.startsWith("schedule_") && input.before) {
    return scheduleCandidates(after, action, now, input.before);
  }

  return [];
}
