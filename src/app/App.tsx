import { type FormEvent, type ReactNode, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { ClockHeader } from '../features/clock/ClockHeader';
import { PinSections } from '../features/pins/PinSections';
import { SearchBox } from '../features/search/SearchBox';
import { SettingsDrawer } from '../features/settings/SettingsDrawer';
import { createDefaultState } from '../storage/defaultState';
import { loadState, saveState } from '../storage/stateStorage';
import { UNCATEGORIZED_GROUP_ID, type Group, type NewTabState, type Pin } from '../types/state';
import { ensureFavicon } from '../utils/favicon';
import { createId } from '../utils/ids';
import { nextOrder, normalizeGroupName, normalizeLabel, normalizePinOrders, reorderGroups, reorderPinsWithinCategory, sortPins } from '../utils/pins';
import { getDomain, normalizeHttpUrl } from '../utils/url';
import { applyAppearance, DEFAULT_THEME } from '../theme/theme';

type DialogMode = 'pin' | 'group' | 'delete-pin' | 'delete-group' | null;

interface PinFormState {
  id: string | null;
  label: string;
  url: string;
  categoryId: string;
}

interface GroupFormState {
  id: string | null;
  name: string;
}

const emptyPinForm: PinFormState = { id: null, label: '', url: '', categoryId: UNCATEGORIZED_GROUP_ID };
const emptyGroupForm: GroupFormState = { id: null, name: '' };

export function App() {
  const [state, setState] = useState<NewTabState>(() => createDefaultState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [isFutureVersion, setIsFutureVersion] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pinForm, setPinForm] = useState<PinFormState>(emptyPinForm);
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pinToDelete, setPinToDelete] = useState<Pin | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [deleteDestinationId, setDeleteDestinationId] = useState(UNCATEGORIZED_GROUP_ID);
  const [pinDialogInitialField, setPinDialogInitialField] = useState<'label' | 'category'>('label');
  const [dialogReturnFocus, setDialogReturnFocus] = useState<HTMLElement | null>(null);
  const isEditing = !state.preferences.lockLayoutByDefault;
  const isAnyModalOpen = dialogMode !== null || isSettingsOpen;

  useLayoutEffect(() => {
    applyAppearance(
      state.preferences.importedTheme ?? DEFAULT_THEME,
      state.preferences.font,
      state.preferences.customFont,
    );
  }, [state.preferences.customFont, state.preferences.font, state.preferences.importedTheme]);

  useEffect(() => {
    let isMounted = true;

    loadState().then((result) => {
      if (isMounted) {
        setState(result.state);
        setIsFutureVersion(result.isFutureVersion);
        setIsHydrated(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveState(state, { skipIfFuture: isFutureVersion }).catch(() => undefined);
  }, [isHydrated, isFutureVersion, state]);

  function openNewPin(categoryId = state.groups[0]?.id ?? UNCATEGORIZED_GROUP_ID) {
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPinForm({ ...emptyPinForm, categoryId });
    setFormError(null);
    setDialogMode('pin');
    setPinDialogInitialField('label');
    setIsAddMenuOpen(false);
  }

  function openEditPin(pin: Pin) {
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPinForm({ id: pin.id, label: pin.label, url: pin.url, categoryId: pin.categoryId });
    setFormError(null);
    setDialogMode('pin');
    setPinDialogInitialField('label');
  }

  function openMovePin(pin: Pin) {
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPinForm({ id: pin.id, label: pin.label, url: pin.url, categoryId: pin.categoryId });
    setFormError(null);
    setDialogMode('pin');
    setPinDialogInitialField('category');
  }

  function openNewGroup() {
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setGroupForm(emptyGroupForm);
    setFormError(null);
    setDialogMode('group');
    setIsAddMenuOpen(false);
  }

  function openEditGroup(group: Group) {
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setGroupForm({ id: group.id, name: group.name });
    setFormError(null);
    setDialogMode('group');
  }

  function closeDialog() {
    setDialogMode(null);
    setFormError(null);
    setPinToDelete(null);
    setGroupToDelete(null);
    setDialogReturnFocus(null);
  }

  function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = normalizeLabel(pinForm.label);
    const url = normalizeHttpUrl(pinForm.url);
    const categoryId = state.groups.some((group) => group.id === pinForm.categoryId)
      ? pinForm.categoryId
      : UNCATEGORIZED_GROUP_ID;

    if (!label || !categoryId) {
      setFormError('label and group are required');
      return;
    }
    if (!url) {
      setFormError('enter a valid http or https URL');
      return;
    }
    if (pinForm.url.length > 2048) {
      setFormError('URL must be 2048 characters or fewer');
      return;
    }
    if (pinForm.id && !state.pins.some((pin) => pin.id === pinForm.id)) {
      setFormError('this pin no longer exists');
      return;
    }

    const domain = getDomain(url);
    if (domain) {
      ensureFavicon(url).catch(() => undefined);
    }
    setState((current) => {
      const existingPin = pinForm.id ? current.pins.find((pin) => pin.id === pinForm.id) : undefined;
      const nextPins = existingPin
        ? normalizePinOrders(
            current.pins.map((pin) =>
              pin.id === existingPin.id
                ? {
                    ...pin,
                    label,
                    url,
                    categoryId,
                    order:
                      existingPin.categoryId === categoryId
                        ? pin.order
                        : nextOrder(current.pins.filter((candidate) => candidate.categoryId === categoryId)),
                  }
                : pin,
            ),
          )
        : [
            ...current.pins,
            {
              id: createId('pin'),
              label,
              url,
              categoryId,
              order: nextOrder(current.pins.filter((pin) => pin.categoryId === categoryId)),
            },
          ];

      return {
        ...current,
        pins: nextPins,
        knownDomainCategories: domain ? { ...current.knownDomainCategories, [domain]: categoryId } : current.knownDomainCategories,
      };
    });
    closeDialog();
  }

  function handleGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeGroupName(groupForm.name);

    if (!name) {
      setFormError('group name is required');
      return;
    }
    if (state.groups.some((group) => group.id !== groupForm.id && group.name === name)) {
      setFormError('group name already exists');
      return;
    }

    setState((current) => {
      if (groupForm.id) {
        return { ...current, groups: current.groups.map((group) => (group.id === groupForm.id ? { ...group, name } : group)) };
      }

      const id = name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || createId('group');
      const uniqueId = current.groups.some((group) => group.id === id) ? createId(id) : id;
      return { ...current, groups: [...current.groups, { id: uniqueId, name, order: nextOrder(current.groups) }] };
    });
    closeDialog();
  }

  function requestDeletePin(pin: Pin) {
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPinToDelete(pin);
    setDialogMode('delete-pin');
  }

  function confirmDeletePin() {
    if (!pinToDelete) {
      return;
    }
    setState((current) => ({
      ...current,
      pins: normalizePinOrders(current.pins.filter((pin) => pin.id !== pinToDelete.id)),
    }));
    closeDialog();
  }

  function requestDeleteGroup(group: Group) {
    if (group.id === UNCATEGORIZED_GROUP_ID) {
      return;
    }
    setDialogReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setGroupToDelete(group);
    setDeleteDestinationId(UNCATEGORIZED_GROUP_ID);
    setDialogMode('delete-group');
  }

  function confirmDeleteGroup() {
    if (!groupToDelete || groupToDelete.id === UNCATEGORIZED_GROUP_ID) {
      return;
    }
    setState((current) => {
      const destinationId = current.groups.some((group) => group.id === deleteDestinationId && group.id !== groupToDelete.id)
        ? deleteDestinationId
        : UNCATEGORIZED_GROUP_ID;
      let destinationOrder = nextOrder(current.pins.filter((pin) => pin.categoryId === destinationId));
      const movedPinOrders = new Map(
        sortPins(current.pins.filter((pin) => pin.categoryId === groupToDelete.id)).map((pin) => [pin.id, destinationOrder++]),
      );

      return {
        ...current,
        groups: current.groups.filter((group) => group.id !== groupToDelete.id),
        pins: normalizePinOrders(
          current.pins.map((pin) =>
            pin.categoryId === groupToDelete.id
              ? { ...pin, categoryId: destinationId, order: movedPinOrders.get(pin.id) ?? pin.order }
              : pin,
          ),
        ),
        knownDomainCategories: Object.fromEntries(
          Object.entries(current.knownDomainCategories).map(([domain, categoryId]) => [
            domain,
            categoryId === groupToDelete.id ? destinationId : categoryId,
          ]),
        ),
      };
    });
    closeDialog();
  }

  function reorderPins(categoryId: string, activeId: string, overId: string) {
    setState((current) => {
      const pins = reorderPinsWithinCategory(current.pins, categoryId, activeId, overId);
      return pins === current.pins ? current : { ...current, pins };
    });
  }

  function reorderVisibleGroups(activeId: string, overId: string) {
    setState((current) => {
      const groups = reorderGroups(current.groups, activeId, overId);
      return groups === current.groups ? current : { ...current, groups };
    });
  }

  function toggleLayoutMode() {
    setState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        lockLayoutByDefault: !current.preferences.lockLayoutByDefault,
      },
    }));
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 text-[var(--foreground)] sm:px-6 lg:px-10">
      <main className="mx-auto max-w-4xl" inert={isAnyModalOpen || undefined}>
        <ClockHeader />
        <SearchBox engine={state.preferences.searchEngine} />
        <PinSections
          groups={state.groups}
          pins={state.pins}
          isEditing={isEditing}
          onAddPin={openNewPin}
          onEditGroup={openEditGroup}
          onDeleteGroup={requestDeleteGroup}
          onEditPin={openEditPin}
          onMovePin={openMovePin}
          onDeletePin={requestDeletePin}
          onReorderPins={reorderPins}
          onReorderGroups={reorderVisibleGroups}
        />
      </main>

      <div inert={isAnyModalOpen || undefined}>
        <BottomDock
          isAddMenuOpen={isAddMenuOpen}
          onToggleAddMenu={() => setIsAddMenuOpen((isOpen) => !isOpen)}
          onNewPin={() => openNewPin()}
          onNewGroup={openNewGroup}
          isEditing={isEditing}
          onToggleLayout={toggleLayoutMode}
          onSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      <SettingsDrawer isOpen={isSettingsOpen} state={state} onClose={() => setIsSettingsOpen(false)} onChange={setState} />

      {dialogMode === 'pin' ? (
        <PinDialog
          form={pinForm}
          groups={state.groups}
          knownDomainCategories={state.knownDomainCategories}
          error={formError}
          initialField={pinDialogInitialField}
          returnFocus={dialogReturnFocus}
          onChange={setPinForm}
          onClose={closeDialog}
          onSubmit={handlePinSubmit}
        />
      ) : null}

      {dialogMode === 'group' ? (
        <GroupDialog form={groupForm} error={formError} returnFocus={dialogReturnFocus} onChange={setGroupForm} onClose={closeDialog} onSubmit={handleGroupSubmit} />
      ) : null}

      {dialogMode === 'delete-pin' && pinToDelete ? (
        <ConfirmDialog title="Delete Pin" returnFocus={dialogReturnFocus} onClose={closeDialog} onConfirm={confirmDeletePin}>
          Delete <span className="text-[var(--foreground-strong)]">{pinToDelete.label}</span>? This cannot be undone.
        </ConfirmDialog>
      ) : null}

      {dialogMode === 'delete-group' && groupToDelete ? (
        <Dialog title="Delete Group" returnFocus={dialogReturnFocus} onClose={closeDialog}>
          <form className="space-y-5" onSubmit={(event) => {
            event.preventDefault();
            confirmDeleteGroup();
          }}>
            <p className="text-sm text-[var(--foreground)]">Delete <span className="text-[var(--foreground-strong)]">{groupToDelete.name}</span>?</p>
            {state.pins.some((pin) => pin.categoryId === groupToDelete.id) ? (
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="delete-group-destination">move existing pins to</label>
                <select id="delete-group-destination" data-autofocus className="mt-2 w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]" value={deleteDestinationId} onChange={(event) => setDeleteDestinationId(event.target.value)}>
                  {state.groups.filter((group) => group.id !== groupToDelete.id).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </div>
            ) : null}
            <div className="flex justify-end gap-4 pt-2">
              <button className="text-[var(--muted)] hover:text-[var(--foreground-strong)]" type="button" onClick={closeDialog}>cancel</button>
              <button className="text-[var(--accent-warm)] hover:text-[var(--foreground-strong)]" type="submit" data-autofocus={!state.pins.some((pin) => pin.categoryId === groupToDelete.id) || undefined}>delete group</button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

interface BottomDockProps {
  isAddMenuOpen: boolean;
  onToggleAddMenu: () => void;
  onNewPin: () => void;
  onNewGroup: () => void;
  isEditing: boolean;
  onToggleLayout: () => void;
  onSettings: () => void;
}

function BottomDock({ isAddMenuOpen, onToggleAddMenu, onNewPin, onNewGroup, isEditing, onToggleLayout, onSettings }: BottomDockProps) {
  const addControlRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const firstAddItemRef = useRef<HTMLButtonElement>(null);
  const toggleAddMenu = useEffectEvent(onToggleAddMenu);

  useEffect(() => {
    if (!isAddMenuOpen) {
      return;
    }
    firstAddItemRef.current?.focus();
    function closeAddMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') {
        return;
      }
      if (event instanceof MouseEvent && addControlRef.current?.contains(event.target as Node)) {
        return;
      }
      toggleAddMenu();
      if (event instanceof KeyboardEvent) {
        addButtonRef.current?.focus();
      }
    }
    window.addEventListener('click', closeAddMenu);
    window.addEventListener('keydown', closeAddMenu);
    return () => {
      window.removeEventListener('click', closeAddMenu);
      window.removeEventListener('keydown', closeAddMenu);
    };
  }, [isAddMenuOpen]);

  return (
    <nav className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] opacity-50 backdrop-blur-md transition-opacity duration-150 hover:opacity-90 focus-within:opacity-90" aria-label="New tab controls">
      {isEditing ? (
        <>
          <div ref={addControlRef} className="relative">
            <button ref={addButtonRef} className="px-1.5 text-sm leading-none text-[var(--foreground-strong)]" type="button" aria-expanded={isAddMenuOpen} aria-haspopup="menu" onClick={onToggleAddMenu}>+</button>
            {isAddMenuOpen ? (
              <div className="absolute bottom-9 left-0 min-w-28 rounded-[4px] border border-[var(--border)] bg-[var(--background)] p-1.5 text-xs" role="menu">
                <button ref={firstAddItemRef} className="block w-full px-2.5 py-1.5 text-left text-[var(--foreground)] hover:text-[var(--foreground-strong)]" type="button" role="menuitem" onClick={onNewPin}>new pin</button>
                <button className="block w-full px-2.5 py-1.5 text-left text-[var(--foreground)] hover:text-[var(--foreground-strong)]" type="button" role="menuitem" onClick={onNewGroup}>new group</button>
              </div>
            ) : null}
          </div>
          <span className="h-4 w-px bg-[var(--border)]" />
        </>
      ) : null}
      <button
        className={`transition-colors duration-150 hover:text-[var(--foreground-strong)] ${isEditing ? 'text-[var(--foreground-strong)]' : 'text-[var(--foreground)]'}`}
        type="button"
        aria-pressed={isEditing}
        aria-label={isEditing ? 'Lock layout' : 'Edit layout'}
        onClick={onToggleLayout}
      >
        {isEditing ? 'editing' : 'locked'}
      </button>
      <span className="h-4 w-px bg-[var(--border)]" />
      <button className="text-[var(--foreground)] transition-colors duration-150 hover:text-[var(--foreground-strong)]" type="button" onClick={onSettings}>settings</button>
    </nav>
  );
}

