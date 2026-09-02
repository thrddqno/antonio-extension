import { isHexColor, THEME_KEYS, type OmarchyTheme, type ThemeKey } from './theme';

export type ThemeParseResult = { theme: OmarchyTheme; error: null } | { theme: null; error: string };

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== '\\') {
      quote = quote === character ? null : quote ?? character;
    } else if (character === '#' && quote === null) {
      return line.slice(0, index);
    }
  }
  return line;
}

export function parseColorsToml(input: string): ThemeParseResult {
  const values = new Map<string, string>();

  for (const [index, rawLine] of input.split(/\r?\n/).entries()) {
    const line = stripComment(rawLine).trim();
    if (!line) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(["'])(.*?)\2\s*$/);
    if (!match) {
      return { theme: null, error: `invalid syntax on line ${index + 1}` };
    }

    const key = match[1];
    const value = match[3];
    if (!key || value === undefined) {
      return { theme: null, error: `invalid value on line ${index + 1}` };
    }
    if (values.has(key)) {
      return { theme: null, error: `duplicate key: ${key}` };
    }
    values.set(key, value);
  }

  const theme = {} as OmarchyTheme;
  for (const key of THEME_KEYS) {
    const value = values.get(key);
    if (value === undefined) {
      return { theme: null, error: `missing required key: ${key}` };
    }
    if (!isHexColor(value)) {
      return { theme: null, error: `invalid color for ${key}` };
    }
    theme[key as ThemeKey] = value;
  }
  return { theme, error: null };
}
