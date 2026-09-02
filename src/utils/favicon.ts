import { getFavicon, markNoFavicon, setFavicon, wasFaviconAttempted } from '../storage/faviconCache';
import { getDomain, normalizeHttpUrl } from './url';

const FAVICON_SIZE = 32;

export function getImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x3c &&
    bytes.slice(0, 64).every((value) => value >= 0x20 && value <= 0x7e) &&
    /^(<\?xml|<!doctype|<svg)/i.test(String.fromCharCode(...bytes.slice(0, 64)))
  ) {
    return 'image/svg+xml';
  }
  return null;
}

export function faviconRequestUrl(targetUrl: string, size = FAVICON_SIZE): string | null {
  const normalized = normalizeHttpUrl(targetUrl);

  if (!normalized) {
    return null;
  }

  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', normalized);
  url.searchParams.set('size', String(size));
  return url.toString();
}

async function sniffType(blob: Blob): Promise<string | null> {
  const buffer = await blob.slice(0, 64).arrayBuffer();
  return getImageType(new Uint8Array(buffer));
}

const inFlight = new Map<string, Promise<void>>();

export async function ensureFavicon(rawUrl: string): Promise<void> {
  const domain = getDomain(rawUrl);

  if (!domain) {
    return;
  }

  if (inFlight.has(domain)) {
    return inFlight.get(domain);
  }

  const promise = (async () => {
    if (await wasFaviconAttempted(domain)) {
      return;
    }

    const cached = await getFavicon(domain);
    if (cached) {
      return;
    }

    const requestUrl = faviconRequestUrl(rawUrl);

    try {
      if (!requestUrl) {
        await markNoFavicon(domain);
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(requestUrl, { signal: controller.signal });

        if (!response.ok) {
          await markNoFavicon(domain);
          return;
        }

        const blob = await response.blob();
        const type = await sniffType(blob);

        if (!type || blob.size === 0) {
          await markNoFavicon(domain);
          return;
        }

        await setFavicon(domain, new Blob([blob], { type }));
      } catch {
        await markNoFavicon(domain);
      } finally {
        window.clearTimeout(timeout);
      }
    } finally {
      inFlight.delete(domain);
    }
  })();

  inFlight.set(domain, promise);
  await promise;
}
