import { isHexColor, THEME_KEYS, type OmarchyTheme, type ThemeKey } from './theme';

export type ThemeParseResult = { theme: OmarchyTheme; error: null } | { theme: null; error: string };

// Omarchy themes use a semantic palette; older themes can still provide ANSI
// color0..color15. Keep parsing, alias resolution and extension mapping apart
// so new Omarchy keys do not require UI changes.
const ANSI_TO_SEMANTIC: Record<string, string> = {
  color0: 'background', color1: 'red', color2: 'green', color3: 'yellow',
  color4: 'blue', color5: 'magenta', color6: 'cyan', color7: 'foreground',
  color8: 'muted', color9: 'bright_red', color10: 'bright_green',
  color11: 'bright_yellow', color12: 'bright_blue', color13: 'bright_magenta',
  color14: 'bright_cyan', color15: 'bright_foreground',
};

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== '\\') quote = quote === character ? null : quote ?? character;
    else if (character === '#' && quote === null) return line.slice(0, index);
  }
  return line;
}

function mix(hex: string, target: string, fraction: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(target.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => Math.round(((a >> shift) & 255) * (1 - fraction) + ((b >> shift) & 255) * fraction));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function generateExtensionTheme(values: Map<string, string>): OmarchyTheme | null {
  const colors = new Map(values);
  for (const [legacy, semantic] of Object.entries(ANSI_TO_SEMANTIC)) {
    if (!colors.has(semantic) && colors.has(legacy)) colors.set(semantic, colors.get(legacy)!);
  }
  // Omarchy's short aliases are common in older/custom themes.
  for (const [alias, key] of Object.entries({ bg: 'background', fg: 'foreground', dark_bg: 'background', darker_bg: 'background', light_fg: 'foreground', dark_fg: 'foreground', bright_fg: 'foreground' })) {
    if (!colors.has(key) && colors.has(alias)) colors.set(key, colors.get(alias)!);
  }
  const required = ['background', 'foreground', 'accent'];
  if (required.some((key) => !isHexColor(colors.get(key)))) return null;
  const background = colors.get('background')!;
  const foreground = colors.get('foreground')!;
  const muted = colors.get('muted') ?? colors.get('dark_foreground') ?? colors.get('color8') ?? mix(foreground, background, 0.45);
  const fallback: Record<string, string> = {
    cursor: colors.get('bright_foreground') ?? foreground,
    selection_foreground: colors.get('selection_foreground') ?? colors.get('bright_foreground') ?? foreground,
    selection_background: colors.get('selection_background') ?? colors.get('selection') ?? muted,
    color0: background, color1: colors.get('red') ?? colors.get('accent')!,
    color2: colors.get('green') ?? colors.get('accent')!, color3: colors.get('yellow') ?? colors.get('accent')!,
    color4: colors.get('blue') ?? colors.get('accent')!, color5: colors.get('magenta') ?? colors.get('accent')!,
    color6: colors.get('cyan') ?? colors.get('accent')!, color7: foreground, color8: muted,
    color9: colors.get('bright_red') ?? colors.get('red') ?? colors.get('accent')!,
    color10: colors.get('bright_green') ?? colors.get('green') ?? colors.get('accent')!,
    color11: colors.get('bright_yellow') ?? colors.get('yellow') ?? colors.get('accent')!,
    color12: colors.get('bright_blue') ?? colors.get('blue') ?? colors.get('accent')!,
    color13: colors.get('bright_magenta') ?? colors.get('magenta') ?? colors.get('accent')!,
    color14: colors.get('bright_cyan') ?? colors.get('cyan') ?? colors.get('accent')!,
    color15: colors.get('bright_foreground') ?? foreground,
  };
  const theme = {} as OmarchyTheme;
  for (const key of THEME_KEYS) {
    const value = colors.get(key) ?? fallback[key];
    if (!isHexColor(value)) return null;
    theme[key as ThemeKey] = value;
  }
  return theme;
}

export function parseColorsToml(input: string): ThemeParseResult {
  if (input.length > 64 * 1024) return { theme: null, error: 'file is larger than 64 KB' };
  const values = new Map<string, string>();
  for (const [index, rawLine] of input.split(/\r?\n/).entries()) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(["'])(.*?)\2\s*$/);
    if (!match) return { theme: null, error: `invalid syntax on line ${index + 1}` };
    const [, key, , value] = match;
    if (values.has(key!)) return { theme: null, error: `duplicate key: ${key}` };
    // Only color-valued keys are inputs to theme generation. Ignore mode and
    // app-specific Omarchy settings, while rejecting malformed recognized colors.
    if (/^(accent|cursor|foreground|background|selection|selection_foreground|selection_background|muted|dark_background|darker_background|lighter_background|dark_foreground|light_foreground|bright_foreground|red|yellow|orange|green|cyan|blue|magenta|brown|bright_(red|yellow|green|cyan|blue|magenta)|color(?:[0-9]|1[0-5]))$/.test(key!)) {
      if (!isHexColor(value)) return { theme: null, error: `invalid color for ${key}` };
      values.set(key!, value!);
    }
  }
  const theme = generateExtensionTheme(values);
  return theme ? { theme, error: null } : { theme: null, error: 'missing required colors: background, foreground, accent' };
}
