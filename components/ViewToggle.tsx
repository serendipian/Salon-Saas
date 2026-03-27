import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '../hooks/useViewMode';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onChange }) => (
  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
    <button
      type="button"
      onClick={() => onChange('card')}
      className={`p-2 rounded-md transition-all ${
        viewMode === 'card'
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-400 hover:text-slate-600'
      }`}
      aria-label="Vue carte"
      title="Vue carte"
    >
      <LayoutGrid size={16} />
    </button>
    <button
      type="button"
      onClick={() => onChange('table')}
      className={`p-2 rounded-md transition-all ${
        viewMode === 'table'
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-400 hover:text-slate-600'
      }`}
      aria-label="Vue tableau"
      title="Vue tableau"
    >
      <List size={16} />
    </button>
  </div>
);
