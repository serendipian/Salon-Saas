import { useEffect, useState } from 'react';

interface FreshnessIndicatorProps {
  updatedAt: number;
}

function formatRelative(deltaMs: number): string {
  const s = Math.floor(deltaMs / 1000);
  if (s < 5) return "À l'instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h`;
}

export const FreshnessIndicator = ({ updatedAt }: FreshnessIndicatorProps) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const label = formatRelative(Date.now() - updatedAt);

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>{label}</span>
    </div>
  );
};
