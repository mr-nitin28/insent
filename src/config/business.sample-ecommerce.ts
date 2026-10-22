/**
 * Sample Alternative Business Configuration: LuxeCart (E-Commerce Store).
 * Demonstrates 100% adaptability without modifying core domain or pipeline code.
 */

import { businessConfigSchema, type BusinessConfig } from "./business.config";

export const ecommerceBusinessConfig: BusinessConfig = businessConfigSchema.parse({
  brand: {
    name: "LuxeCart",
    domain: "luxecart.shop",
    supportEmail: "orders@luxecart.shop",
  },
  channels: {
    enabled: ["instagram"],
    defaultChannel: "instagram",
  },
  destinations: {
    enabled: ["custom-url"],
    defaultProvider: "custom-url",
  },
  templates: {
    defaultCommentDm:
      "Hey @{username}! 🛍️ Here is the direct product checkout link you requested: {link}",
    defaultPublicReply:
      "Sent the product link to your DMs! Check message requests if you don't follow us. ✨",
    disclosureText: "Automated assistance from LuxeCart Customer Experience.",
  },
  limits: {
    hourlyCapPerAccount: 750,
    dailyCapPerRule: 10000,
    maxSendAttempts: 4,
    retentionDays: 14,
    maxMessageLength: 1000,
    maxCommentAgeSeconds: 561600, // 6.5 days
  },
  features: {
    enablePublicReplies: true,
    enableLinkTracking: true,
    enableBotFiltering: true,
    enableDataRetentionCleanup: true,
  },
  plans: {
    starter: {
      name: "Shop Starter",
      maxAccounts: 1,
      maxAutomations: 10,
      monthlyDmCap: 5000,
    },
    growth: {
      name: "Shop Growth",
      maxAccounts: 5,
      maxAutomations: 50,
      monthlyDmCap: 50000,
    },
  },
});
