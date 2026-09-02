import { type RefObject, useEffect } from 'react';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.matches('input, textarea, select, [contenteditable="true"]');
}

export function useSearchShortcuts(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (document.querySelector('[aria-modal="true"]')) {
        return;
      }

      const isTyping = isTypingTarget(event.target);
      const shouldFocusSlash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping;
      const shouldFocusCommand = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !isTyping;

      if (shouldFocusSlash || shouldFocusCommand) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputRef]);
}
