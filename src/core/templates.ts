/**
 * Pure core message template rendering and safety enforcement.
 */

import { UnknownVariableError, TemplateTooLongError } from "./errors";

export const ALLOWED_TEMPLATE_VARIABLES = [
  "username",
  "link",
  "post_id",
  "account_username",
] as const;

export type TemplateVariable = (typeof ALLOWED_TEMPLATE_VARIABLES)[number];

export interface RenderContext {
  readonly username?: string;
  readonly link?: string;
  readonly post_id?: string;
  readonly account_username?: string;
}

/**
 * Renders a message template safely:
 * - Substitutes safe variables ({username}, {link}, etc.)
 * - Throws UnknownVariableError on any unauthorized {variable}
 * - Appends the business disclosure line
 * - Throws TemplateTooLongError if exceeding maxLength
 */
export function renderTemplate(
  template: string,
  context: RenderContext,
  disclosureText?: string,
  maxLength = 1000,
): string {
  // Check for unauthorized variable patterns
  const variableRegex = /\{([a-zA-Z0-9_]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = variableRegex.exec(template)) !== null) {
    const varName = match[1];
    if (varName && !ALLOWED_TEMPLATE_VARIABLES.includes(varName as TemplateVariable)) {
      throw new UnknownVariableError(varName);
    }
  }

  // Replace recognized variables
  let rendered = template.replace(variableRegex, (_, varName: string) => {
    const val = context[varName as TemplateVariable];
    return val !== undefined && val !== null ? String(val) : "";
  });

  // Append disclosure line if present
  if (disclosureText && disclosureText.trim().length > 0) {
    rendered = `${rendered.trim()}\n\n${disclosureText.trim()}`;
  }

  const finalLength = rendered.length;
  if (finalLength > maxLength) {
    throw new TemplateTooLongError(finalLength, maxLength);
  }

  return rendered;
}
