/**
 * Pure core domain error definitions and classification types.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot transition automation run status from '${from}' to '${to}'`);
    this.name = "InvalidStateTransitionError";
  }
}

export class UnknownVariableError extends DomainError {
  constructor(public readonly variableName: string) {
    super(`Unknown template variable '{${variableName}}' is not permitted`);
    this.name = "UnknownVariableError";
  }
}

export class TemplateTooLongError extends DomainError {
  constructor(public readonly length: number, public readonly maxLength: number) {
    super(`Rendered template length (${length}) exceeds maximum allowed length (${maxLength})`);
    this.name = "TemplateTooLongError";
  }
}

export class RuleOverlapError extends DomainError {
  constructor(public readonly keyword: string, public readonly postScope: string | null) {
    super(
      `Rule overlap detected for keyword '${keyword}' on post scope '${postScope ?? "ALL_POSTS"}'`
    );
    this.name = "RuleOverlapError";
  }
}

export class DeliveryUnconfirmedError extends DomainError {
  constructor(message: string) {
    super(`Delivery outcome unconfirmed; automatic retries halted: ${message}`);
    this.name = "DeliveryUnconfirmedError";
  }
}
