const LOCALE = 'en-GB';

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const date = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** One formatter per currency, built on first use: constructing them is the costly part. */
const money = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string): string {
  let formatter = money.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    money.set(currency, formatter);
  }
  return formatter.format(amount);
}

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

export const formatDate = (iso: string): string => date.format(new Date(iso));

export const formatInteger = (value: number): string => integer.format(value);

/** Minutes as the most readable unit: minutes, hours or days. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 24 * 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / (24 * 60)).toFixed(1)} d`;
}

export const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`;
