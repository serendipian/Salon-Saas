import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { formatPrice } from '../../../lib/format';

interface MiniCartBarProps {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export const MiniCartBar: React.FC<MiniCartBarProps> = ({ itemCount, total, onOpen }) => {
  const [bounce, setBounce] = useState(false);
  const isFirstRender = useRef(true);

  // Trigger bounce animation when itemCount changes (skip initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (itemCount > 0) {
      setBounce(true);
      const timer = setTimeout(() => setBounce(false), 300);
      return () => clearTimeout(timer);
    }
  }, [itemCount]);

  if (itemCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`fixed left-3 right-3 h-[44px] bg-slate-900 text-white rounded-xl flex items-center justify-between px-4 shadow-lg transition-transform ${
        bounce ? 'scale-[1.03]' : 'scale-100'
      }`}
      style={{
        bottom: 'calc(56px + env(safe-area-inset-bottom) + 8px)',
        zIndex: 'var(--z-peek-bar)',
      }}
      aria-label={`Panier: ${itemCount} article${itemCount > 1 ? 's' : ''}, ${formatPrice(total)}`}
    >
      <div className="flex items-center gap-2">
        <ShoppingBag size={18} />
        <span className="text-sm font-semibold">
          {itemCount} article{itemCount > 1 ? 's' : ''} · {formatPrice(total)}
        </span>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium">
        <span>Panier</span>
        <ChevronRight size={16} />
      </div>
    </button>
  );
};
