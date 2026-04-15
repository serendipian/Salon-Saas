import { ChevronRight, Plus, } from 'lucide-react';
import type React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

export const SalonPickerPage: React.FC = () => {
  const { isAuthenticated, isLoading, memberships, activeSalon, switchSalon, signOut, profile } =
    useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  if (memberships.length === 0) {
    return <Navigate to="/create-salon" replace />;
  }

  if (activeSalon) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSelect = (salonId: string) => {
    switchSalon(salonId);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Choisir un salon</h1>
          <p className="text-sm text-slate-500 mt-1">Sélectionnez l'espace de travail</p>
        </div>

        <div className="space-y-3">
          {memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.salon_id)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md">
                {m.salon.logo_url ? (
                  <img
                    src={m.salon.logo_url}
                    alt=""
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  m.salon.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-slate-900">{m.salon.name}</div>
                <div className="text-xs text-slate-500">{ROLE_LABELS[m.role] || m.role}</div>
              </div>
              <ChevronRight
                size={18}
                className="text-slate-300 group-hover:text-slate-500 transition-colors"
              />
            </button>
          ))}

          <button
            onClick={() => navigate('/create-salon')}
            className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-100 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-slate-600 shrink-0">
              <Plus size={20} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-slate-600">Créer un nouveau salon</div>
            </div>
          </button>
        </div>

        <button
          onClick={signOut}
          className="block mx-auto mt-8 text-sm text-slate-500 hover:text-slate-700 underline"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};
