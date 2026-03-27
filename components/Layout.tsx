import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Scissors,
  Calendar,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Search,
  Settings,
  Truck,
  Smile,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useMediaQuery } from '../context/MediaQueryContext';
import { useSidebar } from '../hooks/useSidebar';
import { ConnectionStatusDot, ConnectionBanner } from './ConnectionStatus';
import { BottomTabBar } from './BottomTabBar';
import { MobileDrawer } from './MobileDrawer';
import type { AuthResource } from '../lib/auth.types';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onNavigate: (module: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  resource: AuthResource;
}

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed,
}) => (
  <button
    onClick={onClick}
    className={`
      group relative flex items-center w-full rounded-xl transition-all duration-200 ease-out my-1
      ${collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3 gap-3.5'}
      ${active
        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }
    `}
    title={collapsed ? label : ''}
  >
    <Icon
      size={collapsed ? 24 : 20}
      strokeWidth={active ? 2 : 1.5}
      className={`
        shrink-0 transition-colors duration-200
        ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}
      `}
    />
    {!collapsed && (
      <span className={`text-sm font-medium tracking-wide whitespace-nowrap ${active ? 'font-semibold' : ''}`}>
        {label}
      </span>
    )}
    {collapsed && active && (
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-slate-900 rounded-l-full" />
    )}
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onNavigate }) => {
  const { profile, activeSalon, role, memberships, switchSalon, signOut } = useAuth();
  const { can } = usePermissions(role);
  const { isMobile } = useMediaQuery();
  const sidebar = useSidebar();
  const [showSalonMenu, setShowSalonMenu] = useState(false);

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
    { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
    { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
    { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
    { id: 'accounting', label: 'Finances', icon: BarChart3, resource: 'accounting' },
  ];

  const managementNavItems: NavItem[] = [
    { id: 'team', label: 'Équipe', icon: Smile, resource: 'team' },
    { id: 'services', label: 'Services', icon: Scissors, resource: 'services' },
    { id: 'products', label: 'Produits', icon: ShoppingBag, resource: 'products' },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck, resource: 'suppliers' },
  ];

  const visibleMainNav = mainNavItems.filter(item => can('view', item.resource));
  const visibleMgmtNav = managementNavItems.filter(item => can('view', item.resource));
  const canViewSettings = can('view', 'settings');

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    : '...';
  const initials = profile
    ? `${(profile.first_name || '?')[0]}${(profile.last_name || '?')[0]}`.toUpperCase()
    : '??';
  const roleLabel = role ? ROLE_LABELS[role] || role : '';

  const collapsed = sidebar.mode === 'collapsed';

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      {/* Sidebar — hidden on mobile */}
      {!isMobile && (
        <aside
          className={`bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] relative shadow-[4px_0_24px_-12px_rgba(0,0,0,0.02)] ${
            collapsed ? 'w-24' : 'w-72'
          }`}
          style={{ zIndex: 'var(--z-sidebar)' }}
        >
          {/* Header: Salon name + switcher */}
          <div className={`h-20 flex items-center transition-all shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
            {!collapsed && (
              <div className="relative flex items-center gap-3 animate-in fade-in duration-300">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md shadow-slate-900/20">
                  {activeSalon?.name ? activeSalon.name.charAt(0) : 'L'}
                </div>
                <div className="flex flex-col">
                  {memberships.length > 1 ? (
                    <button
                      onClick={() => setShowSalonMenu(!showSalonMenu)}
                      className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                        {activeSalon?.name || 'Salon'}
                      </span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </button>
                  ) : (
                    <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                      {activeSalon?.name || 'Salon'}
                    </span>
                  )}
                </div>

                {showSalonMenu && memberships.length > 1 && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2" style={{ zIndex: 'var(--z-drawer-panel)' }}>
                    {memberships.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          switchSalon(m.salon_id);
                          setShowSalonMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                          m.salon_id === activeSalon?.id ? 'bg-slate-50 font-medium' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {m.salon.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-slate-900">{m.salon.name}</div>
                          <div className="text-xs text-slate-400">{ROLE_LABELS[m.role]}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={sidebar.toggleExpanded}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all ${collapsed ? 'mx-auto' : ''}`}
            >
              {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-1">
            {!collapsed && (
              <div className="px-4 mb-4 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Menu Principal
              </div>
            )}
            {visibleMainNav.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeModule === item.id}
                onClick={() => onNavigate(item.id)}
                collapsed={collapsed}
              />
            ))}
          </div>

          {/* Footer: Management & Settings */}
          <div className="p-4 border-t border-slate-100 bg-white space-y-1">
            {!collapsed && visibleMgmtNav.length > 0 && (
              <div className="px-4 mb-2 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Gestion
              </div>
            )}
            {visibleMgmtNav.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeModule === item.id}
                onClick={() => onNavigate(item.id)}
                collapsed={collapsed}
              />
            ))}

            {canViewSettings && (
              <>
                {visibleMgmtNav.length > 0 && <div className="my-2 border-t border-slate-50 mx-2" />}
                <SidebarItem
                  icon={Settings}
                  label="Réglages"
                  active={activeModule === 'settings'}
                  onClick={() => onNavigate('settings')}
                  collapsed={collapsed}
                />
              </>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Wrapper */}
      <div id="main-content" className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Top Bar */}
        <header
          className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0"
          style={{ zIndex: 'var(--z-topbar)' }}
        >
          {isMobile ? (
            <>
              {/* Mobile top bar: hamburger + logo + bell */}
              <button
                onClick={sidebar.openDrawer}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Ouvrir le menu"
              >
                <Menu size={22} strokeWidth={1.5} />
              </button>
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                {activeSalon?.name || 'Lumiere'}
              </span>
              <div className="flex items-center gap-1">
                <ConnectionStatusDot />
                <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <Bell size={20} strokeWidth={1.5} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Desktop top bar */}
              <div className="relative max-w-md w-full hidden md:block group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={18} strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Rechercher (Clients, Services, Factures...)"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none ring-1 ring-transparent focus:ring-slate-200 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-5 ml-auto">
                <ConnectionStatusDot />
                <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
                  <Bell size={20} strokeWidth={1.5} />
                </button>

                <div className="h-8 w-px bg-slate-200" />

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block leading-tight">
                    <div className="text-sm font-bold text-slate-800">{displayName}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{roleLabel}</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                    <span className="font-bold text-sm">{initials}</span>
                  </div>
                  <button
                    onClick={signOut}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-all"
                    title="Se déconnecter"
                  >
                    <LogOut size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </>
          )}
        </header>

        <ConnectionBanner />

        {/* Scrollable Content */}
        <main
          className={`flex-1 overflow-auto relative p-4 md:p-6 scroll-smooth custom-scrollbar ${
            isMobile ? 'pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]' : ''
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile-only: Bottom Tab Bar */}
      {isMobile && (
        <BottomTabBar
          activeModule={activeModule}
          onNavigate={onNavigate}
          onMorePress={sidebar.openDrawer}
          can={can}
        />
      )}

      {/* Mobile-only: Drawer */}
      {isMobile && (
        <MobileDrawer
          isOpen={sidebar.isDrawerOpen}
          onClose={sidebar.closeDrawer}
          activeModule={activeModule}
          onNavigate={onNavigate}
          mainNavItems={visibleMainNav}
          managementNavItems={visibleMgmtNav}
          settingsItem={canViewSettings ? { id: 'settings', label: 'Réglages', icon: Settings } : undefined}
          salonName={activeSalon?.name || 'Salon'}
        />
      )}

      {/* Click-outside to close salon menu (desktop only) */}
      {showSalonMenu && !isMobile && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-topbar)' }} onClick={() => setShowSalonMenu(false)} />
      )}
    </div>
  );
};
