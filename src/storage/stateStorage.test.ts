import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED_GROUP_ID } from '../types/state';
import { normalizeState, hasFutureVersion } from './stateStorage';

describe('normalizeState', () => {
  it('falls back to safe defaults for malformed state', () => {
    const state = normalizeState({ version: 1, groups: 'bad', pins: [{ url: 'javascript:alert(1)' }] });

    expect(state.groups).toEqual([{ id: UNCATEGORIZED_GROUP_ID, name: 'uncategorized', order: 0 }]);
    expect(state.pins).toEqual([]);
    expect(state.preferences.lockLayoutByDefault).toBe(true);
  });

  it('normalizes labels and moves pins with missing groups to uncategorized', () => {
    const state = normalizeState({
      version: 1,
      groups: [{ id: 'development', name: 'Development', order: 1 }],
      pins: [{ id: 'pin-1', label: ' GitHub ', url: 'github.com', categoryId: 'missing', order: 4 }],
      preferences: {},
      knownDomainCategories: {},
    });

    expect(state.pins[0]).toMatchObject({
      label: 'github',
      url: 'https://github.com/',
      categoryId: UNCATEGORIZED_GROUP_ID,
    });
  });

  it('preserves Prompt 01 state while removing obsolete weather preferences', () => {
    const state = normalizeState({
      version: 1,
      groups: [{ id: 'work', name: 'work', order: 1 }],
      pins: [],
      preferences: {
        lockLayoutByDefault: false,
        weatherLocation: 'legacy',
        weatherUnits: 'fahrenheit',
      },
      knownDomainCategories: {},
    });

    expect(state.preferences).toEqual({
      lockLayoutByDefault: false,
      font: 'system',
      customFont: '',
      importedTheme: null,
    });
  });

  it('preserves valid Prompt 04 preferences and defaults invalid additions', () => {
    const state = normalizeState({
      version: 1,
      groups: [],
      pins: [],
      preferences: {
        lockLayoutByDefault: true,
        font: 'custom',
        customFont: 'Iosevka',
        importedTheme: null,
      },
      knownDomainCategories: {},
    });

    expect(state.preferences).toMatchObject({ font: 'custom', customFont: 'Iosevka' });
  });

  it('deduplicates persisted pin IDs to keep drag identity stable', () => {
    const state = normalizeState({
      version: 1,
      groups: [{ id: 'uncategorized', name: 'uncategorized', order: 0 }],
      pins: [
        { id: 'same', label: 'first', url: 'first.test', categoryId: 'uncategorized', order: 0 },
        { id: 'same', label: 'second', url: 'second.test', categoryId: 'uncategorized', order: 1 },
      ],
      preferences: {},
      knownDomainCategories: {},
    });

    expect(state.pins).toHaveLength(1);
    expect(state.pins[0]?.label).toBe('first');
  });

  it('migrates unversioned records to current version', () => {
    const state = normalizeState({
      groups: [{ id: 'dev', name: 'dev', order: 0 }],
      pins: [{ id: 'pin-1', label: 'test', url: 'https://test.com', categoryId: 'dev', order: 0 }],
    });

    expect(state.version).toBe(1);
    expect(state.groups).toHaveLength(2);
    expect(state.groups[1]?.id).toBe('dev');
    expect(state.pins[0]?.label).toBe('test');
  });

  it('normalizes future-version records to current version without crashing', () => {
    const state = normalizeState({
      version: 99,
      groups: [{ id: 'work', name: 'work', order: 0 }],
      pins: [],
      preferences: {},
      knownDomainCategories: {},
    });

    expect(state.version).toBe(1);
    expect(state.groups[1]?.id).toBe('work');
  });
});

describe('hasFutureVersion', () => {
  it('returns false for null', () => {
    expect(hasFutureVersion(null)).toBe(false);
  });

  it('returns false for current version', () => {
    expect(hasFutureVersion({ version: 1 })).toBe(false);
  });

  it('returns false for unversioned records', () => {
    expect(hasFutureVersion({ groups: [] })).toBe(false);
  });

  it('returns true for future version', () => {
    expect(hasFutureVersion({ version: 2 })).toBe(true);
    expect(hasFutureVersion({ version: 99 })).toBe(true);
  });
});
