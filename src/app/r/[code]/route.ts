/**
 * Tracked Short Link Redirector.
 * Filters preview crawlers, records analytics, and redirects visitors to destination.
 */

import { NextResponse } from "next/server";
import { linksService } from "@/modules/links/links.service";
import { businessConfig } from "@/config/business.config";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const userAgent = req.headers.get("user-agent");
  const referrer = req.headers.get("referer");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const result = await linksService.recordClickAndResolve(code, userAgent, ip, referrer);

  if (!result) {
    const fallbackUrl = `https://${businessConfig.brand.domain}`;
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }

  return NextResponse.redirect(result.destinationUrl, { status: 302 });
}
