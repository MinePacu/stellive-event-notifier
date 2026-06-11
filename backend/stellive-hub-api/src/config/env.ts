import { z } from "zod";

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

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  YOUTUBE_WEBSUB_CALLBACK_URL: z.string().optional(),
  YOUTUBE_WEBSUB_VERIFY_TOKEN: z.string().optional(),
  YOUTUBE_WEBSUB_ENABLED: booleanFlag(true),
  YOUTUBE_DATA_API_FALLBACK_ENABLED: booleanFlag(false),
  X_BEARER_TOKEN: z.string().optional(),
  X_API_COST_POLICY: z.literal("no_paid_api").default("no_paid_api"),
  X_FREE_API_ENABLED: booleanFlag(false),
  X_FREE_STREAM_ENABLED: booleanFlag(false),
  X_FREE_POLLING_ENABLED: booleanFlag(false),
  NAVER_CLIENT_ID: z.string().optional(),
  NAVER_CLIENT_SECRET: z.string().optional(),
  NAVER_CAFE_SEARCH_ENABLED: booleanFlag(false),
  CHZZK_CLIENT_ID: z.string().optional(),
  CHZZK_CLIENT_SECRET: z.string().optional(),
  CHZZK_ACCESS_TOKEN: z.string().optional(),
  CHZZK_REFRESH_TOKEN: z.string().optional(),
  CHZZK_LIVE_POLLING_ENABLED: booleanFlag(false),
  DB_NOTIFICATION_QUEUE_ENABLED: booleanFlag(true),
  FOREGROUND_SSE_ENABLED: booleanFlag(false),
  INTERNAL_API_TOKEN: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(input: NodeJS.ProcessEnv | Record<string, string | boolean | number | undefined> = process.env): AppEnv {
  return envSchema.parse(input);
}

