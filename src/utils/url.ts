import type { SearchEngine } from '../types/state';

const HOSTNAME_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i;

const SEARCH_URLS: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
};

export function normalizeHttpUrl(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getDomain(input: string): string | null {
  const normalized = normalizeHttpUrl(input);

  if (!normalized) {
    return null;
  }

  return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
}

export function createSearchTarget(input: string, engine: SearchEngine = 'google'): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const normalizedUrl = normalizeHttpUrl(trimmed);

  if (normalizedUrl && (trimmed.includes('://') || HOSTNAME_PATTERN.test(trimmed) || trimmed.startsWith('localhost'))) {
    return normalizedUrl;
  }

  return `${SEARCH_URLS[engine]}${encodeURIComponent(trimmed)}`;
}
