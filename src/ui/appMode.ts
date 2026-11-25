import { useEffect, useState } from 'react';

/**
 * Alles om het spel als een app op je telefoon te laten voelen:
 * offline-cache (service worker), installeren op het beginscherm, en het scherm aan houden.
 */

/** Offline-cache aanzetten (alleen in de gepubliceerde versie, niet tijdens het bouwen). */
export function registerOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* geen cache: het spel werkt gewoon online */
    });
  });
}

/** Draait het spel al als geïnstalleerde app? */
export function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: fullscreen)').matches ||
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
}

/**
 * Installeren op het beginscherm. Android/Chrome: een echte knop. iPhone: alleen via
 * Delen > "Zet op beginscherm", dus dan geven we die tip.
 */
export function useInstall(): { canPrompt: boolean; install: () => void; ios: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return {
    canPrompt: deferred !== null,
    ios,
    install: () => {
      void deferred?.prompt();
      deferred = null;
      force((n) => n + 1);
    },
  };
}

/** Scherm aan houden zolang je aan tafel zit (anders gaat het uit terwijl je nadenkt). */
export function useKeepAwake(): void {
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } })
      .wakeLock;
    if (!wl) return;
    let lock: Lock | null = null;
    let alive = true;
    const take = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen')
        .then((l) => {
          if (alive) lock = l;
          else void l.release();
        })
        .catch(() => {
          /* niet toegestaan (bijv. batterijbesparing): geen probleem */
        });
    };
    take();
    // Na wisselen van app vervalt het slot: bij terugkomen opnieuw vragen.
    document.addEventListener('visibilitychange', take);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', take);
      void lock?.release();
    };
  }, []);
}
