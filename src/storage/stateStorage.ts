import { UNCATEGORIZED_GROUP_ID, type Group, type NewTabState, type Pin, type Preferences } from '../types/state';
import { normalizeGroupName, normalizeLabel, normalizePinOrders, sortGroups } from '../utils/pins';
import { normalizeHttpUrl } from '../utils/url';
import { FONT_OPTIONS, normalizeCustomFont, normalizeTheme } from '../theme/theme';
import { createDefaultState, defaultPreferences, STATE_VERSION, STORAGE_KEY } from './defaultState';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePreferences(value: unknown): Preferences {
  if (!isRecord(value)) {
    return defaultPreferences;
  }

  return {
    searchEngine:
      value.searchEngine === 'google' || value.searchEngine === 'duckduckgo' || value.searchEngine === 'brave'
        ? value.searchEngine
        : defaultPreferences.searchEngine,
    lockLayoutByDefault:
      typeof value.lockLayoutByDefault === 'boolean'
        ? value.lockLayoutByDefault
        : defaultPreferences.lockLayoutByDefault,
    font: typeof value.font === 'string' && FONT_OPTIONS.includes(value.font as (typeof FONT_OPTIONS)[number])
      ? value.font as Preferences['font']
      : defaultPreferences.font,
    customFont: normalizeCustomFont(value.customFont),
    importedTheme: value.importedTheme === null || value.importedTheme === undefined
      ? null
      : normalizeTheme(value.importedTheme),
  };
}

function normalizeGroups(value: unknown): Group[] {
  const defaultGroup: Group = { id: UNCATEGORIZED_GROUP_ID, name: 'uncategorized', order: 0 };

  if (!Array.isArray(value)) {
    return [defaultGroup];
  }

  const groups = value.flatMap<Group>((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
      return [];
    }

    const id = item.id.trim();
    const name = normalizeGroupName(item.name);

    if (!id || !name) {
      return [];
    }

    return [{ id, name, order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : index }];
  });

  if (!groups.some((group) => group.id === UNCATEGORIZED_GROUP_ID)) {
    groups.push(defaultGroup);
  }

  const uniqueGroups = new Map<string, Group>();
  for (const group of groups) {
    if (!uniqueGroups.has(group.id)) {
      uniqueGroups.set(group.id, group);
    }
  }

  const sortedGroups = sortGroups([...uniqueGroups.values()]);
  const uncategorized = sortedGroups.find((group) => group.id === UNCATEGORIZED_GROUP_ID) ?? defaultGroup;
  const categorized = sortedGroups.filter((group) => group.id !== UNCATEGORIZED_GROUP_ID);

  return [
    { ...uncategorized, order: 0 },
    ...categorized.map((group, index) => ({ ...group, order: index + 1 })),
  ];
}

function normalizePins(value: unknown, groups: Group[]): Pin[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const groupIds = new Set(groups.map((group) => group.id));

  const pins = value.flatMap<Pin>((item, index) => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.label !== 'string' ||
        typeof item.url !== 'string' ||
        item.url.length > 2048 ||
        typeof item.categoryId !== 'string'
      ) {
        return [];
      }

      const id = item.id.trim();
      const label = normalizeLabel(item.label);
      const url = normalizeHttpUrl(item.url);

      if (!id || !label || !url) {
        return [];
      }

      return [
        {
          id,
          label,
          url,
          categoryId: groupIds.has(item.categoryId) ? item.categoryId : UNCATEGORIZED_GROUP_ID,
          order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : index,
        },
      ];
    });
  const uniquePins = new Map<string, Pin>();
  for (const pin of pins) {
    if (!uniquePins.has(pin.id)) {
      uniquePins.set(pin.id, pin);
    }
  }
  return normalizePinOrders([...uniquePins.values()]);
}

function normalizeKnownDomainCategories(value: unknown, groups: Group[]): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const result: Record<string, string> = {};

  for (const [domain, categoryId] of Object.entries(value)) {
    if (typeof categoryId === 'string' && groupIds.has(categoryId)) {
      const normalizedDomain = domain.trim().replace(/^www\./i, '').toLowerCase();
      if (normalizedDomain) {
        result[normalizedDomain] = categoryId;
      }
    }
  }

  return result;
}

export function normalizeState(value: unknown): NewTabState {
  if (!isRecord(value)) {
    return createDefaultState();
  }

  const groups = normalizeGroups(value.groups);

  return {
    version: STATE_VERSION,
    groups,
    pins: normalizePins(value.pins, groups),
    preferences: normalizePreferences(value.preferences),
    knownDomainCategories: {
      ...createDefaultState().knownDomainCategories,
      ...normalizeKnownDomainCategories(value.knownDomainCategories, groups),
    },
  };
}

export function hasFutureVersion(value: unknown): boolean {
  return isRecord(value) && typeof value.version === 'number' && value.version > STATE_VERSION;
}

function getChromeStorage(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

let pendingWrite: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  pendingWrite = pendingWrite.then(task, task);
  return pendingWrite;
}

export interface LoadResult {
  state: NewTabState;
  isFutureVersion: boolean;
}

export async function loadState(): Promise<LoadResult> {
  const storage = getChromeStorage();

  if (!storage) {
    return { state: createDefaultState(), isFutureVersion: false };
  }

  try {
    const result = await storage.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    return {
      state: normalizeState(raw),
      isFutureVersion: hasFutureVersion(raw),
    };
  } catch {
    return { state: createDefaultState(), isFutureVersion: false };
  }
}

export async function saveState(state: NewTabState, { skipIfFuture = false } = {}): Promise<void> {
  const storage = getChromeStorage();

  if (!storage) {
    return;
  }

  await enqueueWrite(async () => {
    if (skipIfFuture) {
      try {
        const result = await storage.get(STORAGE_KEY);
        if (hasFutureVersion(result[STORAGE_KEY])) {
          return;
        }
      } catch {
        return;
      }
    }

    await storage.set({ [STORAGE_KEY]: normalizeState(state) });
  });
}
