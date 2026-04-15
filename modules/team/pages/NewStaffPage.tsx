import { ChevronLeft } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import type { StaffMember } from '../../../types';
import { TeamForm } from '../components/TeamForm';
import { useTeam } from '../hooks/useTeam';

export const NewStaffPage: React.FC = () => {
  const navigate = useNavigate();
  const { addStaffMember } = useTeam();
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (member: StaffMember) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await addStaffMember(member);
      if (result && 'piiError' in result && result.piiError) {
        addToast({
          type: 'warning',
          message:
            "Membre créé, mais les données sensibles (salaire, IBAN) n'ont pas pu être enregistrées. Veuillez les saisir dans l'onglet Profil.",
        });
      }
      if (result?.slug) {
        await navigate(`/team/${result.slug}`);
      } else if (result?.id) {
        await navigate(`/team/${result.id}`);
      }
    } catch {
      // Error toast is handled by the mutation's onError callback
      // Stay on the form so the user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/team')}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour
      </button>
      <TeamForm
        onSave={handleSave}
        onCancel={() => navigate('/team')}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
