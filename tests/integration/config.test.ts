import { describe, it, expect } from "vitest";
import { businessConfigSchema } from "@/config/business.config";
import { ecommerceBusinessConfig } from "@/config/business.sample-ecommerce";
import { renderTemplate } from "@/core/templates";
import { evaluateThrottle } from "@/core/throttle";

describe("integration/config adaptability", () => {
  it("validates alternative business configuration against strict schema", () => {
    expect(() => businessConfigSchema.parse(ecommerceBusinessConfig)).not.toThrow();
    expect(ecommerceBusinessConfig.brand.name).toBe("LuxeCart");
    expect(ecommerceBusinessConfig.destinations.defaultProvider).toBe("custom-url");
  });

  it("renders messages using alternative business templates with zero core changes", () => {
    const rendered = renderTemplate(
      ecommerceBusinessConfig.templates.defaultCommentDm,
      {
        username: "shopper_sarah",
        link: "https://luxecart.shop/products/silk-dress",
      },
      ecommerceBusinessConfig.templates.disclosureText,
      ecommerceBusinessConfig.limits.maxMessageLength,
    );

    expect(rendered).toContain("Hey @shopper_sarah! 🛍️");
    expect(rendered).toContain("https://luxecart.shop/products/silk-dress");
    expect(rendered).toContain("Automated assistance from LuxeCart Customer Experience.");
  });

  it("applies business-specific hourly throttling caps", () => {
    // LuxeCart configured hourly cap is 750
    const underCap = evaluateThrottle(700, ecommerceBusinessConfig.limits.hourlyCapPerAccount);
    expect(underCap.action).toBe("send_now");

    const overCap = evaluateThrottle(750, ecommerceBusinessConfig.limits.hourlyCapPerAccount);
    expect(overCap.action).toBe("delay");
  });
});
