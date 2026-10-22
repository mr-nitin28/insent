/**
 * Zod validation schemas for incoming Instagram webhook payloads.
 */

import { z } from "zod";

export const instagramWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number().optional(),
      changes: z
        .array(
          z.object({
            field: z.string(),
            value: z.object({
              id: z.string(),
              text: z.string().optional().default(""),
              from: z
                .object({
                  id: z.string(),
                  username: z.string(),
                })
                .optional(),
              media: z
                .object({
                  id: z.string(),
                })
                .optional(),
              parent_id: z.string().optional(),
              created_time: z.number().optional(),
            }),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
});

export type InstagramWebhookPayload = z.infer<typeof instagramWebhookSchema>;
