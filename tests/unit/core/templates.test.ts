import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/core/templates";
import { UnknownVariableError, TemplateTooLongError } from "@/core/errors";

describe("core/templates", () => {
  it("substitutes authorized variables correctly", () => {
    const template = "Hey @{username}, here is your link: {link} for post {post_id}!";
    const context = {
      username: "creator_jane",
      link: "https://anozik.com/r/xyz123",
      post_id: "media_987",
    };
    const rendered = renderTemplate(template, context, "Automated reply");

    expect(rendered).toContain("Hey @creator_jane, here is your link: https://anozik.com/r/xyz123");
    expect(rendered).toContain("Automated reply");
  });

  it("rejects unauthorized variables and throws UnknownVariableError", () => {
    const template = "Hey @{username}, your secret key is {secret_key}";
    expect(() => renderTemplate(template, { username: "alice" }, "Disclosure")).toThrow(
      UnknownVariableError,
    );
  });

  it("appends disclosure text cleanly", () => {
    const template = "Check this out: {link}";
    const rendered = renderTemplate(
      template,
      { link: "https://anozik.com" },
      "Sent via Anozik Social Connect",
    );
    expect(rendered.endsWith("Sent via Anozik Social Connect")).toBe(true);
  });

  it("throws TemplateTooLongError when rendered text exceeds limit", () => {
    const longTemplate = "A".repeat(100);
    expect(() => renderTemplate(longTemplate, {}, "Disclosure", 50)).toThrow(TemplateTooLongError);
  });
});
