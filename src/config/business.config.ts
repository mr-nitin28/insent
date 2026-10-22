import { z } from "zod";

export const businessConfigSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
    supportEmail: z.string().email(),
  }),
  channels: z.object({
    enabled: z.array(z.string()).min(1),
    defaultChannel: z.string(),
  }),
  destinations: z.object({
    enabled: z.array(z.string()).min(1),
    defaultProvider: z.string(),
  }),
  templates: z.object({
    defaultCommentDm: z.string(),
    defaultPublicReply: z.string(),
    disclosureText: z.string(),
  }),
  limits: z.object({
    hourlyCapPerAccount: z.number().int().positive().default(600),
    dailyCapPerRule: z.number().int().positive().default(5000),
    maxSendAttempts: z.number().int().positive().default(4),
    retentionDays: z.number().int().positive().default(30),
    maxMessageLength: z.number().int().positive().default(1000),
    maxCommentAgeSeconds: z.number().int().positive().default(561600), // 6.5 days (in seconds)
  }),
  features: z.object({
    enablePublicReplies: z.boolean().default(true),
    enableLinkTracking: z.boolean().default(true),
    enableBotFiltering: z.boolean().default(true),
    enableDataRetentionCleanup: z.boolean().default(true),
  }),
  plans: z
    .record(
      z.object({
        name: z.string(),
        maxAccounts: z.number().int(),
        maxAutomations: z.number().int(),
        monthlyDmCap: z.number().int(),
      }),
    )
    .optional(),
});

export type BusinessConfig = z.infer<typeof businessConfigSchema>;

export const defaultBusinessConfig: BusinessConfig = businessConfigSchema.parse({
  brand: {
    name: "Anozik",
    domain: "anozik.com",
    supportEmail: "support@anozik.com",
  },
  channels: {
    enabled: ["instagram"],
    defaultChannel: "instagram",
  },
  destinations: {
    enabled: ["anozik", "custom-url"],
    defaultProvider: "anozik",
  },
  templates: {
    defaultCommentDm: "Hey @{username}, here is the link you requested: {link}",
    defaultPublicReply: "Sent to your DMs! Check your message requests if you don't follow us. ✨",
    disclosureText: "Automated response via Anozik Social Connect.",
  },
  limits: {
    hourlyCapPerAccount: 600,
    dailyCapPerRule: 5000,
    maxSendAttempts: 4,
    retentionDays: 30,
    maxMessageLength: 1000,
    maxCommentAgeSeconds: 561600, // 6.5 days in seconds
  },
  features: {
    enablePublicReplies: true,
    enableLinkTracking: true,
    enableBotFiltering: true,
    enableDataRetentionCleanup: true,
  },
  plans: {
    creator: {
      name: "Creator",
      maxAccounts: 1,
      maxAutomations: 5,
      monthlyDmCap: 2000,
    },
    pro: {
      name: "Pro",
      maxAccounts: 5,
      maxAutomations: 25,
      monthlyDmCap: 25000,
    },
    agency: {
      name: "Agency",
      maxAccounts: 20,
      maxAutomations: 100,
      monthlyDmCap: 100000,
    },
  },
});

export const businessConfig = defaultBusinessConfig;
