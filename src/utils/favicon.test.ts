import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { faviconRequestUrl, getImageType } from './favicon';

beforeEach(() => {
  (globalThis as Record<string, unknown>)['chrome'] = {
    runtime: { getURL: (path: string) => `chrome-extension://testid${path}` },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['chrome'];
});

describe('getImageType', () => {
  it('detects png magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(getImageType(bytes)).toBe('image/png');
  });

  it('detects jpeg magic bytes', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
    expect(getImageType(bytes)).toBe('image/jpeg');
  });

  it('detects gif magic bytes', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(getImageType(bytes)).toBe('image/gif');
  });

  it('rejects non-image data', () => {
    const bytes = new Uint8Array([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3e]);
    expect(getImageType(bytes)).toBeNull();
  });

  it('rejects empty data', () => {
    expect(getImageType(new Uint8Array(0))).toBeNull();
  });
});

describe('faviconRequestUrl', () => {
  it('builds a Chrome _favicon URL for a normalized pageUrl', () => {
    const url = faviconRequestUrl('github.com/user/repo');
    expect(url).toBe('chrome-extension://testid/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2Fuser%2Frepo&size=32');
  });

  it('returns null for an invalid URL', () => {
    expect(faviconRequestUrl('not a url')).toBeNull();
  });

  it('returns null for a non-http(s) scheme', () => {
    expect(faviconRequestUrl('javascript:alert(1)')).toBeNull();
  });
});
