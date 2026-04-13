import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { supabase } from '../lib/supabase';
import type { ConnectionState } from '../hooks/useConnectionStatus';

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

export const ConnectionStatusDot: React.FC = () => {
  const status = useConnectionStatus();

  return (
    <div className="relative group" title={TOOLTIP[status]}>
      <div className={`w-2 h-2 rounded-full ${DOT_STYLES[status]}`} />
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
