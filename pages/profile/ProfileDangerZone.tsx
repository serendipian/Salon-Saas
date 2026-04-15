import React, { useState } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const ProfileDangerZone: React.FC = () => {
  const { activeSalon, memberships, user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const salonId = activeSalon?.id ?? '';
  const currentMembership = memberships.find((m) => m.salon_id === salonId);

  // Check if the user is the sole owner by querying all owners in the salon
  const isOwner = currentMembership?.role === 'owner';
  const { data: isSoleOwner = isOwner } = useQuery({
    queryKey: ['sole-owner-check', salonId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('salon_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('role', 'owner')
        .is('deleted_at', null);
      if (error) return true; // Err on the safe side
      return (count ?? 0) <= 1;
    },
    enabled: !!salonId && isOwner,
  });

  if (isSoleOwner || !currentMembership) return null;

  const handleLeave = async () => {
    setIsLeaving(true);
    const { error } = await supabase.rpc('leave_salon', { p_salon_id: salonId });

    setIsLeaving(false);

    if (error) {
      addToast({ type: 'error', message: 'Impossible de quitter le salon' });
      return;
    }

    addToast({ type: 'success', message: 'Vous avez quitté le salon' });

    // Sign out to clear all stale state (activeSalon, memberships, etc.)
    // The user will be redirected to login and can re-authenticate cleanly
    await supabase.auth.signOut();
  };

  return (
    <div className="bg-white p-6 rounded-xl border-2 border-red-200 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-500" />
        <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide">Zone Dangereuse</h2>
      </div>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all"
        >
          <LogOut size={16} />
          Quitter ce salon
        </button>
      ) : (
        <div className="p-4 bg-red-50 rounded-xl space-y-3">
          <p className="text-sm text-red-700">
            Vous perdrez l'accès à <strong>{activeSalon?.name}</strong>. Cette action est
            irréversible.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleLeave}
              disabled={isLeaving}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
            >
              {isLeaving ? 'En cours...' : 'Quitter'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