interface PinDialogProps {
  form: PinFormState;
  groups: Group[];
  knownDomainCategories: Record<string, string>;
  error: string | null;
  initialField: 'label' | 'category';
  returnFocus: HTMLElement | null;
  onChange: (form: PinFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function PinDialog({ form, groups, knownDomainCategories, error, initialField, returnFocus, onChange, onClose, onSubmit }: PinDialogProps) {
  function handleUrlChange(url: string) {
    const domain = getDomain(url);
    const suggestedCategoryId = domain ? knownDomainCategories[domain] : undefined;
    const hasSuggestedGroup = suggestedCategoryId ? groups.some((group) => group.id === suggestedCategoryId) : false;

    if (hasSuggestedGroup && suggestedCategoryId) {
      onChange({ ...form, url, categoryId: suggestedCategoryId });
      return;
    }

    onChange({ ...form, url });
  }

  return (
    <Dialog title={form.id ? 'Edit Pin' : 'Add Pin'} returnFocus={returnFocus} onClose={onClose}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="pin-label">label</label>
        <input id="pin-label" data-autofocus={initialField === 'label' || undefined} maxLength={80} className="w-full border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--foreground)]" value={form.label} onChange={(event) => onChange({ ...form, label: event.target.value })} />

        <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="pin-url">url</label>
        <input id="pin-url" maxLength={2048} className="w-full border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--foreground)]" value={form.url} onChange={(event) => handleUrlChange(event.target.value)} />

        <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="pin-category">group</label>
        <select id="pin-category" data-autofocus={initialField === 'category' || undefined} className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]" value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })}>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>

        {error ? <p className="text-sm text-[var(--accent-warm)]" role="alert">{error}</p> : null}

        <div className="flex justify-end gap-4 pt-2">
          <button className="text-[var(--muted)] hover:text-[var(--foreground-strong)]" type="button" onClick={onClose}>cancel</button>
          <button className="text-[var(--foreground-strong)] hover:text-[var(--accent-warm)]" type="submit">save</button>
        </div>
      </form>
    </Dialog>
  );
}

interface GroupDialogProps {
  form: GroupFormState;
  error: string | null;
  returnFocus: HTMLElement | null;
  onChange: (form: GroupFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function GroupDialog({ form, error, returnFocus, onChange, onClose, onSubmit }: GroupDialogProps) {
  return (
    <Dialog title={form.id ? 'Edit Group' : 'Add Group'} returnFocus={returnFocus} onClose={onClose}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="group-name">name</label>
        <input id="group-name" data-autofocus maxLength={60} className="w-full border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--foreground)]" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />

        {error ? <p className="text-sm text-[var(--accent-warm)]" role="alert">{error}</p> : null}

        <div className="flex justify-end gap-4 pt-2">
          <button className="text-[var(--muted)] hover:text-[var(--foreground-strong)]" type="button" onClick={onClose}>cancel</button>
          <button className="text-[var(--foreground-strong)] hover:text-[var(--accent-warm)]" type="submit">save</button>
        </div>
      </form>
    </Dialog>
  );
}

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}

function Dialog({ title, children, onClose, returnFocus }: DialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const initialFocus = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>('button, input, select, textarea');
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialog) {
        return;
      }
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      (returnFocus?.isConnected ? returnFocus : previousFocus)?.focus();
    };
  }, [returnFocus]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--background)]/75 px-4" role="presentation">
      <section ref={dialogRef} className="w-full max-w-lg border border-[var(--border)] bg-[var(--background)] p-6" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
          <h2 id="dialog-title" className="text-xs uppercase tracking-[0.32em] text-[var(--foreground-strong)]">{title}</h2>
          <button className="text-[var(--muted)] hover:text-[var(--foreground-strong)]" type="button" onClick={onClose}>close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ConfirmDialog({ title, children, onClose, onConfirm, returnFocus }: DialogProps & { onConfirm: () => void }) {
  return (
    <Dialog title={title} returnFocus={returnFocus} onClose={onClose}>
      <div className="space-y-6">
        <p className="text-sm text-[var(--foreground)]">{children}</p>
        <div className="flex justify-end gap-4">
          <button className="text-[var(--muted)] hover:text-[var(--foreground-strong)]" type="button" onClick={onClose}>cancel</button>
          <button data-autofocus className="text-[var(--accent-warm)] hover:text-[var(--foreground-strong)]" type="button" onClick={onConfirm}>delete pin</button>
        </div>
      </div>
    </Dialog>
  );
}
