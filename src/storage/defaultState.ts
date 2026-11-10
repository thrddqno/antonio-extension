import { UNCATEGORIZED_GROUP_ID, type NewTabState, type Preferences } from '../types/state';

export const STATE_VERSION = 1;
export const STORAGE_KEY = 'newTabState';

export const defaultPreferences: Preferences = {
  lockLayoutByDefault: true,
  font: 'system',
  customFont: '',
  importedTheme: null,
};

export const builtInDomainCategories: Record<string, string> = {};

export function createDefaultState(): NewTabState {
  return {
    version: STATE_VERSION,
    groups: [{ id: UNCATEGORIZED_GROUP_ID, name: 'uncategorized', order: 0 }],
    pins: [],
    preferences: defaultPreferences,
    knownDomainCategories: builtInDomainCategories,
  };
}
