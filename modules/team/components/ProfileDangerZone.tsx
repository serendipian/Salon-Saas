import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { StaffMember } from '../../../types';

interface ProfileDangerZoneProps {
  staff: StaffMember;
  onArchive: () => void;
}

export const ProfileDangerZone: React.FC<ProfileDangerZoneProps> = ({ staff, onArchive }) => {
  const [dangerOpen, setDangerOpen] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  return (
    <div className="bg-red-50/50 rounded-xl border border-red-200 p-6">
      <button
        type="button"
        onClick={() => setDangerOpen(!dangerOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-lg font-semibold text-red-900">Zone de danger</h3>
        {dangerOpen ? (
          <ChevronDown size={18} className="text-red-400" />
        ) : (
          <ChevronRight size={18} className="text-red-400" />
        )}
      </button>

      {dangerOpen && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-red-700">
            L'archivage retire ce membre de l'equipe active. Cette action peut etre annulee par un
            administrateur.
          </p>

          {!showArchiveConfirm ? (
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <AlertTriangle size={16} />
              Archiver ce membre
            </button>
          ) : (
            <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-900">
                Confirmer l'archivage de {staff.firstName} {staff.lastName} ?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onArchive();
                    setShowArchiveConfirm(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
