import type { HubEvent, HubEventLink, HubEventLinkKind, HubEventScheduleItem } from "../types.js";

export const hubEventLinkKinds: readonly HubEventLinkKind[] = [
  "source",
  "purchase",
  "ticket",
  "reservation",
  "content",
  "video",
  "map",
  "custom"
];

export type HubEventLinkInput = Omit<HubEventLink, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<HubEventLink, "id" | "createdAt" | "updatedAt">>;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHubEventLinks(links: readonly HubEventLinkInput[] | undefined): HubEventLinkInput[] | undefined {
  if (links === undefined) return undefined;
  return links.map((link, index) => ({
    ...link,
    label: link.label?.trim() || undefined,
    url: link.url?.trim(),
    sortOrder: link.sortOrder ?? index
  }));
}

function resolvedLinks(links: readonly HubEventLink[] | undefined): HubEventLink[] {
  const seen = new Set<string>();
  return (links ?? [])
    .filter((link) => isHttpsUrl(link.url.trim()))
    .map((link) => ({ ...link, label: link.label?.trim() || undefined, url: link.url.trim() }))
    .sort((left, right) => left.sortOrder - right.sortOrder || (left.id ?? "").localeCompare(right.id ?? ""))
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    });
}

function legacyLink(id: string, kind: HubEventLinkKind, url: string | undefined, label: string | undefined, sortOrder: number): HubEventLink | undefined {
  const normalizedUrl = url?.trim();
  if (!normalizedUrl || !isHttpsUrl(normalizedUrl)) return undefined;
  return { id, kind, label: label?.trim() || undefined, url: normalizedUrl, sortOrder };
}

export function resolvedEventLinks(event: Pick<HubEvent, "id" | "links" | "purchaseUrl" | "ticketUrl" | "sourceUrl" | "sourceLabel">): HubEventLink[] {
  const current = resolvedLinks(event.links);
  if (current.length > 0) return current;
  return resolvedLinks([
    legacyLink(`legacy:${event.id}:purchase`, "purchase", event.purchaseUrl, undefined, 0),
    legacyLink(`legacy:${event.id}:ticket`, "ticket", event.ticketUrl, undefined, 1),
    legacyLink(`legacy:${event.id}:source`, "source", event.sourceUrl, event.sourceLabel, 2)
  ].filter((link): link is HubEventLink => Boolean(link)));
}

export function resolvedScheduleLinks(item: Pick<HubEventScheduleItem, "id" | "kind" | "links" | "actionUrl" | "sourceUrl" | "sourceLabel">): HubEventLink[] {
  const current = resolvedLinks(item.links);
  if (current.length > 0) return current;
  const actionKind: HubEventLinkKind = item.kind === "sales_open"
    ? "purchase"
    : item.kind === "ticket_open"
      ? "ticket"
      : item.kind === "deadline" || item.kind === "main_window"
        ? "reservation"
        : item.kind === "announcement"
          ? "source"
          : "content";
  return resolvedLinks([
    legacyLink(`legacy:${item.id}:action`, actionKind, item.actionUrl, undefined, 0),
    legacyLink(`legacy:${item.id}:source`, "source", item.sourceUrl, item.sourceLabel, 1)
  ].filter((link): link is HubEventLink => Boolean(link)));
}

export function firstEventLegacyProjection(links: readonly HubEventLinkInput[] | undefined): Pick<HubEvent, "purchaseUrl" | "ticketUrl"> {
  const sorted = (links ?? []).slice().sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || (left.id ?? "").localeCompare(right.id ?? ""));
  return {
    purchaseUrl: sorted.find((link) => link.kind === "purchase" || link.kind === "reservation")?.url,
    ticketUrl: sorted.find((link) => link.kind === "ticket")?.url
  };
}

export function firstScheduleLegacyProjection(links: readonly HubEventLinkInput[] | undefined): Pick<HubEventScheduleItem, "actionUrl" | "sourceUrl" | "sourceLabel"> {
  const sorted = (links ?? []).slice().sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || (left.id ?? "").localeCompare(right.id ?? ""));
  const source = sorted.find((link) => link.kind === "source");
  const action = sorted.find((link) => link.kind !== "source");
  return {
    actionUrl: action?.url,
    sourceUrl: source?.url,
    sourceLabel: source?.label
  };
}
