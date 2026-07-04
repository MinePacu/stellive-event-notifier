export interface MusicChannelDiscoverySchedule {
  offPeakIntervalMinutes: number;
  peakIntervalMinutes: number;
  peakStartHour: number;
  peakEndHour: number;
  timeZone: string;
}

const minuteMs = 60_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function hourFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function localHour(now: Date, timeZone: string): number {
  const hourPart = hourFormatter(timeZone)
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  if (hourPart === undefined) throw new Error("music_discovery_local_hour_unavailable");
  return Number(hourPart) % 24;
}

export function isMusicDiscoveryPeakTime(
  now: Date,
  schedule: MusicChannelDiscoverySchedule,
): boolean {
  const hour = localHour(now, schedule.timeZone);
  return hour >= schedule.peakStartHour && hour < schedule.peakEndHour;
}

export function msUntilNextMusicDiscovery(
  now: Date,
  schedule: MusicChannelDiscoverySchedule,
): number {
  const peak = isMusicDiscoveryPeakTime(now, schedule);
  const intervalMinutes = peak
    ? schedule.peakIntervalMinutes
    : schedule.offPeakIntervalMinutes;
  const baseDelayMs = intervalMinutes * minuteMs;
  let previousElapsedMs = 0;

  for (
    let elapsedMs = Math.min(minuteMs, baseDelayMs);
    elapsedMs <= baseDelayMs;
    elapsedMs = Math.min(elapsedMs + minuteMs, baseDelayMs)
  ) {
    const candidatePeak = isMusicDiscoveryPeakTime(
      new Date(now.getTime() + elapsedMs),
      schedule,
    );
    if (candidatePeak !== peak) {
      let low = previousElapsedMs;
      let high = elapsedMs;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        const middlePeak = isMusicDiscoveryPeakTime(
          new Date(now.getTime() + middle),
          schedule,
        );
        if (middlePeak === peak) low = middle;
        else high = middle;
      }
      return Math.max(1, high);
    }
    if (elapsedMs === baseDelayMs) break;
    previousElapsedMs = elapsedMs;
  }

  return Math.max(1, baseDelayMs);
}
