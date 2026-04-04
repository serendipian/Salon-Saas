// components/AdminLayout.tsx
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, CreditCard, UserPlus, TrendingDown, LogOut } from 'lucide-react';
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : profile?.email ?? '';

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#f6f9fc]"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col" style={{ backgroundColor: '#0a2540' }}>
        {/* Logo */}
        <div className="h-[60px] flex items-center gap-3 px-4">
          <div
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-white text-[13px] font-bold shrink-0"
            style={{ backgroundColor: '#635bff' }}
          >
            L
          </div>
          <span className="text-white text-[14px] font-semibold tracking-tight">Lumiere</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ml-auto"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
          >
            ADMIN
          </span>
        </div>

        {/* Thin divider */}
        <div className="h-px mx-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
            >
              {({ isActive }) => (
                <div
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer"
                  style={{
                    color: isActive ? '#ffffff' : '#8898aa',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom divider */}
        <div className="h-px mx-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* User + sign out */}
        <div className="p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
              style={{ backgroundColor: '#635bff' }}
            >
              {displayName[0]?.toUpperCase() ?? 'A'}
            </div>
            <span className="text-[12px] truncate flex-1" style={{ color: '#8898aa' }}>{displayName}</span>
            <button
              onClick={handleSignOut}
              title="Se déconnecter"
              className="transition-colors hover:opacity-100 opacity-60"
              style={{ color: '#c1cfe0' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
};
