export const THEME_KEYS = [
  'accent',
  'cursor',
  'foreground',
  'background',
  'selection_foreground',
  'selection_background',
  'color0',
  'color1',
  'color2',
  'color3',
  'color4',
  'color5',
  'color6',
  'color7',
  'color8',
  'color9',
  'color10',
  'color11',
  'color12',
  'color13',
  'color14',
  'color15',
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];
export type OmarchyTheme = Record<ThemeKey, string>;

export const DEFAULT_THEME: OmarchyTheme = {
  accent: '#605d5b',
  cursor: '#a4a4a4',
  foreground: '#a4a4a4',
  background: '#121212',
  selection_foreground: '#121212',
  selection_background: '#a4a4a4',
  color0: '#121212',
  color1: '#e19e74',
  color2: '#a5a297',
  color3: '#c6c4b0',
  color4: '#605d5b',
  color5: '#8a8575',
  color6: '#C2BBB0',
  color7: '#dbd9d3',
  color8: '#383735',
  color9: '#984b1e',
  color10: '#637380',
  color11: '#8f4445',
  color12: '#b7a798',
  color13: '#b3adad',
  color14: '#90947a',
  color15: '#a4a4a4',
};

export const FONT_OPTIONS = ['system', 'jetbrains', 'cascadia', 'ibm-plex', 'custom'] as const;
export type FontOption = (typeof FONT_OPTIONS)[number];

const FONT_STACKS: Record<Exclude<FontOption, 'custom'>, string> = {
  system: 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  jetbrains: '"JetBrains Mono", ui-monospace, monospace',
  cascadia: '"Cascadia Mono", ui-monospace, monospace',
  'ibm-plex': '"IBM Plex Mono", ui-monospace, monospace',
};

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeTheme(value: unknown): OmarchyTheme | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const theme = {} as OmarchyTheme;
  for (const key of THEME_KEYS) {
    if (!isHexColor(record[key])) {
      return null;
    }
    theme[key] = record[key];
  }
  return theme;
}

export function normalizeCustomFont(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const font = value.trim().slice(0, 160);
  const hasUnsafeCharacter = [...font].some((character) => ';{}'.includes(character) || character.charCodeAt(0) < 32);
  return hasUnsafeCharacter ? '' : font;
}

export function fontFamily(option: FontOption, customFont: string): string {
  if (option === 'custom') {
    const custom = normalizeCustomFont(customFont);
    return custom ? `${custom}, ui-monospace, monospace` : FONT_STACKS.system;
  }
  return FONT_STACKS[option];
}

function alpha(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export function applyAppearance(theme: OmarchyTheme, option: FontOption, customFont: string): void {
  const root = document.documentElement;
  const tokens: Record<string, string> = {
    '--background': theme.background,
    '--foreground': theme.foreground,
    '--foreground-strong': theme.color7,
    '--muted': theme.color5,
    '--subtle': theme.accent,
    '--border': theme.color8,
    '--border-hover': theme.accent,
    '--accent': theme.accent,
    '--cursor': theme.cursor,
    '--accent-warm': theme.color1,
    '--selection-background': theme.selection_background,
    '--selection-foreground': theme.selection_foreground,
    '--danger': theme.color9,
    '--surface': alpha(theme.background, 0.82),
    '--surface-low': alpha(theme.color8, 0.18),
    '--surface-hover': alpha(theme.color8, 0.28),
    '--font-family': fontFamily(option, customFont),
  };

  for (let index = 0; index <= 15; index += 1) {
    tokens[`--color-${index}`] = theme[`color${index}` as ThemeKey];
  }
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
  const background = Number.parseInt(theme.background.slice(1), 16);
  const luminance = (((background >> 16) * 299) + (((background >> 8) & 255) * 587) + ((background & 255) * 114)) / 255000;
  root.style.colorScheme = luminance > 0.5 ? 'light' : 'dark';
}
