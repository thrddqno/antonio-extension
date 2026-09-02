import { useEffect, useState } from 'react';
import { deleteFavicon, getFavicon } from '../../storage/faviconCache';
import { ensureFavicon } from '../../utils/favicon';
import { getDomain } from '../../utils/url';

export function useFavicon(url: string): string | null {
  const [favicon, setFavicon] = useState<{ sourceUrl: string; objectUrl: string } | null>(null);
  const domain = getDomain(url);

  useEffect(() => {
    if (!domain) {
      return;
    }

    const currentDomain = domain;
    const currentSourceUrl = url;
    let disposed = false;
    let currentUrl: string | null = null;

    function show(blob: Blob): void {
      let nextUrl: string;

      try {
        nextUrl = URL.createObjectURL(blob);
        currentUrl = nextUrl;
      } catch {
        void deleteFavicon(currentDomain);
        return;
      }

      let image: HTMLImageElement;
      try {
        image = new Image();
      } catch {
        URL.revokeObjectURL(nextUrl);
        currentUrl = null;
        void deleteFavicon(currentDomain);
        return;
      }

      image.onload = () => {
        if (disposed) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        setFavicon({ sourceUrl: currentSourceUrl, objectUrl: nextUrl });
      };
      image.onerror = () => {
        URL.revokeObjectURL(nextUrl);
        currentUrl = null;
        void deleteFavicon(currentDomain);
        if (!disposed) {
          setFavicon(null);
        }
      };

      try {
        image.src = nextUrl;
      } catch {
        URL.revokeObjectURL(nextUrl);
        currentUrl = null;
        void deleteFavicon(currentDomain);
      }
    }

    async function load() {
      const cached = await getFavicon(currentDomain);

      if (disposed) {
        return;
      }

      if (cached) {
        show(cached);
        return;
      }

      void ensureFavicon(url)
        .then(async () => {
          if (disposed) {
            return;
          }

          const blob = await getFavicon(currentDomain);
          if (!disposed && blob) {
            show(blob);
          }
        })
        .catch(() => undefined);
    }

    void load();

    return () => {
      disposed = true;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [url, domain]);

  return favicon?.sourceUrl === url ? favicon.objectUrl : null;
}
