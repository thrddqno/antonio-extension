import { describe, expect, it } from 'vitest';
import { getDomain, normalizeHttpUrl } from './url';

describe('url utilities', () => {
  it('normalizes hostnames to https URLs', () => {
    expect(normalizeHttpUrl('github.com')).toBe('https://github.com/');
  });

  it('rejects unsafe protocols', () => {
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
  });

  it('extracts normalized domains', () => {
    expect(getDomain('https://www.github.com/foo')).toBe('github.com');
  });
});
