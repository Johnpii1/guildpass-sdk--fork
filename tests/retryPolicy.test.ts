import { describe, expect, it } from 'vitest';
import {
  calculateRetryDelayMs,
  classifyHttpStatus,
  classifyRetryErrorCategory,
  parseRetryAfterMs,
  validateRetryPolicyOptions,
  type RetryPolicyOptions,
} from '../src/retry';

const baseOptions: RetryPolicyOptions = {
  maxAttempts: 5,
  initialDelayMs: 100,
  maxDelayMs: 1_000,
  multiplier: 2,
};

describe('retry policy', () => {
  it('calculates the first retry delay from the initial delay', () => {
    expect(calculateRetryDelayMs(1, baseOptions)).toBe(100);
  });

  it('increases later retry delays according to the multiplier', () => {
    expect(calculateRetryDelayMs(2, baseOptions)).toBe(200);
    expect(calculateRetryDelayMs(3, baseOptions)).toBe(400);
  });

  it('caps retry delays at the configured maximum', () => {
    expect(calculateRetryDelayMs(5, baseOptions)).toBe(1_000);
  });

  it('rejects invalid attempt numbers', () => {
    expect(() => calculateRetryDelayMs(0, baseOptions)).toThrow(RangeError);
    expect(() => calculateRetryDelayMs(6, baseOptions)).toThrow(RangeError);
  });

  it('rejects invalid retry configuration', () => {
    expect(() => validateRetryPolicyOptions({ ...baseOptions, maxAttempts: 0 })).toThrow(RangeError);
    expect(() => validateRetryPolicyOptions({ ...baseOptions, initialDelayMs: -1 })).toThrow(
      RangeError,
    );
    expect(() => validateRetryPolicyOptions({ ...baseOptions, maxDelayMs: 50 })).toThrow(RangeError);
    expect(() => validateRetryPolicyOptions({ ...baseOptions, multiplier: 0.5 })).toThrow(RangeError);
    expect(() => validateRetryPolicyOptions({ ...baseOptions, jitterRatio: 1.1 })).toThrow(RangeError);
  });

  it('applies deterministic bounded jitter without exceeding maxDelayMs', () => {
    const jitteredOptions = { ...baseOptions, jitterRatio: 0.25 };

    expect(calculateRetryDelayMs(3, jitteredOptions, () => 0)).toBe(300);
    expect(calculateRetryDelayMs(3, jitteredOptions, () => 0.5)).toBe(400);
    expect(calculateRetryDelayMs(3, jitteredOptions, () => 0.999)).toBeCloseTo(499.8);
    expect(calculateRetryDelayMs(5, jitteredOptions, () => 0.999)).toBe(1_000);
  });

  it('rejects invalid random source values for deterministic jitter', () => {
    expect(() => calculateRetryDelayMs(1, { ...baseOptions, jitterRatio: 0.1 }, () => 1)).toThrow(
      RangeError,
    );
  });

  it('classifies retryable HTTP statuses explicitly', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(classifyHttpStatus(status)).toEqual({ retryable: true, reason: 'retryable_status' });
    }
  });

  it('does not retry permanent client errors by default', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(classifyHttpStatus(status)).toEqual({
        retryable: false,
        reason: 'non_retryable_status',
      });
    }
  });

  it('supports caller overrides for status classification', () => {
    expect(classifyHttpStatus(409, { retryableStatuses: [409] })).toEqual({
      retryable: true,
      reason: 'retryable_status',
    });
    expect(classifyHttpStatus(503, { nonRetryableStatuses: [503] })).toEqual({
      retryable: false,
      reason: 'non_retryable_status',
    });
  });

  it('classifies retryable and permanent error categories', () => {
    expect(classifyRetryErrorCategory('network')).toEqual({
      retryable: true,
      reason: 'retryable_error_category',
    });
    expect(classifyRetryErrorCategory('client_error')).toEqual({
      retryable: false,
      reason: 'non_retryable_error_category',
    });
  });

  it('parses retry-after seconds and HTTP dates into milliseconds', () => {
    const now = new Date('2026-08-30T00:00:00.000Z');

    expect(parseRetryAfterMs('3', now)).toBe(3_000);
    expect(parseRetryAfterMs(2, now)).toBe(2_000);
    expect(parseRetryAfterMs('Sun, 30 Aug 2026 00:00:05 GMT', now)).toBe(5_000);
    expect(parseRetryAfterMs('bad-value', now)).toBeUndefined();
  });
});
