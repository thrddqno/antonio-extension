import { afterEach, describe, expect, it, vi } from 'vitest';

type StoredValue = Blob | { domain: string; blob: unknown; updatedAt?: number };

function indexedDbWith(records: Map<string, StoredValue>, transactionFails = false): IDBFactory {
  const database = {
    objectStoreNames: { contains: () => true },
    close: vi.fn(),
    onversionchange: null,
    transaction: () => {
      if (transactionFails) {
        throw new Error('transaction unavailable');
      }

      const transaction = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        objectStore: () => ({
          get: (domain: string) => requestFor(transaction, () => records.get(domain)),
          put: (record: { domain: string }) => requestFor(transaction, () => {
            records.set(record.domain, record as StoredValue);
            return record.domain;
          }),
          delete: (domain: string) => requestFor(transaction, () => records.delete(domain)),
        }),
      };
      return transaction;
    },
  };

  return {
    open: () => {
      const request = {
        result: database,
        transaction: null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  } as unknown as IDBFactory;
}

function requestFor<T>(transaction: { oncomplete: (() => void) | null }, operation: () => T) {
  const request = {
    result: undefined as T | undefined,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  queueMicrotask(() => {
    request.result = operation();
    request.onsuccess?.();
    transaction.oncomplete?.();
  });
  return request;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('faviconCache', () => {
  it('degrades gracefully when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { deleteFavicon, getFavicon, hasFavicon, markNoFavicon, wasFaviconAttempted } = await import('./faviconCache');

    await expect(getFavicon('example.com')).resolves.toBeNull();
    await expect(hasFavicon('example.com')).resolves.toBe(false);
    await expect(wasFaviconAttempted('example.com')).resolves.toBe(false);
    await expect(markNoFavicon('example.com')).resolves.toBeUndefined();
    await expect(deleteFavicon('example.com')).resolves.toBeUndefined();
  });

  it('degrades gracefully when opening IndexedDB throws', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('blocked'); } });
    const { getFavicon, setFavicon } = await import('./faviconCache');

    await expect(getFavicon('example.com')).resolves.toBeNull();
    await expect(setFavicon('example.com', new Blob(['image']))).resolves.toBeUndefined();
  });

  it('degrades gracefully when a transaction cannot be created', async () => {
    vi.stubGlobal('indexedDB', indexedDbWith(new Map(), true));
    const { deleteFavicon, getFavicon, markNoFavicon } = await import('./faviconCache');

    await expect(getFavicon('example.com')).resolves.toBeNull();
    await expect(markNoFavicon('example.com')).resolves.toBeUndefined();
    await expect(deleteFavicon('example.com')).resolves.toBeUndefined();
  });

  it('reads wrapped and legacy raw blobs from the shared domain store', async () => {
    const rawBlob = new Blob(['raw'], { type: 'image/png' });
    const wrappedBlob = new Blob(['wrapped'], { type: 'image/png' });
    const records = new Map<string, StoredValue>([
      ['raw.example', rawBlob],
      ['wrapped.example', { domain: 'wrapped.example', blob: wrappedBlob }],
    ]);
    vi.stubGlobal('indexedDB', indexedDbWith(records));
    const { getFavicon, hasFavicon } = await import('./faviconCache');

    await expect(getFavicon('raw.example')).resolves.toBe(rawBlob);
    await expect(getFavicon('wrapped.example')).resolves.toBe(wrappedBlob);
    await expect(hasFavicon('wrapped.example')).resolves.toBe(true);
  });

  it('recognizes legacy markers and ignores malformed records', async () => {
    const records = new Map<string, StoredValue>([
      ['marker.example', { domain: 'marker.example', blob: new Blob([new Uint8Array([0])]) }],
      ['raw-marker.example', new Blob([new Uint8Array([0])])],
      ['broken.example', { domain: 'broken.example', blob: 'not a blob' }],
    ]);
    vi.stubGlobal('indexedDB', indexedDbWith(records));
    const { getFavicon, wasFaviconAttempted } = await import('./faviconCache');

    await expect(getFavicon('marker.example')).resolves.toBeNull();
    await expect(wasFaviconAttempted('marker.example')).resolves.toBe(true);
    await expect(getFavicon('raw-marker.example')).resolves.toBeNull();
    await expect(wasFaviconAttempted('raw-marker.example')).resolves.toBe(true);
    await expect(getFavicon('broken.example')).resolves.toBeNull();
    await expect(wasFaviconAttempted('broken.example')).resolves.toBe(false);
  });
});
