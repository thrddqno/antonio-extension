import { type FormEvent, useEffect, useRef, useState } from 'react';
import { createSearchTarget } from '../../utils/url';
import type { SearchEngine } from '../../types/state';
import { useSearchShortcuts } from './useSearchShortcuts';

export function SearchBox({ engine }: { engine: SearchEngine }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useSearchShortcuts(inputRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = createSearchTarget(query, engine);

    if (target) {
      window.location.assign(target);
    }
  }

  return (
    <form className="relative mx-auto mb-[clamp(5rem,11vh,8rem)] max-w-md" onSubmit={handleSubmit} role="search">
      <label className="sr-only" htmlFor="search-input">Search the web</label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--foreground)] opacity-35" aria-hidden="true">&gt;</span>
      <input
        ref={inputRef}
        id="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface-low)] py-2.5 pl-8 pr-3 text-sm text-[var(--foreground-strong)] caret-[var(--cursor,var(--foreground))] transition-colors duration-150 placeholder:text-[var(--foreground)] placeholder:opacity-[0.35] hover:border-[var(--border-hover)] focus:border-[var(--foreground)]"
        placeholder="search the web..."
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  );
}
