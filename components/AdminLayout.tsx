// components/AdminLayout.tsx
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, CreditCard, UserPlus, TrendingDown, LogOut, Search, Settings, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/accounts', label: 'Comptes', icon: Users, end: false },
  { to: '/admin/trials', label: 'Essais', icon: Clock, end: false },
  { to: '/admin/billing', label: 'Facturation', icon: CreditCard, end: false },
  { to: '/admin/signups', label: 'Inscriptions', icon: UserPlus, end: false },
  { to: '/admin/churn', label: 'Résiliations', icon: TrendingDown, end: false },
];

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : profile?.email ?? '';

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Sidebar — WHITE like Stripe */}
      <aside
        className="w-[220px] shrink-0 flex flex-col"
        style={{ backgroundColor: '#fff', borderRight: '1px solid #e3e8ef' }}
      >
        {/* Logo */}
        <div className="h-[52px] flex items-center gap-2.5 px-4" style={{ borderBottom: '1px solid #e3e8ef' }}>
          <div
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-white text-[13px] font-bold shrink-0"
            style={{ backgroundColor: '#635bff' }}
          >
            L
          </div>
          <span className="text-[14px] font-semibold text-[#1a1f36] tracking-tight">Lumiere</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ml-auto"
            style={{ backgroundColor: '#f0efff', color: '#635bff' }}
          >
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <div
                  className="flex items-center gap-2.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer"
                  style={{
                    color: isActive ? '#635bff' : '#6b7c93',
                    backgroundColor: isActive ? 'rgba(99,91,255,0.08)' : 'transparent',
                    paddingLeft: isActive ? 9 : 12,
                    paddingRight: 12,
                    borderLeft: isActive ? '3px solid #635bff' : '3px solid transparent',
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: '#e3e8ef', margin: '0 12px' }} />

        {/* User */}
        <div className="p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
              style={{ backgroundColor: '#635bff' }}
            >
              {displayName[0]?.toUpperCase() ?? 'A'}
            </div>
            <span className="text-[12px] truncate flex-1" style={{ color: '#697386' }}>{displayName}</span>
            <button
              onClick={handleSignOut}
              title="Se déconnecter"
              className="transition-opacity hover:opacity-100 opacity-50"
              style={{ color: '#697386' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right column: topbar + content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header
          className="h-[52px] shrink-0 flex items-center gap-3 px-6"
          style={{ backgroundColor: '#fff', borderBottom: '1px solid #e3e8ef' }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#c1cfe0' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="h-9 pl-9 pr-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none w-64 placeholder:text-[#c1cfe0] transition-all"
              style={{ color: '#1a1f36' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#635bff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.15)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e3e8ef'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <div className="flex-1" />
          <button className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#f7fafc] transition-colors" style={{ color: '#697386' }}>
            <Bell className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#f7fafc] transition-colors" style={{ color: '#697386' }}>
            <Settings className="w-4 h-4" />
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto min-w-0" style={{ backgroundColor: '#fff' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
