import { WifiOff } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ConnectionState } from '../hooks/useConnectionStatus';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { supabase } from '../lib/supabase';

const DOT_STYLES: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  recovering: 'bg-amber-500 animate-pulse',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
  offline: 'bg-red-500',
};

const TOOLTIP: Record<ConnectionState, string> = {
  connected: 'Connecté',
  recovering: 'Synchronisation en cours...',
  reconnecting: 'Reconnexion en cours...',
  disconnected: 'Connexion perdue',
  offline: 'Hors ligne',
};

interface TransitionFlash {
  message: string;
  tone: 'success' | 'warning';
}

export const ConnectionStatusDot: React.FC = () => {
  const status = useConnectionStatus();
  const [flash, setFlash] = useState<TransitionFlash | null>(null);
  const [visible, setVisible] = useState(false);
  const prevStatusRef = useRef<ConnectionState>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === status) return;

    let next: TransitionFlash | null = null;
    if (prev !== 'connected' && status === 'connected') {
      next = { message: 'Connexion rétablie', tone: 'success' };
    } else if (prev !== 'offline' && status === 'offline') {
      next = { message: 'Hors ligne', tone: 'warning' };
    }
    if (!next) return;

    setFlash(next);
    // Paint the opacity-0 state first, then animate to opacity-100.
    const showFrame = requestAnimationFrame(() => setVisible(true));
    const hideTimer = setTimeout(() => setVisible(false), 2500);
    const clearTimer = setTimeout(() => setFlash(null), 2800);

    return () => {
      cancelAnimationFrame(showFrame);
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [status]);

  const toneClass = flash?.tone === 'success' ? 'text-emerald-600' : 'text-amber-600';

  return (
    <div className="flex items-center gap-1.5">
      <div
        title={TOOLTIP[status]}
        className={`w-2 h-2 rounded-full shrink-0 ${DOT_STYLES[status]}`}
      />
      {flash && (
        <span
          className={`text-xs font-medium whitespace-nowrap transition-all duration-300 ease-out ${toneClass} ${
            visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
          }`}
          aria-live="polite"
        >
          {flash.message}
        </span>
      )}
    </div>
  );
};

export const ConnectionBanner: React.FC = () => {
  const status = useConnectionStatus();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status === 'connected') setRetrying(false);
  }, [status]);

  if (status !== 'disconnected' && status !== 'offline') return null;

  const handleRetry = () => {
    setRetrying(true);
    supabase.realtime.connect();
    setTimeout(() => setRetrying(false), 3000);
  };

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-sm animate-in slide-in-from-top duration-300">
      <WifiOff size={16} className="text-amber-600 shrink-0" />
      <p className="text-amber-800">
        Connexion perdue — les données affichées peuvent être obsolètes
      </p>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {retrying ? 'Reconnexion...' : 'Réessayer'}
      </button>
    </div>
  );
};
