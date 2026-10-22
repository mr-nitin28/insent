/**
 * Instagram OAuth Connect Initiation Endpoint.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { instagramAdapter } from "@/channels/instagram/adapter";

export const runtime = "nodejs";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const authUrl = instagramAdapter.connectUrl(state);
  return NextResponse.redirect(authUrl);
}
