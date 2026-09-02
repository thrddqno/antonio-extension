import { UNCATEGORIZED_GROUP_ID, type Group, type Pin } from '../types/state';

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().slice(0, 80);
}

export function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase().slice(0, 60);
}

export function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

export function sortPins(pins: Pin[]): Pin[] {
  return [...pins].sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

export function nextOrder(items: Array<{ order: number }>): number {
  return items.reduce((highest, item) => (Number.isFinite(item.order) ? Math.max(highest, item.order) : highest), -1) + 1;
}

export function normalizePinOrders(pins: Pin[]): Pin[] {
  const pinsByCategory = new Map<string, Pin[]>();

  for (const pin of pins) {
    const categoryPins = pinsByCategory.get(pin.categoryId) ?? [];
    categoryPins.push(pin);
    pinsByCategory.set(pin.categoryId, categoryPins);
  }

  const orderById = new Map<string, number>();
  for (const categoryPins of pinsByCategory.values()) {
    sortPins(categoryPins).forEach((pin, index) => orderById.set(pin.id, index));
  }

  return pins.map((pin) => ({ ...pin, order: orderById.get(pin.id) ?? 0 }));
}

export function reorderPinsWithinCategory(pins: Pin[], categoryId: string, activeId: string, overId: string): Pin[] {
  const categoryPins = sortPins(pins.filter((pin) => pin.categoryId === categoryId));
  const activeIndex = categoryPins.findIndex((pin) => pin.id === activeId);
  const overIndex = categoryPins.findIndex((pin) => pin.id === overId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return pins;
  }

  const reordered = [...categoryPins];
  const [activePin] = reordered.splice(activeIndex, 1);

  if (!activePin) {
    return pins;
  }

  reordered.splice(overIndex, 0, activePin);
  const orderById = new Map(reordered.map((pin, index) => [pin.id, index]));

  return pins.map((pin) =>
    pin.categoryId === categoryId ? { ...pin, order: orderById.get(pin.id) ?? pin.order } : pin,
  );
}

export function reorderGroups(groups: Group[], activeId: string, overId: string): Group[] {
  const categorizedGroups = sortGroups(groups.filter((group) => group.id !== UNCATEGORIZED_GROUP_ID));
  const activeIndex = categorizedGroups.findIndex((group) => group.id === activeId);
  const overIndex = categorizedGroups.findIndex((group) => group.id === overId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return groups;
  }

  const reordered = [...categorizedGroups];
  const [activeGroup] = reordered.splice(activeIndex, 1);

  if (!activeGroup) {
    return groups;
  }

  reordered.splice(overIndex, 0, activeGroup);
  const orderById = new Map(reordered.map((group, index) => [group.id, index + 1]));

  return groups.map((group) =>
    group.id === UNCATEGORIZED_GROUP_ID
      ? { ...group, order: 0 }
      : { ...group, order: orderById.get(group.id) ?? group.order },
  );
}
