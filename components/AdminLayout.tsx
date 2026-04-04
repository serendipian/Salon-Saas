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

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-700">
          <span className="text-white font-extrabold text-base tracking-tight">Lumiere</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">ADMIN</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
              {profile?.first_name?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <span className="text-xs text-slate-300 truncate flex-1">
              {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : profile?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-white transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
