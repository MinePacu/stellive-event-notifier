import generationsSeed from "../../../../shared/member-catalog/generations.seed.json" with { type: "json" };
import type {
  DeliveryMode,
  PlatformEvent,
  PlatformEventType,
  ResolvedNotificationPreference,
  UserNotificationPreference
} from "../types.js";

export interface PreferenceResolutionContext {
  evaluatedAt: Date;
  recentNotificationsInLastMinute?: number;
}

const realtimeEligibleTypes = new Set<PlatformEventType>([
  "chzzk_live_started",
  "youtube_upload",
  "official_youtube_upload"
]);

const generationNotificationDefaults = new Map(
  generationsSeed.map((generation) => [generation.id, generation.notificationDefaultEnabled])
);
const defaultDisabledEventTypes = new Set<PlatformEventType>(["event_updated"]);

function latestRule(preferences: UserNotificationPreference[], predicate: (rule: UserNotificationPreference) => boolean) {
  return preferences.filter(predicate).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

function applyRule(
  matchedRules: string[],
  current: boolean,
  rule: UserNotificationPreference | undefined,
  label: string
) {
  if (!rule) return current;
  matchedRules.push(`${label}:${rule.enabled ? "on" : "off"}`);
  return rule.enabled;
}

function definedRules(rules: Array<UserNotificationPreference | undefined>): UserNotificationPreference[] {
  return rules.filter((rule): rule is UserNotificationPreference => Boolean(rule));
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLocaleLowerCase();
}

function eventText(event: PlatformEvent): string {
  return `${event.title} ${event.body}`.toLocaleLowerCase();
}

function keywordMatches(text: string, keyword: string): boolean {
  const normalized = normalizeKeyword(keyword);
  return normalized.length > 0 && text.includes(normalized);
}

function parseClockTime(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function zonedMinutes(date: Date, timezone: string): number | undefined {
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined;
    return hour * 60 + minute;
  } catch {
    return undefined;
  }
}

function isWithinQuietHours(evaluatedAt: Date, rule: UserNotificationPreference): boolean {
  const quietHours = rule.quietHours;
  if (!quietHours?.enabled) return false;
  const start = parseClockTime(quietHours.start);
  const end = parseClockTime(quietHours.end);
  const current = zonedMinutes(evaluatedAt, quietHours.timezone);
  if (start === undefined || end === undefined || current === undefined) return false;
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function hasKeywordFilters(rule: UserNotificationPreference | undefined): boolean {
  return Boolean(rule?.keywordsAllowlist?.length || rule?.keywordsBlocklist?.length);
}

export class PreferenceResolutionService {
  resolve(
    event: PlatformEvent,
    deviceId: string,
    preferences: UserNotificationPreference[],
    context: PreferenceResolutionContext
  ): ResolvedNotificationPreference {
    const matchedRules: string[] = [];
    const deviceRules = preferences.filter((rule) => rule.deviceId === deviceId);

    const global = latestRule(deviceRules, (rule) => rule.scope === "global");
    if (global && !global.enabled) {
      return this.blocked(event, deviceId, "global_off", ["global:off"], global.tapAction, "standard");
    }

    let shouldNotify = true;
    let tapAction = global?.tapAction ?? "open_app";
    let requestedDelivery: DeliveryMode = global?.deliveryMode ?? "standard";

    const generation = latestRule(deviceRules, (rule) => rule.scope === "generation" && rule.generationId === event.generationId);
    shouldNotify = applyRule(matchedRules, shouldNotify, generation, "generation");

    const member = latestRule(
      deviceRules,
      (rule) => rule.scope === "member" && rule.memberId === event.memberId && rule.explicitOverride
    );
    shouldNotify = applyRule(matchedRules, shouldNotify, member, "member");
    tapAction = member?.tapAction ?? generation?.tapAction ?? tapAction;
    requestedDelivery = member?.deliveryMode ?? generation?.deliveryMode ?? requestedDelivery;

    const platform = latestRule(deviceRules, (rule) => rule.scope === "platform" && rule.source === event.source);
    shouldNotify = applyRule(matchedRules, shouldNotify, platform, "platform");

    const eventType = latestRule(deviceRules, (rule) => rule.scope === "event_type" && rule.eventType === event.type);
    shouldNotify = applyRule(matchedRules, shouldNotify, eventType, "event_type");

    const generationPlatform = latestRule(
      deviceRules,
      (rule) => rule.scope === "generation_platform" && rule.generationId === event.generationId && rule.source === event.source
    );
    shouldNotify = applyRule(matchedRules, shouldNotify, generationPlatform, "generation_platform");

    const generationEvent = latestRule(
      deviceRules,
      (rule) => rule.scope === "generation_event_type" && rule.generationId === event.generationId && rule.eventType === event.type
    );
    shouldNotify = applyRule(matchedRules, shouldNotify, generationEvent, "generation_event_type");

    const memberPlatform = latestRule(
      deviceRules,
      (rule) => rule.scope === "member_platform" && rule.memberId === event.memberId && rule.source === event.source && rule.explicitOverride
    );
    shouldNotify = applyRule(matchedRules, shouldNotify, memberPlatform, "member_platform");

    const memberEvent = latestRule(
      deviceRules,
      (rule) => rule.scope === "member_event_type" && rule.memberId === event.memberId && rule.eventType === event.type && rule.explicitOverride
    );
    shouldNotify = applyRule(matchedRules, shouldNotify, memberEvent, "member_event_type");

    requestedDelivery =
      memberEvent?.deliveryMode ??
      memberPlatform?.deliveryMode ??
      generationEvent?.deliveryMode ??
      generationPlatform?.deliveryMode ??
      eventType?.deliveryMode ??
      platform?.deliveryMode ??
      requestedDelivery;

    if (event.type === "chzzk_chat" && !memberEvent?.enabled) {
      return this.blocked(event, deviceId, "chzzk_chat_default_off", [...matchedRules, "chzzk_chat:default_off"], tapAction, "standard");
    }
    if (event.type === "chzzk_chat" && !hasKeywordFilters(memberEvent)) {
      return this.blocked(event, deviceId, "chzzk_chat_filter_required", [...matchedRules, "chzzk_chat:filter_required"], tapAction, "standard");
    }

    if (!shouldNotify) {
      return this.blocked(event, deviceId, "preference_off", matchedRules, tapAction, "standard");
    }

    const failedDefaultOffAxes: string[] = [];
    const generationDefaultsToOff = generationNotificationDefaults.get(event.generationId) === false;
    const generationExplicitlyEnabled = [
      generation,
      member,
      generationPlatform,
      generationEvent,
      memberPlatform,
      memberEvent
    ].some((rule) => rule?.enabled);
    if (generationDefaultsToOff && !generationExplicitlyEnabled) {
      failedDefaultOffAxes.push("generation:default_off");
    }

    const eventTypeDefaultsToOff = defaultDisabledEventTypes.has(event.type);
    const eventTypeExplicitlyEnabled = [eventType, generationEvent, memberEvent].some((rule) => rule?.enabled);
    if (eventTypeDefaultsToOff && !eventTypeExplicitlyEnabled) {
      failedDefaultOffAxes.push("event_type:default_off");
    }

    if (failedDefaultOffAxes.length > 0) {
      return this.blocked(
        event,
        deviceId,
        "preference_default_off",
        [...matchedRules, ...failedDefaultOffAxes],
        tapAction,
        "standard"
      );
    }

    const applicableRules = definedRules([
      global,
      generation,
      member,
      platform,
      eventType,
      generationPlatform,
      generationEvent,
      memberPlatform,
      memberEvent
    ]);

    if (applicableRules.some((rule) => isWithinQuietHours(context.evaluatedAt, rule))) {
      return this.blocked(event, deviceId, "quiet_hours", [...matchedRules, "quiet_hours:on"], tapAction, "standard");
    }

    const text = eventText(event);
    if (applicableRules.some((rule) => rule.keywordsBlocklist?.some((keyword) => keywordMatches(text, keyword)))) {
      return this.blocked(event, deviceId, "keyword_blocklist", [...matchedRules, "keyword_blocklist:match"], tapAction, "standard");
    }

    const allowlistKeywords = applicableRules.flatMap((rule) => rule.keywordsAllowlist ?? []).map(normalizeKeyword).filter(Boolean);
    if (allowlistKeywords.length > 0 && !allowlistKeywords.some((keyword) => text.includes(keyword))) {
      return this.blocked(event, deviceId, "keyword_allowlist_no_match", [...matchedRules, "keyword_allowlist:no_match"], tapAction, "standard");
    }

    const maxNotificationsPerMinute = applicableRules
      .map((rule) => rule.maxNotificationsPerMinute)
      .filter((limit): limit is number => typeof limit === "number")
      .sort((a, b) => a - b)[0];
    if (
      maxNotificationsPerMinute !== undefined &&
      context.recentNotificationsInLastMinute !== undefined &&
      context.recentNotificationsInLastMinute >= maxNotificationsPerMinute
    ) {
      return this.blocked(event, deviceId, "rate_limited", [...matchedRules, `rate_limit:${maxNotificationsPerMinute}/minute`], tapAction, "standard");
    }

    const deliveryMode = this.resolveDeliveryMode(event, requestedDelivery);
    return {
      eventId: event.id,
      deviceId,
      shouldNotify: true,
      reason: "allowed",
      matchedRules,
      tapAction,
      deliveryMode,
      pushPriority: deliveryMode === "realtime_best_effort" ? "high" : "normal",
      foregroundStreamEligible: deliveryMode === "realtime_best_effort"
    };
  }

  resolveDeliveryMode(event: PlatformEvent, requestedDelivery: DeliveryMode): DeliveryMode {
    if (requestedDelivery !== "realtime_best_effort") return "standard";
    if (!event.realtimeEligible || !realtimeEligibleTypes.has(event.type)) return "standard";
    return "realtime_best_effort";
  }

  private blocked(
    event: PlatformEvent,
    deviceId: string,
    reason: string,
    matchedRules: string[],
    tapAction: "open_app" | "open_platform",
    deliveryMode: DeliveryMode
  ): ResolvedNotificationPreference {
    return {
      eventId: event.id,
      deviceId,
      shouldNotify: false,
      reason,
      matchedRules,
      tapAction,
      deliveryMode,
      pushPriority: "normal",
      foregroundStreamEligible: false
    };
  }
}
