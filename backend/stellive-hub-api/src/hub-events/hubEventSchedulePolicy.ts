import type { HubEventScheduleItem, HubEventScheduleMode } from "../types.js";

type ScheduleItemLike = Pick<Partial<HubEventScheduleItem>, "kind" | "isPrimary" | "sortOrder"> & {
  cancelledAt?: string | Date | null;
};

export function activeHubEventScheduleItems<T extends ScheduleItemLike>(items: readonly T[]): T[] {
  return items.filter((item) => !item.cancelledAt);
}

export function deriveHubEventScheduleMode(items: readonly ScheduleItemLike[]): HubEventScheduleMode {
  const activeItems = activeHubEventScheduleItems(items);
  return activeItems.length >= 2 || activeItems.some((item) => item.kind !== "main_window")
    ? "timeline"
    : "single_window";
}

export function primaryHubEventScheduleItem<T extends ScheduleItemLike>(items: readonly T[]): T | undefined {
  return activeHubEventScheduleItems(items).find((item) => item.isPrimary);
}

export function withDefaultPrimaryScheduleItem<T extends ScheduleItemLike>(items: T[]): T[] {
  const activeItems = activeHubEventScheduleItems(items);
  if (activeItems.length === 0 || activeItems.some((item) => item.isPrimary)) return items;
  const firstActive = activeItems
    .slice()
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))[0];
  return items.map((item) => item === firstActive ? { ...item, isPrimary: true } as T : item);
}
