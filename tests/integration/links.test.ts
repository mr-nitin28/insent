import { describe, it, expect } from "vitest";
import { linksService } from "@/modules/links/links.service";
import { customUrlProvider } from "@/destinations/custom-url/provider";

describe("integration/links", () => {
  describe("crawler bot detection", () => {
    it("identifies social preview crawlers correctly", () => {
      const whatsappBot = "WhatsApp/2.21.12.21 i";
      const facebookBot =
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
      const twitterBot = "Twitterbot/1.0";
      const linkedInBot =
        "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)";

      expect(linksService.isCrawlerBot(whatsappBot)).toBe(true);
      expect(linksService.isCrawlerBot(facebookBot)).toBe(true);
      expect(linksService.isCrawlerBot(twitterBot)).toBe(true);
      expect(linksService.isCrawlerBot(linkedInBot)).toBe(true);
    });

    it("identifies human mobile/desktop browsers as not bots", () => {
      const chromeMobile =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
      const chromeDesktop =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

      expect(linksService.isCrawlerBot(chromeMobile)).toBe(false);
      expect(linksService.isCrawlerBot(chromeDesktop)).toBe(false);
    });
  });

  describe("destination security enforcement", () => {
    it("enforces HTTPS protocol for destination URLs", async () => {
      await expect(
        customUrlProvider.resolve({
          providerId: "custom-url",
          value: "http://insecure-site.com",
        }),
      ).rejects.toThrow(/HTTPS/i);
    });

    it("rejects public URL shorteners to prevent phishing", async () => {
      await expect(
        customUrlProvider.resolve({
          providerId: "custom-url",
          value: "https://bit.ly/3xyz123",
        }),
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
