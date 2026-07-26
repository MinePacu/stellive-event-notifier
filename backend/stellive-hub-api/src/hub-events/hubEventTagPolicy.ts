import { HUB_EVENT_TAGS, type HubEventTag } from "../types.js";

export const maxHubEventTags = HUB_EVENT_TAGS.length;

const allowedHubEventTags = new Set<string>(HUB_EVENT_TAGS);

export function isHubEventTag(value: string): value is HubEventTag {
  return allowedHubEventTags.has(value);
}

/** Normalizes only the representation; validation remains responsible for rejecting values. */
export function normalizeHubEventTags(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const tags: unknown[] = [];
  const seen = new Set<string>();
  for (const rawTag of value) {
    const tag = typeof rawTag === "string" ? rawTag.trim() : rawTag;
    if (typeof tag === "string" && seen.has(tag)) continue;
    if (typeof tag === "string") seen.add(tag);
    tags.push(tag);
  }
  return tags;
}
