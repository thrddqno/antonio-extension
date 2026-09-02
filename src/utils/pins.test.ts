import { describe, expect, it } from 'vitest';
import { normalizeGroupName, normalizeLabel, normalizePinOrders, reorderGroups, reorderPinsWithinCategory, sortGroups, sortPins } from './pins';

describe('pin utilities', () => {
  it('normalizes labels to lowercase', () => {
    expect(normalizeLabel(' GitHub ')).toBe('github');
  });

  it('bounds long pin and group labels', () => {
    expect(normalizeLabel('A'.repeat(100))).toHaveLength(80);
    expect(normalizeGroupName('B'.repeat(100))).toHaveLength(60);
  });

  it('sorts groups and pins by order', () => {
    expect(sortGroups([{ id: 'b', name: 'b', order: 2 }, { id: 'a', name: 'a', order: 1 }])[0]?.id).toBe('a');
    expect(sortPins([{ id: 'b', label: 'b', url: 'https://b.test', categoryId: 'x', order: 2 }, { id: 'a', label: 'a', url: 'https://a.test', categoryId: 'x', order: 1 }])[0]?.id).toBe('a');
  });

  it('normalizes pin order independently in each category', () => {
    const pins = normalizePinOrders([
      { id: 'a-2', label: 'second', url: 'https://a.test/2', categoryId: 'a', order: 8 },
      { id: 'b-1', label: 'first', url: 'https://b.test/1', categoryId: 'b', order: Number.NaN },
      { id: 'a-1', label: 'first', url: 'https://a.test/1', categoryId: 'a', order: 2 },
    ]);

    expect(pins.find((pin) => pin.id === 'a-1')?.order).toBe(0);
    expect(pins.find((pin) => pin.id === 'a-2')?.order).toBe(1);
    expect(pins.find((pin) => pin.id === 'b-1')?.order).toBe(0);
  });

  it('reorders pins only inside the requested category', () => {
    const pins = [
      { id: 'a-1', label: 'one', url: 'https://a.test/1', categoryId: 'a', order: 0 },
      { id: 'a-2', label: 'two', url: 'https://a.test/2', categoryId: 'a', order: 1 },
      { id: 'b-1', label: 'other', url: 'https://b.test', categoryId: 'b', order: 0 },
    ];

    const reordered = reorderPinsWithinCategory(pins, 'a', 'a-2', 'a-1');
    expect(sortPins(reordered.filter((pin) => pin.categoryId === 'a')).map((pin) => pin.id)).toEqual(['a-2', 'a-1']);
    expect(reorderPinsWithinCategory(pins, 'a', 'a-1', 'b-1')).toBe(pins);
  });

  it('reorders visible groups while keeping uncategorized first', () => {
    const groups = [
      { id: 'uncategorized', name: 'uncategorized', order: 0 },
      { id: 'development', name: 'development', order: 1 },
      { id: 'work', name: 'work', order: 2 },
    ];

    const reordered = reorderGroups(groups, 'work', 'development');
    expect(sortGroups(reordered).map((group) => group.id)).toEqual(['uncategorized', 'work', 'development']);
  });
});
