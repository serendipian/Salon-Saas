// pages/SuspendedPage.tsx
import React from 'react';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SuspendedPage: React.FC = () => {
  const { signOut } = useAuth();
  return (
    <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-rose-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Compte suspendu</h1>
        <p className="text-sm text-slate-500">
          L'accès à ce salon a été suspendu. Contactez le support pour plus d'informations.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-2 text-sm text-slate-500 underline hover:text-slate-700"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};
