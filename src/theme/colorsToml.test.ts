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

  it('fills optional terminal colors from semantic theme values', () => {
    const input = validToml().replace(/color15.*\n/, '');
    expect(parseColorsToml(input).theme?.color15).toBe(DEFAULT_THEME.foreground);
  });

  it('rejects themes without the required semantic colors', () => {
    const input = validToml().replace(/accent.*\n/, '');
    expect(parseColorsToml(input)).toEqual({ theme: null, error: 'missing required colors: background, foreground, accent' });
  });

  it('rejects duplicate keys', () => {
    expect(parseColorsToml(validToml('accent = "#ffffff"'))).toEqual({ theme: null, error: 'duplicate key: accent' });
  });

  it('rejects invalid colors and malformed syntax', () => {
    expect(parseColorsToml(validToml().replace('#605d5b', 'red'))).toEqual({ theme: null, error: 'invalid color for accent' });
    expect(parseColorsToml(`${validToml()}broken line`).theme).toBeNull();
  });
});
