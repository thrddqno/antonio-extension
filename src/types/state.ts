export interface Group {
  id: string;
  name: string;
  order: number;
}

export interface Pin {
  id: string;
  label: string;
  url: string;
  categoryId: string;
  order: number;
}

export type SearchEngine = 'google' | 'duckduckgo' | 'brave';

export interface Preferences {
  searchEngine: SearchEngine;
  lockLayoutByDefault: boolean;
  font: FontOption;
  customFont: string;
  importedTheme: OmarchyTheme | null;
}

export interface NewTabState {
  version: 1;
  groups: Group[];
  pins: Pin[];
  preferences: Preferences;
  knownDomainCategories: Record<string, string>;
}

export const UNCATEGORIZED_GROUP_ID = 'uncategorized';
import type { FontOption, OmarchyTheme } from '../theme/theme';
