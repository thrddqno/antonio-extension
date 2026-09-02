import { describe, expect, it } from 'vitest';
import { createSearchTarget, getDomain, normalizeHttpUrl } from './url';

describe('url utilities', () => {
  it('normalizes hostnames to https URLs', () => {
    expect(normalizeHttpUrl('github.com')).toBe('https://github.com/');
  });

  it('rejects unsafe protocols', () => {
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
  });

  it('creates search targets for normal text', () => {
    expect(createSearchTarget('spring boot transactions')).toBe(
      'https://www.google.com/search?q=spring%20boot%20transactions',
    );
  });

  it('creates DuckDuckGo and Brave Search targets', () => {
    expect(createSearchTarget('privacy search', 'duckduckgo')).toBe('https://duckduckgo.com/?q=privacy%20search');
    expect(createSearchTarget('privacy search', 'brave')).toBe('https://search.brave.com/search?q=privacy%20search');
  });

  it('keeps direct navigation independent of the search engine', () => {
    expect(createSearchTarget('github.com', 'brave')).toBe('https://github.com/');
  });

  it('creates direct targets for hostnames', () => {
    expect(createSearchTarget('github.com')).toBe('https://github.com/');
  });

  it('extracts normalized domains', () => {
    expect(getDomain('https://www.github.com/foo')).toBe('github.com');
  });
});
