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

    FCM_PROJECT_ID: optionalString(),
    FCM_CLIENT_EMAIL: optionalString(),
    FCM_PRIVATE_KEY: optionalString(),

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
    MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES: z.coerce.number().int().positive().default(1),
    MUSIC_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    MUSIC_CACHE_STALE_SECONDS: z.coerce.number().int().positive().default(600),
    MUSIC_SYNC_LOCK_SECONDS: z.coerce.number().int().positive().default(30),
  LIGHT_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),
  FULL_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  STELLIVE_MUSIC_COVER_PLAYLIST_ID: z.string().default("PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy"),
  STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID: z.string().default("PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX"),
  DAILY_RECONCILE_CRON: z.string().default("0 4 * * *"),
    MUSIC_LIGHT_SYNC_MAX_PAGES: z.coerce.number().int().positive().default(2),

    X_BEARER_TOKEN: optionalString(),
    X_API_COST_POLICY: z.literal("no_paid_api").default("no_paid_api"),
    X_FREE_API_ENABLED: booleanFlag(false),
    X_FREE_STREAM_ENABLED: booleanFlag(false),
    X_FREE_POLLING_ENABLED: booleanFlag(false),

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

    DB_NOTIFICATION_QUEUE_ENABLED: booleanFlag(true),
    FOREGROUND_SSE_ENABLED: booleanFlag(false),

    INTERNAL_API_TOKEN: optionalString(),
    ADMIN_CONSOLE_ENABLED: booleanFlag(false),
    ADMIN_CONSOLE_TOKEN: optionalString(),
    ADMIN_CONSOLE_COOKIE_SECURE: booleanFlag(false)
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
