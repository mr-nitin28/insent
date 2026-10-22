import { describe, it, expect, vi, beforeEach } from "vitest";
import { linksService } from "@/modules/links/links.service";
import { customUrlProvider } from "@/destinations/custom-url/provider";
import { supabaseAdmin } from "@/lib/supabase";

describe("integration/links", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("crawler bot detection & click tracking", () => {
    it("identifies social preview crawlers correctly", () => {
      expect(linksService.isCrawlerBot("WhatsApp/2.21.12.21 i")).toBe(true);
      expect(linksService.isCrawlerBot("facebookexternalhit/1.1")).toBe(true);
      expect(linksService.isCrawlerBot("Twitterbot/1.0")).toBe(true);
      expect(linksService.isCrawlerBot("LinkedInBot/1.0")).toBe(true);
    });

    it("identifies human mobile/desktop browsers as not bots", () => {
      const chromeMobile = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4) Safari/604.1";
      const chromeDesktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0";
      expect(linksService.isCrawlerBot(chromeMobile)).toBe(false);
      expect(linksService.isCrawlerBot(chromeDesktop)).toBe(false);
    });

    it("does not increment click_count when preview crawler hits tracked link", async () => {
      const mockLink = {
        id: "tl-001",
        workspace_id: "ws-001",
        slug: "abc12345",
        destination_url: "https://anozik.com/portfolio",
        click_count: 5,
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockLink, error: null }),
        }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "tracked_links") {
          return { select: selectMock, update: updateMock } as unknown as ReturnType<
            typeof supabaseAdmin.from
          >;
        }
        if (table === "link_clicks") {
          return { insert: insertMock } as unknown as ReturnType<typeof supabaseAdmin.from>;
        }
        return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
      });

      // Crawler hit (e.g. WhatsApp preview)
      const res = await linksService.recordClickAndResolve(
        "abc12345",
        "WhatsApp/2.21.12.21 i",
        "127.0.0.1",
        null,
      );

      expect(res?.destinationUrl).toBe("https://anozik.com/portfolio");
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ is_bot: true }));
      // CRITICAL: click_count must NOT be updated for bot
      expect(updateMock).not.toHaveBeenCalled();
    });

    it("increments click_count when human visitor hits tracked link", async () => {
      const mockLink = {
        id: "tl-001",
        workspace_id: "ws-001",
        slug: "abc12345",
        destination_url: "https://anozik.com/portfolio",
        click_count: 5,
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockLink, error: null }),
        }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "tracked_links") {
          return { select: selectMock, update: updateMock } as unknown as ReturnType<
            typeof supabaseAdmin.from
          >;
        }
        if (table === "link_clicks") {
          return { insert: insertMock } as unknown as ReturnType<typeof supabaseAdmin.from>;
        }
        return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
      });

      const humanAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0";
      const res = await linksService.recordClickAndResolve(
        "abc12345",
        humanAgent,
        "127.0.0.1",
        null,
      );

      expect(res?.destinationUrl).toBe("https://anozik.com/portfolio");
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ is_bot: false }));
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ click_count: 6 }));
    });
  });

  describe("destination security enforcement", () => {
    it("enforces HTTPS protocol for destination URLs", async () => {
      await expect(
        customUrlProvider.resolve({ providerId: "custom-url", value: "http://insecure-site.com" }),
      ).rejects.toThrow(/HTTPS/i);
    });

    it("rejects public URL shorteners to prevent phishing", async () => {
      await expect(
        customUrlProvider.resolve({ providerId: "custom-url", value: "https://bit.ly/3xyz123" }),
      ).rejects.toThrow(/shortener/i);
    });

    it("resolves valid HTTPS destination URLs", async () => {
      const result = await customUrlProvider.resolve({
        providerId: "custom-url",
        value: "https://myportfolio.com/projects",
      });
      expect(result.url).toBe("https://myportfolio.com/projects");
    });
  });
});
