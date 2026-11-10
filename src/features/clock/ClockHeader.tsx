import { useEffect, useState } from 'react';

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });

function formatTime(date: Date): { hour: string; minute: string; period: string } {
  const parts = timeFormatter.formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  return { hour, minute, period };
}

function formatDate(date: Date): string {
  const weekday = weekdayFormatter.format(date);
  const month = monthFormatter.format(date);
  return `${weekday} · ${month} ${date.getDate()}, ${date.getFullYear()}`.toUpperCase();
}

export function ClockHeader() {
  const [now, setNow] = useState(() => new Date());
  const time = formatTime(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="mx-auto mb-8 max-w-xl pt-[clamp(3.5rem,10dvh,6rem)] text-center sm:pt-[clamp(5rem,14vh,10rem)]">
      <time className="block text-[clamp(3.75rem,7vw,5.75rem)] font-light leading-none tracking-[-0.055em] text-[var(--foreground-strong)]" dateTime={now.toISOString()}>
        {time.hour}<span className="clock-separator">:</span>{time.minute}<span className="ml-3 align-top text-[0.22em] tracking-normal text-[var(--foreground)] opacity-65">{time.period}</span>
      </time>
      <div className="mt-4 text-[10px] uppercase tracking-[0.3em] text-[var(--foreground)] opacity-45 sm:text-[11px]">{formatDate(now)}</div>
    </header>
  );
}
