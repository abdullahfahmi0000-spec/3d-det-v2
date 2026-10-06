import { type ReactElement, useEffect, useState } from 'react';

import { StatusBadge, type StatusTone } from '@3ddet/ui';

import { fetchHealth } from './api/client';
import { ViewerBootstrap } from './components/ViewerBootstrap';

type ApiState = { tone: StatusTone; label: string };

export function App(): ReactElement {
  const [api, setApi] = useState<ApiState>({ tone: 'pending', label: 'API: checking' });

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then(() => {
        if (!cancelled) setApi({ tone: 'ok', label: 'API: ok' });
      })
      .catch(() => {
        if (!cancelled) setApi({ tone: 'error', label: 'API: unreachable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">3D.DET</h1>
        <StatusBadge tone={api.tone} label={api.label} />
        <span className="shell__meta">Rendering pipeline check</span>
      </header>
      <main className="viewport">
        <ViewerBootstrap />
      </main>
    </div>
  );
}
