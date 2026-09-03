import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UNCATEGORIZED_GROUP_ID, type Group, type Pin } from '../../types/state';
import { sortGroups, sortPins } from '../../utils/pins';
import { useFavicon } from './useFavicon';

interface PinSectionsProps {
  groups: Group[];
  pins: Pin[];
  isEditing: boolean;
  onAddPin: (categoryId?: string) => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (group: Group) => void;
  onEditPin: (pin: Pin) => void;
  onMovePin: (pin: Pin) => void;
  onDeletePin: (pin: Pin) => void;
  onReorderPins: (categoryId: string, activeId: string, overId: string) => void;
  onReorderGroups: (activeId: string, overId: string) => void;
}

interface PinListProps {
  categoryId: string;
  pins: Pin[];
  isEditing: boolean;
  activePinMenuId: string | null;
  onToggleMenu: (pinId: string) => void;
  onEditPin: (pin: Pin) => void;
  onMovePin: (pin: Pin) => void;
  onDeletePin: (pin: Pin) => void;
  onReorder: (categoryId: string, activeId: string, overId: string) => void;
}

function pinFallback(label: string): string {
  return label.slice(0, 1) || '•';
}

function FaviconSlot({ url, label }: { url: string; label: string }) {
  const faviconUrl = useFavicon(url);

  if (faviconUrl) {
    return <img className="size-3.5 shrink-0 object-contain opacity-80" src={faviconUrl} alt="" aria-hidden="true" />;
  }

  return <span className="grid size-3.5 shrink-0 place-items-center rounded-[2px] bg-[var(--border)] text-[9px] text-[var(--foreground-strong)] opacity-70" aria-hidden="true">{pinFallback(label)}</span>;
}

const pinCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

