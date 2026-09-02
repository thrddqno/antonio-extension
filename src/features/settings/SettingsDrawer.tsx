import { type ChangeEvent, type Dispatch, type SetStateAction, useEffect, useEffectEvent, useRef, useState } from 'react';
import { parseColorsToml } from '../../theme/colorsToml';
import { FONT_OPTIONS, normalizeCustomFont, type FontOption } from '../../theme/theme';
import type { NewTabState, SearchEngine } from '../../types/state';

interface SettingsDrawerProps {
  isOpen: boolean;
  state: NewTabState;
  onClose: () => void;
  onChange: Dispatch<SetStateAction<NewTabState>>;
}

const FONT_LABELS: Record<FontOption, string> = {
  system: 'system monospace',
  jetbrains: 'JetBrains Mono',
  cascadia: 'Cascadia Mono',
  'ibm-plex': 'IBM Plex Mono',
  custom: 'custom font-family',
};

const controlClass = 'mt-2 w-full rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]';

export function SettingsDrawer({ isOpen, state, onClose, onChange }: SettingsDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const preferences = state.preferences;
  const closeSettings = useEffectEvent(onClose);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) {
        return;
      }
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first && last && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (first && last && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function updatePreferences(next: Partial<NewTabState['preferences']>) {
    onChange((current) => ({ ...current, preferences: { ...current.preferences, ...next } }));
  }

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (file.size > 64 * 1024) {
      setImportMessage('error: colors.toml must be smaller than 64 KB');
      return;
    }
    try {
      const result = parseColorsToml(await file.text());
      if (!result.theme) {
        setImportMessage(`error: ${result.error}`);
        return;
      }
      updatePreferences({ importedTheme: result.theme });
      setImportMessage('theme imported');
    } catch {
      setImportMessage('error: could not read colors.toml');
    }
  }

  return (
    <aside ref={drawerRef} className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--background)] p-6 text-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="mb-9 flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
        <h2 id="settings-title" className="text-xs uppercase tracking-[0.32em] text-[var(--foreground-strong)]">Settings</h2>
        <button ref={closeRef} className="text-[var(--muted)] transition-colors duration-150 hover:text-[var(--foreground-strong)]" type="button" onClick={onClose}>close</button>
      </div>

      <div className="space-y-10">
        <section>
          <h3 className="mb-5 border-b border-[var(--border)] pb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Appearance</h3>
          <div className="space-y-5">
            <div>
              <span className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">theme</span>
              <p className={`${controlClass} opacity-70`}>{preferences.importedTheme ? 'imported colors.toml' : 'default'}</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="font-setting">font</label>
              <select id="font-setting" className={controlClass} value={preferences.font} onChange={(event) => updatePreferences({ font: event.target.value as FontOption })}>
                {FONT_OPTIONS.map((font) => <option key={font} value={font}>{FONT_LABELS[font]}</option>)}
              </select>
              {preferences.font === 'custom' ? (
                <input
                  className={controlClass}
                  aria-label="custom font-family"
                  value={preferences.customFont}
                  placeholder="e.g. Iosevka"
                  onChange={(event) => updatePreferences({ customFont: normalizeCustomFont(event.target.value) })}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <label className="cursor-pointer text-[var(--foreground)] transition-colors duration-150 hover:text-[var(--foreground-strong)]">
                import colors.toml
                <input className="sr-only" type="file" accept=".toml,text/plain,application/toml" onChange={importTheme} />
              </label>
              <button className="text-[var(--muted)] hover:text-[var(--foreground-strong)]" type="button" onClick={() => {
                updatePreferences({ importedTheme: null });
                setImportMessage('default theme restored');
              }}>reset to default</button>
            </div>
            {importMessage ? <p className={`text-xs ${importMessage.startsWith('error:') ? 'text-[var(--accent-warm)]' : 'text-[var(--muted)]'}`} role="status">{importMessage}</p> : null}
          </div>
        </section>

        <section>
          <h3 className="mb-5 border-b border-[var(--border)] pb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Search</h3>
          <label className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]" htmlFor="search-engine">engine</label>
          <select id="search-engine" className={controlClass} value={preferences.searchEngine} onChange={(event) => updatePreferences({ searchEngine: event.target.value as SearchEngine })}>
            <option value="google">google</option>
            <option value="duckduckgo">duckduckgo</option>
            <option value="brave">brave search</option>
          </select>
        </section>

        <section>
          <h3 className="mb-5 border-b border-[var(--border)] pb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Layout</h3>
          <label className="flex items-center gap-3 text-[var(--foreground)]" htmlFor="lock-default">
            <input id="lock-default" type="checkbox" checked={preferences.lockLayoutByDefault} onChange={(event) => updatePreferences({ lockLayoutByDefault: event.target.checked })} />
            lock layout by default
          </label>
          <p className="mt-3 text-xs text-[var(--subtle)]">This is the same global lock used by the bottom dock.</p>
        </section>
      </div>
    </aside>
  );
}
