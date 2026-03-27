import React from 'react';
import { LayoutDashboard, Calendar, CreditCard, Users, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthResource } from '../lib/auth.types';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  resource: AuthResource;
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
  { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
  { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
  { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
];

interface BottomTabBarProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  onMorePress: () => void;
  can: (action: string, resource: string) => boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeModule,
  onNavigate,
  onMorePress,
  can,
}) => {
  const visibleTabs = TABS.filter(tab => can('view', tab.resource));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
      style={{ zIndex: 'var(--z-topbar)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visibleTabs.map(tab => {
        const isActive = activeModule === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] transition-colors ${
              isActive ? 'text-brand-500' : 'text-slate-400'
            }`}
          >
            <tab.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* More tab — always visible */}
      <button
        onClick={onMorePress}
        className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] text-slate-400 transition-colors"
      >
        <Menu size={22} strokeWidth={1.5} />
        <span className="text-[10px] font-medium">Plus</span>
      </button>
    </nav>
  );
};
