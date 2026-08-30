export interface RetryPolicyOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterRatio?: number;
}

export type RetryRandomSource = () => number;

export type RetryErrorCategory =
  | 'timeout'
  | 'network'
  | 'rate_limit'
  | 'server_error'
  | 'client_error'
  | 'unknown';

export interface RetryClassificationOverrides {
  retryableStatuses?: readonly number[];
  nonRetryableStatuses?: readonly number[];
  retryableErrorCategories?: readonly RetryErrorCategory[];
  nonRetryableErrorCategories?: readonly RetryErrorCategory[];
}

export type RetryDecisionReason =
  | 'retryable_status'
  | 'non_retryable_status'
  | 'retryable_error_category'
  | 'non_retryable_error_category'
  | 'invalid_status'
  | 'unknown_error_category';

export interface RetryDecision {
  retryable: boolean;
  reason: RetryDecisionReason;
}

const DEFAULT_RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_NON_RETRYABLE_ERROR_CATEGORIES = new Set<RetryErrorCategory>([
  'client_error',
  'unknown',
]);
const DEFAULT_RETRYABLE_ERROR_CATEGORIES = new Set<RetryErrorCategory>([
  'timeout',
  'network',
  'rate_limit',
  'server_error',
]);

export function validateRetryPolicyOptions(options: RetryPolicyOptions): RetryPolicyOptions {
  assertPositiveInteger(options.maxAttempts, 'maxAttempts');
  assertFiniteNonNegative(options.initialDelayMs, 'initialDelayMs');
  assertFiniteNonNegative(options.maxDelayMs, 'maxDelayMs');

  if (options.maxDelayMs < options.initialDelayMs) {
    throw new RangeError('maxDelayMs must be greater than or equal to initialDelayMs');
  }

  if (!Number.isFinite(options.multiplier) || options.multiplier < 1) {
    throw new RangeError('multiplier must be a finite number greater than or equal to 1');
  }

  if (options.jitterRatio !== undefined) {
    if (!Number.isFinite(options.jitterRatio) || options.jitterRatio < 0 || options.jitterRatio > 1) {
      throw new RangeError('jitterRatio must be a finite number between 0 and 1');
    }
  }

  return { ...options };
}

export function calculateRetryDelayMs(
  attemptNumber: number,
  options: RetryPolicyOptions,
  randomSource: RetryRandomSource = Math.random,
): number {
  const validOptions = validateRetryPolicyOptions(options);
  assertPositiveInteger(attemptNumber, 'attemptNumber');

  if (attemptNumber > validOptions.maxAttempts) {
    throw new RangeError('attemptNumber must be less than or equal to maxAttempts');
  }

  const exponentialDelay = validOptions.initialDelayMs * validOptions.multiplier ** (attemptNumber - 1);
  const cappedDelay = Math.min(exponentialDelay, validOptions.maxDelayMs);
  const jitterRatio = validOptions.jitterRatio ?? 0;

  if (jitterRatio === 0) {
    return cappedDelay;
  }

  const randomValue = randomSource();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('randomSource must return a finite number in the range [0, 1)');
  }

  const jitterMultiplier = 1 - jitterRatio + randomValue * jitterRatio * 2;
  return Math.min(Math.max(0, cappedDelay * jitterMultiplier), validOptions.maxDelayMs);
}

export function classifyHttpStatus(
  status: number,
  overrides: RetryClassificationOverrides = {},
): RetryDecision {
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return { retryable: false, reason: 'invalid_status' };
  }

  if (overrides.nonRetryableStatuses?.includes(status)) {
    return { retryable: false, reason: 'non_retryable_status' };
  }

  if (overrides.retryableStatuses?.includes(status) || DEFAULT_RETRYABLE_STATUSES.has(status)) {
    return { retryable: true, reason: 'retryable_status' };
  }

  return { retryable: false, reason: 'non_retryable_status' };
}

export function classifyRetryErrorCategory(
  category: RetryErrorCategory,
  overrides: RetryClassificationOverrides = {},
): RetryDecision {
  if (overrides.nonRetryableErrorCategories?.includes(category)) {
    return { retryable: false, reason: 'non_retryable_error_category' };
  }

  if (
    overrides.retryableErrorCategories?.includes(category) ||
    DEFAULT_RETRYABLE_ERROR_CATEGORIES.has(category)
  ) {
    return { retryable: true, reason: 'retryable_error_category' };
  }

  if (DEFAULT_NON_RETRYABLE_ERROR_CATEGORIES.has(category)) {
    return { retryable: false, reason: 'non_retryable_error_category' };
  }

  return { retryable: false, reason: 'unknown_error_category' };
}

export function parseRetryAfterMs(
  retryAfter: string | number | Date | null | undefined,
  now: Date = new Date(),
): number | undefined {
  if (retryAfter === null || retryAfter === undefined) {
    return undefined;
  }

  if (typeof retryAfter === 'number') {
    return retryAfter >= 0 && Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined;
  }

  if (retryAfter instanceof Date) {
    const delayMs = retryAfter.getTime() - now.getTime();
    return Number.isFinite(delayMs) ? Math.max(0, delayMs) : undefined;
  }

  const trimmed = retryAfter.trim();
  if (trimmed === '') {
    return undefined;
  }

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryDateMs = Date.parse(trimmed);
  if (Number.isNaN(retryDateMs)) {
    return undefined;
  }

  return Math.max(0, retryDateMs - now.getTime());
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}