function PinList({ categoryId, pins, isEditing, activePinMenuId, onToggleMenu, onEditPin, onMovePin, onDeletePin, onReorder }: PinListProps) {
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, keyboardSensor);
  const sortedPins = sortPins(pins);

  function handleDragEnd(event: DragEndEvent) {
    if (!isEditing || !event.over || event.active.id === event.over.id) {
      return;
    }

    onReorder(categoryId, String(event.active.id), String(event.over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pinCollisionDetection} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedPins.map((pin) => pin.id)} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap justify-center gap-2" data-pin-category={categoryId}>
          {sortedPins.map((pin) => (
            <SortablePin
              key={pin.id}
              pin={pin}
              isEditing={isEditing}
              isMenuOpen={activePinMenuId === pin.id}
              onToggleMenu={onToggleMenu}
              onEditPin={onEditPin}
              onMovePin={onMovePin}
              onDeletePin={onDeletePin}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortablePinProps {
  pin: Pin;
  isEditing: boolean;
  isMenuOpen: boolean;
  onToggleMenu: (pinId: string) => void;
  onEditPin: (pin: Pin) => void;
  onMovePin: (pin: Pin) => void;
  onDeletePin: (pin: Pin) => void;
}

function SortablePin({ pin, isEditing, isMenuOpen, onToggleMenu, onEditPin, onMovePin, onDeletePin }: SortablePinProps) {
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: pin.id,
    disabled: !isEditing,
    data: { type: 'pin', categoryId: pin.categoryId },
    transition: { duration: 150, easing: 'ease' },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const pinClassName = `inline-flex max-w-60 items-center gap-1.5 rounded-[4px] border bg-[var(--surface-low)] px-2.5 py-1.5 text-xs text-[var(--foreground)] transition-[border-color,background-color,opacity,transform] duration-150 ${
    isDragging
      ? 'cursor-grabbing border-[var(--border-hover)] opacity-55'
      : isEditing
        ? 'cursor-grab border-[var(--border-hover)] hover:bg-[var(--surface-hover)]'
        : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground-strong)]'
  }`;
  const content = (
    <>
      <FaviconSlot url={pin.url} label={pin.label} />
      <span className="min-w-0 truncate" title={pin.label}>{pin.label}</span>
    </>
  );

  useEffect(() => {
    if (isMenuOpen) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [isMenuOpen]);

  return (
    <div ref={setNodeRef} style={style} className="group/pin relative inline-flex" data-pin-id={pin.id}>
      {isEditing ? (
        <button ref={setActivatorNodeRef} className={pinClassName} type="button" {...attributes} {...listeners}>
          {content}
        </button>
      ) : (
        <a href={pin.url} className={pinClassName}>
          {content}
        </a>
      )}

      {isEditing ? (
        <button
          ref={actionButtonRef}
          className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[8px] leading-none tracking-[-0.14em] text-[var(--foreground)] opacity-0 transition-opacity duration-150 hover:border-[var(--border-hover)] hover:opacity-100 focus-visible:opacity-100 group-hover/pin:opacity-70"
          type="button"
          aria-label={`Actions for ${pin.label}`}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu(pin.id);
          }}
        >
          ...
        </button>
      ) : null}

      {isEditing && isMenuOpen ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-5 z-30 min-w-20 rounded-[4px] border border-[var(--border)] bg-[var(--background)] p-1 text-[10px]"
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onToggleMenu(pin.id);
              actionButtonRef.current?.focus();
            }
          }}
        >
          <button
            className="block w-full px-2 py-1.5 text-left text-[var(--foreground)] hover:text-[var(--foreground-strong)]"
            type="button"
            role="menuitem"
            aria-label={`Edit ${pin.label}`}
            onClick={() => {
              onToggleMenu(pin.id);
              actionButtonRef.current?.focus();
              onEditPin(pin);
            }}
          >
            edit
          </button>
          <button
            className="block w-full px-2 py-1.5 text-left text-[var(--foreground)] hover:text-[var(--foreground-strong)]"
            type="button"
            role="menuitem"
            aria-label={`Move ${pin.label}`}
            onClick={() => {
              onToggleMenu(pin.id);
              actionButtonRef.current?.focus();
              onMovePin(pin);
            }}
          >
            move
          </button>
          <button
            className="block w-full px-2 py-1.5 text-left text-[var(--foreground)] hover:text-[var(--accent-warm)]"
            type="button"
            role="menuitem"
            aria-label={`Delete ${pin.label}`}
            onClick={() => {
              onToggleMenu(pin.id);
              actionButtonRef.current?.focus();
              onDeletePin(pin);
            }}
          >
            delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface SortableGroupProps {
  group: Group;
  pins: Pin[];
  isEditing: boolean;
  activePinMenuId: string | null;
  onToggleMenu: (pinId: string) => void;
  onAddPin: (categoryId?: string) => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (group: Group) => void;
  onEditPin: (pin: Pin) => void;
  onMovePin: (pin: Pin) => void;
  onDeletePin: (pin: Pin) => void;
  onReorderPins: (categoryId: string, activeId: string, overId: string) => void;
}

function SortableGroup({ group, pins, isEditing, activePinMenuId, onToggleMenu, onAddPin, onEditGroup, onDeleteGroup, onEditPin, onMovePin, onDeletePin, onReorderPins }: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !isEditing,
    data: { type: 'group' },
    transition: { duration: 150, easing: 'ease' },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <section ref={setNodeRef} style={style} aria-labelledby={`group-${group.id}`} className={`group/category relative ${isDragging ? 'opacity-55' : ''}`} data-group-id={group.id}>
      <div className="mb-4 flex items-center gap-3">
        <h3 id={`group-${group.id}`} className={`min-w-0 max-w-48 truncate text-[10px] uppercase tracking-[0.26em] text-[var(--foreground)] ${isEditing ? 'opacity-70' : 'opacity-55'}`} title={group.name}>
          {group.name}
        </h3>
        <span className="h-px flex-1 bg-[var(--border)] opacity-30" />
        {isEditing ? (
          <>
            <button className="shrink-0 text-[10px] text-[var(--foreground)] opacity-40 transition-opacity duration-150 hover:opacity-90 focus-visible:opacity-90" type="button" aria-label={`Add pin to ${group.name}`} onClick={() => onAddPin(group.id)}>
              add +
            </button>
            <button
              ref={setActivatorNodeRef}
              className="cursor-grab px-1 text-[10px] tracking-[-0.2em] text-[var(--foreground)] opacity-35 hover:opacity-80 focus-visible:opacity-80 active:cursor-grabbing"
              type="button"
              aria-label={`Drag ${group.name} group`}
              {...attributes}
              {...listeners}
            >
              ::
            </button>
            <button className="shrink-0 text-[10px] text-[var(--foreground)] opacity-25 transition-opacity duration-150 hover:opacity-80 focus-visible:opacity-80 group-hover/category:opacity-50" type="button" aria-label={`Edit ${group.name} group`} onClick={() => onEditGroup(group)}>
              edit
            </button>
            <button className="shrink-0 text-[10px] text-[var(--foreground)] opacity-20 transition-opacity duration-150 hover:text-[var(--accent-warm)] hover:opacity-80 focus-visible:opacity-80 group-hover/category:opacity-45" type="button" aria-label={`Delete ${group.name} group`} onClick={() => onDeleteGroup(group)}>
              delete
            </button>
          </>
        ) : null}
      </div>

      {pins.length > 0 ? (
        <PinList
          categoryId={group.id}
          pins={pins}
          isEditing={isEditing}
          activePinMenuId={activePinMenuId}
          onToggleMenu={onToggleMenu}
          onEditPin={onEditPin}
          onMovePin={onMovePin}
          onDeletePin={onDeletePin}
          onReorder={onReorderPins}
        />
      ) : (
        <p className="text-xs text-[var(--foreground)] opacity-25">no pins</p>
      )}
    </section>
  );
}

export function PinSections({ groups, pins, isEditing, onAddPin, onEditGroup, onDeleteGroup, onEditPin, onMovePin, onDeletePin, onReorderPins, onReorderGroups }: PinSectionsProps) {
  const [activePinMenuId, setActivePinMenuId] = useState<string | null>(null);
  const sortedGroups = sortGroups(groups);
  const categorizedGroups = sortedGroups.filter((group) => group.id !== UNCATEGORIZED_GROUP_ID);
  const uncategorizedPins = sortPins(pins.filter((pin) => pin.categoryId === UNCATEGORIZED_GROUP_ID));
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  useEffect(() => {
    if (!activePinMenuId) {
      return;
    }

    function closeMenu(event: Event) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') {
        return;
      }

      setActivePinMenuId(null);
    }

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenu);
    };
  }, [activePinMenuId]);

  function togglePinMenu(pinId: string) {
    setActivePinMenuId((activeId) => (activeId === pinId ? null : pinId));
  }

  function handleGroupDragEnd(event: DragEndEvent) {
    if (!isEditing || !event.over || event.active.id === event.over.id) {
      return;
    }

    onReorderGroups(String(event.active.id), String(event.over.id));
  }

  return (
    <section aria-labelledby="pins-heading" className="pb-32">
      <div className="mb-6 flex items-center gap-3">
        <h2 id="pins-heading" className="text-[10px] uppercase tracking-[0.3em] text-[var(--foreground)] opacity-50">Pins</h2>
        <span className="h-px flex-1 bg-[var(--border)] opacity-40" />
        {isEditing ? (
          <button className="text-[10px] text-[var(--foreground)] opacity-40 transition-opacity duration-150 hover:opacity-90 focus-visible:opacity-90" type="button" onClick={() => onAddPin(UNCATEGORIZED_GROUP_ID)}>
            add +
          </button>
        ) : null}
      </div>

      {uncategorizedPins.length > 0 ? (
        <PinList
          categoryId={UNCATEGORIZED_GROUP_ID}
          pins={uncategorizedPins}
          isEditing={isEditing}
          activePinMenuId={activePinMenuId}
          onToggleMenu={togglePinMenu}
          onEditPin={onEditPin}
          onMovePin={onMovePin}
          onDeletePin={onDeletePin}
          onReorder={onReorderPins}
        />
      ) : null}
      {uncategorizedPins.length === 0 ? <p className="text-xs text-[var(--foreground)] opacity-25">no pins yet</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
        <SortableContext items={categorizedGroups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 space-y-3">
            {categorizedGroups.length === 0 ? <p className="text-xs text-[var(--foreground)] opacity-25">no groups yet</p> : null}
            {categorizedGroups.map((group) => (
              <SortableGroup
                key={group.id}
                group={group}
                pins={sortPins(pins.filter((pin) => pin.categoryId === group.id))}
                isEditing={isEditing}
                activePinMenuId={activePinMenuId}
                onToggleMenu={togglePinMenu}
                onAddPin={onAddPin}
                onEditGroup={onEditGroup}
                onDeleteGroup={onDeleteGroup}
                onEditPin={onEditPin}
                onMovePin={onMovePin}
                onDeletePin={onDeletePin}
                onReorderPins={onReorderPins}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
