import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Search,
  Settings,
  ShoppingBag,
  Smile,
  Truck,
  UserCircle,
  Users,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../context/MediaQueryContext';
import { usePermissions } from '../hooks/usePermissions';
import { useSidebar } from '../hooks/useSidebar';
import type { AuthResource } from '../lib/auth.types';
import { PastDueBanner } from '../modules/billing/components/PastDueBanner';
import { useBilling } from '../modules/billing/hooks/useBilling';
import { BottomTabBar } from './BottomTabBar';
import { ConnectionBanner, ConnectionStatusDot } from './ConnectionStatus';
import { MobileDrawer } from './MobileDrawer';

const PastDueBannerConnected: React.FC = () => {
  const { createPortalSession, isLoadingPortal } = useBilling();
  return <PastDueBanner onFixClick={createPortalSession} isLoading={isLoadingPortal} />;
};

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
      ${
        active
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
      <span
        className={`text-sm font-medium tracking-wide whitespace-nowrap ${active ? 'font-semibold' : ''}`}
      >
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
  const navigate = useNavigate();
  const sidebar = useSidebar();
  const [showSalonMenu, setShowSalonMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showProfileMenu]);

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
    { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
    { id: 'appointments', label: 'Rendez-vous', icon: ClipboardList, resource: 'appointments' },
    { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
    { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
    { id: 'finances', label: 'Finances', icon: BarChart3, resource: 'accounting' },
  ];

  const financesSubItems = [
    { id: 'finances/revenus', label: 'Revenus' },
    { id: 'finances/depenses', label: 'Dépenses' },
    { id: 'finances/journal', label: 'Journal' },
    { id: 'finances/annulations', label: 'Annulations' },
  ];

  const managementNavItems: NavItem[] = [
    { id: 'team', label: 'Équipe', icon: Smile, resource: 'team' },
    { id: 'services', label: 'Services', icon: Scissors, resource: 'services' },
    { id: 'products', label: 'Produits', icon: ShoppingBag, resource: 'products' },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck, resource: 'suppliers' },
  ];

  const visibleMainNav = mainNavItems.filter((item) => can('view', item.resource));
  const visibleMgmtNav = managementNavItems.filter((item) => can('view', item.resource));
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
    <div className="flex h-screen bg-[#f7f2ea] overflow-hidden font-sans text-slate-900">
      {/* Sidebar — hidden on mobile */}
      {!isMobile && (
        <aside
          className={`bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] relative shadow-[4px_0_24px_-12px_rgba(0,0,0,0.02)] ${
            collapsed ? 'w-24' : 'w-72'
          }`}
          style={{ zIndex: 'var(--z-sidebar)' }}
        >
          {/* Header: Salon name + switcher */}
          <div
            className={`h-20 flex items-center transition-all shrink-0 ${collapsed ? 'justify-center px-0' : 'px-6'}`}
          >
            {!collapsed ? (
              <div className="relative flex items-center gap-3 animate-in fade-in duration-300">
                {activeSalon?.logo_url ? (
                  <img
                    src={activeSalon.logo_url}
                    alt=""
                    className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md shadow-slate-900/20">
                    {activeSalon?.name ? activeSalon.name.charAt(0) : 'L'}
                  </div>
                )}
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
                  <div
                    className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2"
                    style={{ zIndex: 'var(--z-drawer-panel)' }}
                  >
                    {memberships.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          void switchSalon(m.salon_id);
                          setShowSalonMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                          m.salon_id === activeSalon?.id ? 'bg-slate-50 font-medium' : ''
                        }`}
                      >
                        {m.salon.logo_url ? (
                          <img
                            src={m.salon.logo_url}
                            alt=""
                            className="w-7 h-7 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {m.salon.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="text-slate-900">{m.salon.name}</div>
                          <div className="text-xs text-slate-400">{ROLE_LABELS[m.role]}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Collapsed: show salon initial */
              <div className="flex flex-col items-center gap-1">
                {activeSalon?.logo_url ? (
                  <img
                    src={activeSalon.logo_url}
                    alt=""
                    className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md shadow-slate-900/20">
                    {activeSalon?.name ? activeSalon.name.charAt(0) : 'L'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-1">
            {!collapsed && (
              <div className="px-4 mb-4 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Menu Principal
              </div>
            )}
            {visibleMainNav.map((item) => (
              <React.Fragment key={item.id}>
                <SidebarItem
                  icon={item.icon}
                  label={item.label}
                  active={activeModule === item.id || activeModule.startsWith(`${item.id}/`)}
                  onClick={() => onNavigate(item.id)}
                  collapsed={collapsed}
                />
                {/* Finances sub-items */}
                {item.id === 'finances' && !collapsed && (
                  <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5">
                    {financesSubItems.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => onNavigate(sub.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                          activeModule === sub.id
                            ? 'text-slate-900 bg-slate-100'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Footer: Management & Settings */}
          <div className="p-4 border-t border-slate-100 bg-white space-y-1">
            {!collapsed && visibleMgmtNav.length > 0 && (
              <div className="px-4 mb-2 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Gestion
              </div>
            )}
            {visibleMgmtNav.map((item) => (
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
                {visibleMgmtNav.length > 0 && (
                  <div className="my-2 border-t border-slate-50 mx-2" />
                )}
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
      <div id="main-content" className="flex-1 flex flex-col min-w-0 bg-[#f7f2ea]">
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
                {activeSalon?.name || 'BeautyFlow'}
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
              {/* Desktop/Tablet top bar */}
              <div className="flex items-center gap-3">
                <button
                  onClick={sidebar.toggleExpanded}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
                  aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
                >
                  {collapsed ? (
                    <PanelLeftOpen size={20} strokeWidth={1.5} />
                  ) : (
                    <PanelLeftClose size={20} strokeWidth={1.5} />
                  )}
                </button>
                <div className="relative max-w-md w-full hidden md:block group">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors"
                    size={18}
                    strokeWidth={1.5}
                  />
                  <input
                    type="search"
                    name="global-search"
                    aria-label="Rechercher dans l'application"
                    placeholder="Rechercher (Clients, Services, Factures...)"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none ring-1 ring-transparent focus:ring-slate-200 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-5 ml-auto">
                <ConnectionStatusDot />
                <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
                  <Bell size={20} strokeWidth={1.5} />
                </button>

                <div className="h-8 w-px bg-slate-200" />

                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <div className="text-right hidden sm:block leading-tight">
                      <div className="text-sm font-bold text-slate-800">{displayName}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{roleLabel}</div>
                    </div>
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-md"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                        <span className="font-bold text-sm">{initials}</span>
                      </div>
                    )}
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showProfileMenu && (
                    <div
                      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200/60 py-2"
                      style={{ zIndex: 'var(--z-dropdown, 50)' }}
                    >
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                        <span
                          className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            role === 'owner'
                              ? 'bg-slate-100 text-slate-700'
                              : role === 'manager'
                                ? 'bg-blue-50 text-blue-700'
                                : role === 'stylist'
                                  ? 'bg-violet-50 text-violet-700'
                                  : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {roleLabel}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          void navigate('/profile');
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        <UserCircle size={16} className="text-slate-400" />
                        Mon profil
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        onClick={() => {
                          void signOut();
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all"
                      >
                        <LogOut size={16} />
                        Déconnexion
                      </button>
                    </div>
                  )}
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
          {activeSalon?.subscription_tier === 'past_due' && <PastDueBannerConnected />}
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
          settingsItem={
            canViewSettings ? { id: 'settings', label: 'Réglages', icon: Settings } : undefined
          }
          salonName={activeSalon?.name || 'Salon'}
          onProfilePress={() => navigate('/profile')}
        />
      )}

      {/* Click-outside to close salon menu (desktop only) */}
      {showSalonMenu && !isMobile && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 'var(--z-topbar)' }}
          onClick={() => setShowSalonMenu(false)}
        />
      )}
    </div>
  );
};
