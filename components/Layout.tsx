import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../context/MediaQueryContext';
import { PageHeaderProvider, usePageHeaderSlot } from '../context/PageHeaderContext';
import { useSalonPermissions } from '../hooks/useSalonPermissions';
import { useSidebar } from '../hooks/useSidebar';
import type { AuthResource } from '../lib/auth.types';
import { PastDueBanner } from '../modules/billing/components/PastDueBanner';
import { useBilling } from '../modules/billing/hooks/useBilling';
import { BottomTabBar } from './BottomTabBar';
import { ConnectionBanner, ConnectionStatusDot } from './ConnectionStatus';
import { PreviewBanner } from './PreviewBanner';
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
  /** Whether the sidebar is currently showing labels (hover-peek or pinned). */
  isOpen: boolean;
  onClick: () => void;
  /** If true, render a chevron toggle for an expandable submenu. */
  hasSubmenu?: boolean;
  submenuOpen?: boolean;
  onSubmenuToggle?: (e: React.MouseEvent) => void;
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
  isOpen,
  onClick,
  hasSubmenu,
  submenuOpen,
  onSubmenuToggle,
}) => (
  <div
    className={`
      group relative flex items-center w-full h-11 rounded-xl transition-colors duration-150
      ${active ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'}
    `}
  >
    {/* Active accent pill — sits at the sidebar's left edge, breaking out of the item's mx-3 padding. */}
    {active && (
      <span
        aria-hidden
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-blue-500"
      />
    )}
    <button
      onClick={onClick}
      className="flex-1 flex items-center h-full min-w-0 pl-[14px] pr-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
      title={!isOpen ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        size={20}
        strokeWidth={active ? 2 : 1.6}
        className={`shrink-0 transition-colors duration-150 ${
          active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'
        }`}
      />
      <span
        className={`
          ml-3 text-[13.5px] tracking-[-0.005em] whitespace-nowrap truncate
          transition-[opacity,transform] duration-200
          ${isOpen ? 'opacity-100 translate-x-0 delay-75' : 'opacity-0 -translate-x-1 pointer-events-none'}
          ${active ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium group-hover:text-slate-900'}
        `}
      >
        {label}
      </span>
    </button>
    {hasSubmenu && (
      <button
        onClick={onSubmenuToggle}
        aria-expanded={submenuOpen}
        aria-label={submenuOpen ? 'Masquer le sous-menu Finances' : 'Afficher le sous-menu Finances'}
        className={`
          mr-1.5 p-1.5 rounded-md text-slate-400 transition-all duration-200
          hover:bg-slate-100 hover:text-slate-700
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60
          ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <ChevronRight
          size={14}
          strokeWidth={2}
          className={`transition-transform duration-200 ${submenuOpen ? 'rotate-90' : ''}`}
        />
      </button>
    )}
  </div>
);

const LayoutInner: React.FC<LayoutProps> = ({ children, activeModule, onNavigate }) => {
  const { setSlot, count: pageHeaderCount } = usePageHeaderSlot();
  const { profile, activeSalon, role, memberships, switchSalon, signOut } = useAuth();
  const { can } = useSalonPermissions();
  const { isMobile, isTabletPortrait } = useMediaQuery();
  const navigate = useNavigate();
  const sidebar = useSidebar();
  const [showSalonMenu, setShowSalonMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Pin/hover state. The rail is the default; users can hover to peek, or click the
  // topbar toggle to pin it open. Tablet-portrait forces collapsed (no pin), but
  // hover-peek still works for that breakpoint.
  const isPinned = sidebar.isExpanded;
  const canPin = !isMobile && !isTabletPortrait;
  const [isHovering, setIsHovering] = useState(false);
  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const openOnHover = useCallback(() => {
    if (isPinned) return;
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    if (enterTimer.current || isHovering) return;
    enterTimer.current = window.setTimeout(() => {
      setIsHovering(true);
      enterTimer.current = null;
    }, 120);
  }, [isPinned, isHovering]);

  const closeOnHover = useCallback(() => {
    if (isPinned) return;
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    if (leaveTimer.current) return;
    leaveTimer.current = window.setTimeout(() => {
      setIsHovering(false);
      leaveTimer.current = null;
    }, 100);
  }, [isPinned]);

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  // When the user pins the sidebar (or unpins), kill any pending hover-peek timers so
  // the panel doesn't shimmy between hover-driven and pin-driven open states.
  useEffect(() => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setIsHovering(false);
  }, [isPinned]);

  // Finance submenu accordion. Always open by default so the 4 sub-items appear
  // immediately on hover-peek; user can still collapse it via the chevron.
  const [financeOpen, setFinanceOpen] = useState(true);

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

  // Effective open state: pinned (locked open) OR hovering (peek open).
  const isOpen = isPinned || isHovering;
  const railWidth = 72;
  const expandedWidth = 272;

  // Width that participates in flex layout. Hover-peek floats over content (only pin reflows).
  const reservedWidth = isPinned ? expandedWidth : railWidth;
  // Visible width of the fixed aside panel.
  const panelWidth = isOpen ? expandedWidth : railWidth;

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      {/* Layout spacer reserves room for the rail (or pinned panel). */}
      {!isMobile && (
        <div
          aria-hidden
          className="shrink-0 transition-[width] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: reservedWidth }}
        />
      )}

      {/* Fixed sidebar — overlays content on hover-peek, reflows on pin. */}
      {!isMobile && (
        <aside
          aria-label="Navigation principale"
          onMouseEnter={openOnHover}
          onMouseLeave={closeOnHover}
          onFocus={openOnHover}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closeOnHover();
          }}
          className="fixed inset-y-0 left-0 bg-white/95 backdrop-blur-sm border-r border-slate-100/80 flex flex-col transition-[width,box-shadow] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: panelWidth,
            zIndex: 'var(--z-sidebar)',
            boxShadow:
              isOpen && !isPinned
                ? '24px 0 48px -24px rgba(15, 23, 42, 0.12), 8px 0 16px -8px rgba(15, 23, 42, 0.04)'
                : '4px 0 24px -16px rgba(15, 23, 42, 0.04)',
          }}
        >
          {/* Salon header — logo fixed at left, name fades in. */}
          <div className="h-16 flex items-center shrink-0 relative">
            <div className="flex items-center w-full pl-[14px] pr-2">
              {activeSalon?.logo_url ? (
                <img
                  src={activeSalon.logo_url}
                  alt=""
                  className="w-9 h-9 rounded-[10px] object-cover shrink-0 shadow-sm ring-1 ring-slate-200/60"
                />
              ) : (
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center text-white font-bold text-[15px] shrink-0 shadow-sm ring-1 ring-slate-900/20 tracking-tight">
                  {activeSalon?.name ? activeSalon.name.charAt(0) : 'L'}
                </div>
              )}
              <div
                className={`ml-3 flex-1 min-w-0 transition-[opacity,transform] duration-200 ${
                  isOpen ? 'opacity-100 translate-x-0 delay-75' : 'opacity-0 -translate-x-1 pointer-events-none'
                }`}
              >
                {memberships.length > 1 ? (
                  <button
                    onClick={() => setShowSalonMenu(!showSalonMenu)}
                    className="flex items-center gap-1 max-w-full hover:opacity-70 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 rounded"
                  >
                    <span className="font-bold text-[15px] tracking-tight text-slate-900 leading-none truncate">
                      {activeSalon?.name || 'Salon'}
                    </span>
                    <ChevronDown size={13} className="text-slate-400 shrink-0" strokeWidth={2} />
                  </button>
                ) : (
                  <span className="font-bold text-[15px] tracking-tight text-slate-900 leading-none truncate block">
                    {activeSalon?.name || 'Salon'}
                  </span>
                )}
                {role && (
                  <span className="block text-[10.5px] font-medium text-slate-400 tracking-[0.04em] mt-0.5 truncate">
                    {ROLE_LABELS[role] || role}
                  </span>
                )}
              </div>
            </div>

            {/* Salon switcher dropdown — only when expanded. */}
            {showSalonMenu && isOpen && memberships.length > 1 && (
              <div
                className="absolute top-full left-3 mt-1 w-[244px] bg-white rounded-xl border border-slate-200/80 shadow-[0_20px_48px_-16px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.06)] py-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
                style={{ zIndex: 'var(--z-drawer-panel)' }}
              >
                {memberships.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      void switchSalon(m.salon_id);
                      setShowSalonMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2.5 ${
                      m.salon_id === activeSalon?.id ? 'bg-blue-50/40' : ''
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
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-900 font-medium truncate text-[13px]">
                        {m.salon.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {ROLE_LABELS[m.role]}
                      </div>
                    </div>
                    {m.salon_id === activeSalon?.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hairline separator under the header. */}
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-slate-200/70 to-transparent" />

          {/* Main navigation. */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-2 px-3 custom-scrollbar">
            <div
              className={`h-4 mb-2 pl-[14px] text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-opacity duration-200 ${
                isOpen ? 'opacity-100 delay-100' : 'opacity-0'
              }`}
            >
              Menu principal
            </div>

            <ul className="space-y-0.5">
              {visibleMainNav.map((item) => {
                const isActive =
                  activeModule === item.id || activeModule.startsWith(`${item.id}/`);
                const isFinance = item.id === 'finances';
                return (
                  <li key={item.id}>
                    <SidebarItem
                      icon={item.icon}
                      label={item.label}
                      active={isActive}
                      isOpen={isOpen}
                      onClick={() => onNavigate(item.id)}
                      hasSubmenu={isFinance}
                      submenuOpen={financeOpen}
                      onSubmenuToggle={(e) => {
                        e.stopPropagation();
                        setFinanceOpen((v) => !v);
                      }}
                    />
                    {isFinance && (
                      <div
                        className="overflow-hidden transition-[max-height,opacity] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{
                          maxHeight:
                            isOpen && financeOpen ? `${financesSubItems.length * 32 + 8}px` : '0',
                          opacity: isOpen && financeOpen ? 1 : 0,
                        }}
                        aria-hidden={!isOpen || !financeOpen}
                      >
                        <ul className="mt-1 ml-[27px] pl-3 border-l border-slate-200/70 py-1 space-y-px">
                          {financesSubItems.map((sub) => {
                            const isSubActive = activeModule === sub.id;
                            return (
                              <li key={sub.id}>
                                <button
                                  onClick={() => onNavigate(sub.id)}
                                  tabIndex={isOpen && financeOpen ? 0 : -1}
                                  className={`relative w-full text-left pl-3 pr-2 py-1.5 rounded-md text-[12.5px] tracking-[-0.005em] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 ${
                                    isSubActive
                                      ? 'text-slate-900 font-semibold'
                                      : 'text-slate-500 hover:text-slate-900 font-medium'
                                  }`}
                                >
                                  {isSubActive && (
                                    <span
                                      aria-hidden
                                      className="absolute -left-[13px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 ring-2 ring-white"
                                    />
                                  )}
                                  {sub.label}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

          </nav>

          {/* Footer — Gestion group (management items + Settings), anchored to bottom. */}
          {(visibleMgmtNav.length > 0 || canViewSettings) && (
            <div className="shrink-0 px-3 pt-3 pb-2 border-t border-slate-100/80">
              <div
                className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                  isOpen ? 'max-h-6 opacity-100 delay-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="h-4 mb-2 pl-[14px] text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Gestion
                </div>
              </div>
              <ul className="space-y-0.5">
                {visibleMgmtNav.map((item) => (
                  <li key={item.id}>
                    <SidebarItem
                      icon={item.icon}
                      label={item.label}
                      active={activeModule === item.id}
                      isOpen={isOpen}
                      onClick={() => onNavigate(item.id)}
                    />
                  </li>
                ))}
                {canViewSettings && (
                  <li>
                    <SidebarItem
                      icon={Settings}
                      label="Réglages"
                      active={activeModule === 'settings' || activeModule.startsWith('settings/')}
                      isOpen={isOpen}
                      onClick={() => onNavigate('settings')}
                    />
                  </li>
                )}
              </ul>
            </div>
          )}
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
                {canPin && (
                  <button
                    onClick={sidebar.toggleExpanded}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                    aria-label={isPinned ? 'Replier le menu' : 'Épingler le menu'}
                    title={isPinned ? 'Replier le menu' : 'Épingler le menu'}
                  >
                    {isPinned ? (
                      <PanelLeftClose size={20} strokeWidth={1.5} />
                    ) : (
                      <PanelLeftOpen size={20} strokeWidth={1.5} />
                    )}
                  </button>
                )}
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

        {/* Shared page title bar — full-bleed white strip flush under the topbar.
            Content is portaled in by each page's <PageHeader>; hidden when empty. */}
        <div
          ref={setSlot}
          className={
            pageHeaderCount > 0
              ? 'shrink-0 bg-white border-b border-slate-200/70'
              : 'hidden'
          }
        />

        {/* Scrollable Content */}
        <main
          className={`flex-1 overflow-auto relative p-4 md:p-6 scroll-smooth custom-scrollbar ${
            isMobile ? 'pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]' : ''
          }`}
        >
          {activeSalon?.subscription_tier === 'past_due' && <PastDueBannerConnected />}
          <PreviewBanner />
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

export const Layout: React.FC<LayoutProps> = (props) => (
  <PageHeaderProvider>
    <LayoutInner {...props} />
  </PageHeaderProvider>
);
