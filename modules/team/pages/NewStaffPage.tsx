
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { TeamForm } from '../components/TeamForm';
import { useTeam } from '../hooks/useTeam';
import type { StaffMember } from '../../../types';

export const NewStaffPage: React.FC = () => {
  const navigate = useNavigate();
  const { addStaffMember } = useTeam();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (member: StaffMember) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await addStaffMember(member);
      if (result?.id) {
        navigate(`/team/${result.id}`);
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
      <TeamForm onSave={handleSave} onCancel={() => navigate('/team')} isSubmitting={isSubmitting} />
    </div>
  );
};
