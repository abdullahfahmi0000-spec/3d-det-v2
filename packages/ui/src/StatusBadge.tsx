import type { ReactElement } from 'react';

export type StatusTone = 'ok' | 'pending' | 'error';

export interface StatusBadgeProps {
  readonly tone: StatusTone;
  readonly label: string;
}

const TONE_COLOR: Record<StatusTone, string> = {
  ok: '#2a6b50',
  pending: '#8a6412',
  error: '#9c3832',
};

/**
 * Minimal shared component. It exists to establish the package boundary and to prove the
 * web application consumes this package; it is not the beginning of a design system.
 */
export function StatusBadge({ tone, label }: StatusBadgeProps): ReactElement {
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '3px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#ffffff',
        background: TONE_COLOR[tone],
      }}
    >
      {label}
    </span>
  );
}
