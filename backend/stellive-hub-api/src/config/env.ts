import z from "zod";

function booleanFlag(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      if (typeof value === "boolean") return value;
      return value.trim().toLowerCase() === "true";
    });
}

function boundedInteger(defaultValue: number, min: number, max: number) {
  return z.coerce.number().int().catch(defaultValue).default(defaultValue)
    .transform((value) => Math.min(max, Math.max(min, value)));
}

function optionalString() {
  return z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    });
}

function optionalUrl() {
  return z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined));
}

function ianaTimeZone(defaultValue: string) {
  return z.string().default(defaultValue).superRefine((value, context) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be a valid IANA time zone",
      });
    }
  });
}

export function isConfiguredSecret(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized !== "verify_required" && !normalized.startsWith("replace_with_");
}

const envSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: optionalString(),
    HUB_EVENTS_STORAGE_MODE: z.enum(["memory", "prisma"]).default("memory"),
    BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
    BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().max(10).default(10),
    BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
    CHANNEL_IMAGE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
    CHANNEL_IMAGE_REFRESH_WAIT_MS: z.coerce.number().int().positive().default(1500),
    ADMIN_OVERVIEW_CACHE_TTL_SECONDS: boundedInteger(15, 0, 60),
    EXTERNAL_API_LOG_RETENTION_DAYS: boundedInteger(31, 14, 365),

    FCM_SERVICE_ACCOUNT_FILE: optionalString(),
    FCM_PROJECT_ID: optionalString(),
    FCM_CLIENT_EMAIL: optionalString(),
    FCM_PRIVATE_KEY: optionalString(),
    FCM_RATE_LIMIT_ENABLED: booleanFlag(true),
    FCM_SEND_MAX_PER_SECOND: boundedInteger(500, 1, 100_000),
    FCM_SEND_MAX_PER_MINUTE: boundedInteger(30_000, 1, 1_000_000),
    FCM_SEND_BURST: boundedInteger(1_000, 1, 100_000),
    NOTIFICATION_DEVICE_BATCH_SIZE: boundedInteger(500, 50, 5_000),
    NOTIFICATION_PREFERENCE_BATCH_SIZE: boundedInteger(500, 50, 5_000),
    DELIVERY_ATTEMPT_BATCH_SIZE: boundedInteger(500, 50, 5_000),

    YOUTUBE_API_KEY: optionalString(),
    YOUTUBE_API_BASE_URL: z.string().url().default("https://www.googleapis.com/youtube/v3"),
    YOUTUBE_WEBSUB_CALLBACK_URL: optionalString(),
    YOUTUBE_WEBSUB_VERIFY_TOKEN: optionalString(),
    YOUTUBE_WEBSUB_ENABLED: booleanFlag(true),
    YOUTUBE_DATA_API_FALLBACK_ENABLED: booleanFlag(false),
    YOUTUBE_SONG_BACKFILL_MAX_PAGES: z.coerce.number().int().positive().default(1),
    YOUTUBE_SONG_RECONCILE_MAX_CHANNELS: z.coerce.number().int().positive().default(10),
    MUSIC_SYNC_ENABLED: booleanFlag(false),
    MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: booleanFlag(false),
    MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
    MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
    MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: z.coerce.number().int().min(0).max(23).default(12),
    MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: z.coerce.number().int().min(1).max(24).default(24),
    MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: ianaTimeZone("Asia/Seoul"),
    MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES: z.coerce.number().int().positive().default(1),
    MUSIC_CHANNEL_DISCOVERY_SCHEDULER_BASE_URL: optionalUrl(),
    MUSIC_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    MUSIC_CACHE_STALE_SECONDS: z.coerce.number().int().positive().default(600),
    MUSIC_CACHE_MAX_ENTRIES: boundedInteger(256, 16, 5_000),
    MUSIC_SYNC_LOCK_SECONDS: z.coerce.number().int().positive().default(30),
  LIGHT_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),
  FULL_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  STELLIVE_MUSIC_COVER_PLAYLIST_ID: z.string().default("PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy"),
  STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID: z.string().default("PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX"),
  DAILY_RECONCILE_CRON: z.string().default("0 4 * * *"),
    MUSIC_LIGHT_SYNC_MAX_PAGES: z.coerce.number().int().positive().default(2),

    NAVER_CLIENT_ID: optionalString(),
    NAVER_CLIENT_SECRET: optionalString(),
    NAVER_CAFE_SEARCH_ENABLED: booleanFlag(false),

    CHZZK_CLIENT_ID: optionalString(),
    CHZZK_CLIENT_SECRET: optionalString(),
    CHZZK_REDIRECT_URI: optionalUrl(),
    CHZZK_OAUTH_SCOPES: optionalString(),
    CHZZK_AUTH_STATE_SECRET: optionalString(),
    CHZZK_ACCESS_TOKEN: optionalString(),
    CHZZK_REFRESH_TOKEN: optionalString(),
    CHZZK_OAUTH_ENABLED: booleanFlag(false),
    CHZZK_TOKEN_REFRESH_SKEW_SECONDS: z.coerce.number().int().positive().default(300),
    CHZZK_LIVE_POLLING_ENABLED: booleanFlag(false),
    CHZZK_LIVE_LIST_MAX_PAGES: z.coerce.number().int().positive().max(100).catch(5).default(5),

    DB_NOTIFICATION_QUEUE_ENABLED: booleanFlag(true),
    FOREGROUND_SSE_ENABLED: booleanFlag(false),

    INTERNAL_API_TOKEN: optionalString(),
    ADMIN_CONSOLE_ENABLED: booleanFlag(false),
    ADMIN_CONSOLE_TOKEN: optionalString(),
    ADMIN_CONSOLE_COOKIE_SECURE: booleanFlag(false)
  })
  .superRefine((env, context) => {
    if (env.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR >= env.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR"],
        message: "must be greater than MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR",
      });
    }
  })
  .transform((env) => ({
    ...env,
    CHZZK_OAUTH_CONFIGURED:
      env.CHZZK_OAUTH_ENABLED &&
      isConfiguredSecret(env.CHZZK_CLIENT_ID) &&
      isConfiguredSecret(env.CHZZK_CLIENT_SECRET) &&
      isConfiguredSecret(env.CHZZK_AUTH_STATE_SECRET) &&
      Boolean(env.CHZZK_REDIRECT_URI)
  }));

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(input: Record<string, unknown> = process.env): AppEnv {
  return envSchema.parse(input);
}

export default loadEnv;
