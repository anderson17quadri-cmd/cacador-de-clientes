'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export function PwaUpdater() {
  const reloading = useRef(false);
  const notified = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const promptUpdate = (reg: ServiceWorkerRegistration) => {
      if (notified.current) return;
      notified.current = true;
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            Nova versão disponível
            <button
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
              onClick={() => {
                reg.waiting?.postMessage('SKIP_WAITING');
                toast.dismiss(t.id);
              }}
            >
              Atualizar
            </button>
          </span>
        ),
        { duration: 20000 },
      );
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;

        if (reg.waiting && reg.active) promptUpdate(reg);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptUpdate(reg);
            }
          });
        });
      })
      .catch(() => {});

    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') registration?.update();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(() => registration?.update(), 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, []);

  return null;
}
