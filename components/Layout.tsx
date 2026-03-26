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
  User,
  LogOut
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onNavigate: (module: string) => void;
}

interface SidebarItemProps {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  collapsed 
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
    
    {/* Active Indicator for Collapsed State */}
    {collapsed && active && (
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-slate-900 rounded-l-full" />
    )}
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onNavigate }) => {
  const { salonSettings } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);

  const mainNavItems = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'calendar', label: 'Agenda', icon: Calendar },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'pos', label: 'Caisse', icon: CreditCard },
    { id: 'accounting', label: 'Finances', icon: BarChart3 },
  ];

  const managementNavItems = [
    { id: 'team', label: 'Équipe', icon: Smile },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'products', label: 'Produits', icon: ShoppingBag },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
  ];

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside 
        className={`
          bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] z-30 relative shadow-[4px_0_24px_-12px_rgba(0,0,0,0.02)]
          ${collapsed ? 'w-24' : 'w-72'}
        `}
      >
        {/* Header: Logo */}
        <div className={`h-20 flex items-center transition-all shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          
          {!collapsed && (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md shadow-slate-900/20">
                {salonSettings?.name ? salonSettings.name.charAt(0) : 'L'}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                  {salonSettings?.name || 'Lumière'}
                </span>
              </div>
            </div>
          )}

          {/* Header Toggle Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`
              p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all
              ${collapsed ? 'mx-auto' : ''}
            `}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-1">
            {!collapsed && (
              <div className="px-4 mb-4 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Menu Principal
              </div>
            )}
            
            {mainNavItems.map(item => (
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

        {/* Footer: Management & Settings (Pinned) */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-1">
           {!collapsed && (
              <div className="px-4 mb-2 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Gestion
              </div>
           )}

           {managementNavItems.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeModule === item.id}
                onClick={() => onNavigate(item.id)}
                collapsed={collapsed}
              />
           ))}

           <div className="my-2 border-t border-slate-50 mx-2"></div>

           <SidebarItem
              icon={Settings}
              label="Réglages"
              active={activeModule === 'settings'}
              onClick={() => onNavigate('settings')}
              collapsed={collapsed}
           />
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        
        {/* Top Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0 z-20 sticky top-0">
           {/* Left: Global Search */}
           <div className="relative max-w-md w-full hidden md:block group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={18} strokeWidth={1.5} />
              <input 
                type="text" 
                placeholder="Rechercher (Clients, Services, Factures...)" 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none ring-1 ring-transparent focus:ring-slate-200 focus:bg-white transition-all placeholder:text-slate-400"
              />
           </div>

           {/* Right: Actions & Profile */}
           <div className="flex items-center gap-5 ml-auto">
              <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
                 <Bell size={20} strokeWidth={1.5} />
                 <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
              </button>
              
              <div className="h-8 w-px bg-slate-200"></div>

              <div className="flex items-center gap-3">
                 <div className="text-right hidden sm:block leading-tight">
                    <div className="text-sm font-bold text-slate-800">Marie Dupont</div>
                    <div className="text-[11px] text-slate-500 font-medium">Propriétaire</div>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md ring-2 ring-white cursor-pointer hover:scale-105 transition-transform">
                    <span className="font-bold text-sm">MD</span>
                 </div>
              </div>
           </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto relative p-6 scroll-smooth custom-scrollbar">
           {children}
        </main>
      </div>
    </div>
  );
};