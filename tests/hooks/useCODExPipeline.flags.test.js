import { describe, it, expect } from 'vitest';
import { parseBooleanEnvFlag } from '../../src/hooks/useCODExPipeline.jsx';

describe('parseBooleanEnvFlag', () => {
  it('returns default when flag is missing', () => {
    expect(parseBooleanEnvFlag(undefined, true)).toBe(true);
    expect(parseBooleanEnvFlag(undefined, false)).toBe(false);
    expect(parseBooleanEnvFlag('', true)).toBe(true);
  });

  it('parses true-like values', () => {
    expect(parseBooleanEnvFlag('true', false)).toBe(true);
    expect(parseBooleanEnvFlag('TRUE', false)).toBe(true);
    expect(parseBooleanEnvFlag('1', false)).toBe(true);
    expect(parseBooleanEnvFlag('on', false)).toBe(true);
    expect(parseBooleanEnvFlag('yes', false)).toBe(true);
  });

  it('parses false-like values', () => {
    expect(parseBooleanEnvFlag('false', true)).toBe(false);
    expect(parseBooleanEnvFlag('FALSE', true)).toBe(false);
    expect(parseBooleanEnvFlag('0', true)).toBe(false);
    expect(parseBooleanEnvFlag('off', true)).toBe(false);
    expect(parseBooleanEnvFlag('no', true)).toBe(false);
  });

  it('falls back to default for unknown values', () => {
    expect(parseBooleanEnvFlag('maybe', true)).toBe(true);
    expect(parseBooleanEnvFlag('maybe', false)).toBe(false);
  });
});
