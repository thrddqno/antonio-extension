import { describe, expect, it } from 'vitest';
import { parseColorsToml } from './colorsToml';
import { DEFAULT_THEME, THEME_KEYS } from './theme';

function validToml(extra = ''): string {
  return `${THEME_KEYS.map((key) => `${key} = "${DEFAULT_THEME[key]}"`).join('\n')}\n${extra}`;
}

describe('parseColorsToml', () => {
  it('parses a complete theme with comments and ignores extra keys', () => {
    const result = parseColorsToml(`# Omarchy\n${validToml('wallpaper = "ignored" # extra')} `);
    expect(result).toEqual({ theme: DEFAULT_THEME, error: null });
  });

  it('rejects missing required keys without returning a partial theme', () => {
    const input = validToml().replace(/color15.*\n/, '');
    expect(parseColorsToml(input)).toEqual({ theme: null, error: 'missing required key: color15' });
  });

  it('rejects duplicate keys', () => {
    expect(parseColorsToml(validToml('accent = "#ffffff"'))).toEqual({ theme: null, error: 'duplicate key: accent' });
  });

  it('rejects invalid colors and malformed syntax', () => {
    expect(parseColorsToml(validToml().replace('#605d5b', 'red'))).toEqual({ theme: null, error: 'invalid color for accent' });
    expect(parseColorsToml(`${validToml()}broken line`).theme).toBeNull();
  });
});
