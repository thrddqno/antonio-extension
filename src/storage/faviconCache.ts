const DB_NAME = 'new-tab';
const DB_VERSION = 1;
const STORE_NAME = 'favicons';
const NO_FAVICON_MARKER = new Uint8Array([0]);

interface FaviconRecord {
  domain: string;
  blob: Blob;
  updatedAt: number;
}

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) {
    return databasePromise;
  }

  const promise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;

    try {
      const factory = globalThis.indexedDB;
      if (!factory) {
        resolve(null);
        return;
      }
      request = factory.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close();
        return;
      }
      settled = true;
      resolve(database);
    };

    request.onupgradeneeded = () => {
      try {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'domain' });
        }
      } catch {
        try {
          request.transaction?.abort();
        } catch {
          // The failed upgrade is already treated as an unavailable cache.
        }
        finish(null);
      }
    };

    request.onsuccess = () => {
      try {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (databasePromise === promise) {
            databasePromise = null;
          }
        };
        finish(db);
      } catch {
        finish(null);
      }
    };
    request.onerror = () => finish(null);
    request.onblocked = () => finish(null);
  });

  databasePromise = promise;
  void promise.then((database) => {
    if (!database && databasePromise === promise) {
      databasePromise = null;
    }
  });
  return promise;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await openDatabase();
    if (!db) {
      return null;
    }

    return await new Promise<T | null>((resolve) => {
      let transaction: IDBTransaction;
      let request: IDBRequest<T>;

      try {
        transaction = db.transaction(STORE_NAME, mode);
        request = run(transaction.objectStore(STORE_NAME));
      } catch {
        resolve(null);
        return;
      }

      let result: T | null = null;
      let settled = false;
      const finish = (value: T | null) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      request.onsuccess = () => {
        try {
          result = request.result ?? null;
        } catch {
          result = null;
        }
      };
      request.onerror = () => finish(null);
      transaction.oncomplete = () => finish(result);
      transaction.onerror = () => finish(null);
      transaction.onabort = () => finish(null);
    });
  } catch {
    return null;
  }
}

function recordBlob(record: unknown): Blob | null {
  try {
    if (record instanceof Blob) {
      return record;
    }

    if (typeof record !== 'object' || record === null || !('blob' in record)) {
      return null;
    }

    const blob = (record as { blob?: unknown }).blob;
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

function isMarkerBlob(blob: Blob): boolean {
  return blob.size === NO_FAVICON_MARKER.length;
}

export async function getFavicon(domain: string): Promise<Blob | null> {
  const record = await withStore<unknown>('readonly', (store) => store.get(domain));
  const blob = recordBlob(record);

  if (!blob || isMarkerBlob(blob)) {
    return null;
  }

  return blob;
}

export async function hasFavicon(domain: string): Promise<boolean> {
  return (await getFavicon(domain)) !== null;
}

export async function setFavicon(domain: string, blob: Blob): Promise<void> {
  if (blob.size === 0) {
    return;
  }

  const record: FaviconRecord = { domain, blob, updatedAt: Date.now() };
  await withStore('readwrite', (store) => store.put(record));
}

export async function markNoFavicon(domain: string): Promise<void> {
  const record: FaviconRecord = { domain, blob: new Blob([NO_FAVICON_MARKER]), updatedAt: Date.now() };
  await withStore('readwrite', (store) => store.put(record));
}

export async function wasFaviconAttempted(domain: string): Promise<boolean> {
  const record = await withStore<unknown>('readonly', (store) => store.get(domain));
  return recordBlob(record) !== null;
}

export async function deleteFavicon(domain: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(domain));
}
