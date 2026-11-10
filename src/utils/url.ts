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
