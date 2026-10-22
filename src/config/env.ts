import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v22.0"),
  INSTAGRAM_APP_ID: z.string().min(1, "INSTAGRAM_APP_ID is required"),
  INSTAGRAM_APP_SECRET: z.string().min(1, "INSTAGRAM_APP_SECRET is required"),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(1, "INSTAGRAM_WEBHOOK_VERIFY_TOKEN is required"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
    .regex(/^[0-9a-fA-F]+$/, "TOKEN_ENCRYPTION_KEY must be valid hex characters"),
  INTERNAL_CRON_SECRET: z.string().min(8, "INTERNAL_CRON_SECRET must be at least 8 chars").default("local-cron-secret-key-32chars"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("placeholder-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("placeholder-service-role-key"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  // During build / test without full env set, provide test fallbacks if in test environment
  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION ?? "v22.0",
    INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID ?? (process.env.NODE_ENV === "test" ? "test-app-id" : undefined),
    INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET ?? (process.env.NODE_ENV === "test" ? "test-app-secret" : undefined),
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? (process.env.NODE_ENV === "test" ? "test-verify-token" : undefined),
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY ?? (process.env.NODE_ENV === "test" ? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" : undefined),
    INTERNAL_CRON_SECRET: process.env.INTERNAL_CRON_SECRET ?? "local-cron-secret-key-32chars",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key",
  };

  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid Environment Variables:\n${errorDetails}\n\nPlease check your .env or .env.example.\n`
    );
  }
  return result.data;
}

export const env = parseEnv();
