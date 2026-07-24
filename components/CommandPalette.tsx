import type { LucideIcon } from 'lucide-react';
import { CornerDownLeft, Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CommandItem {
  /** Module id passed back to onSelect (same ids the sidebar uses). */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Section heading this item is listed under. */
  group: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  onSelect: (id: string) => void;
}

/** Strips accents so "reglages" matches "Réglages". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Navigation command palette, opened with ⌘K / Ctrl+K or the topbar search button.
 *
 * Replaces the old always-rendered search input in the topbar: it costs no
 * horizontal space at rest, which is what lets the page title and the global
 * controls share a single 56px bar.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return items;
    return items.filter((item) => fold(item.label).includes(q) || fold(item.group).includes(q));
  }, [items, query]);

  // Reset transient state on every open so the palette never reopens mid-search.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Clamp the cursor when filtering shrinks the list under it.
  useEffect(() => {
    setActiveIndex((i) => (i >= results.length ? Math.max(0, results.length - 1) : i));
  }, [results.length]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const commit = (id: string) => {
    onSelect(id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) commit(item.id);
    }
  };

  let lastGroup: string | null = null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh]"
      style={{ zIndex: 'var(--z-modal)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche et navigation"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer la recherche"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] cursor-default"
      />

      <div
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 shadow-[0_32px_64px_-24px_rgba(15,23,42,0.28),0_8px_24px_-12px_rgba(15,23,42,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
      >
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <Search size={18} strokeWidth={1.75} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Aller à une page…"
            aria-label="Rechercher une page"
            aria-controls="command-palette-results"
            className="flex-1 py-4 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline-block shrink-0 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          className="max-h-[52vh] overflow-y-auto py-2 custom-scrollbar"
        >
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun résultat</p>
          ) : (
            results.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const isActive = index === activeIndex;
              const Icon = item.icon;
              return (
                <React.Fragment key={item.id}>
                  {showGroup && (
                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => commit(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-blue-50/70' : ''
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.75}
                      className={isActive ? 'text-blue-600' : 'text-slate-400'}
                    />
                    <span
                      className={`flex-1 text-[13.5px] ${
                        isActive ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                    {isActive && <CornerDownLeft size={14} className="text-slate-300 shrink-0" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
