import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, fontFamily, normalizeCustomFont, normalizeTheme } from './theme';

describe('theme normalization', () => {
  it('accepts a complete valid theme and rejects partial themes', () => {
    expect(normalizeTheme(DEFAULT_THEME)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme({ accent: '#ffffff' })).toBeNull();
  });

  it('sanitizes custom font-family values and retains a monospace fallback', () => {
    expect(normalizeCustomFont('  Iosevka  ')).toBe('Iosevka');
    expect(normalizeCustomFont('bad; color: red')).toBe('');
    expect(fontFamily('custom', 'Iosevka')).toBe('Iosevka, ui-monospace, monospace');
    expect(fontFamily('custom', '')).toContain('ui-monospace');
  });
});
