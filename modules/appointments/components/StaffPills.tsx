import React, { useMemo } from 'react';
import type { StaffMember } from '../../../types';
import { StaffAvatar } from '../../../components/StaffAvatar';

interface StaffPillsProps {
  team: StaffMember[];
  categoryId: string | null;
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
  hideLabel?: boolean;
}

export default function StaffPills({ team, categoryId, selectedStaffId, onSelect, hideLabel }: StaffPillsProps) {
  const eligibleStaff = useMemo(() => {
    if (!categoryId) return team.filter((m) => m.active);
    return team.filter((m) => m.active && m.skills.includes(categoryId));
  }, [team, categoryId]);

  return (
    <div>
      {!hideLabel && <div className="text-xs font-medium text-slate-500 mb-2">Équipe</div>}
      <div className="flex gap-2 flex-wrap">
        {eligibleStaff.map((member) => {
          const isSelected = member.id === selectedStaffId;
          const label = member.lastName ? `${member.firstName} ${member.lastName[0]}.` : member.firstName;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : member.id)}
              className={`px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-blue-500 text-white font-medium shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <StaffAvatar
                firstName={member.firstName}
                lastName={member.lastName}
                photoUrl={member.photoUrl}
                color={isSelected ? 'rgba(255,255,255,0.3)' : 'bg-blue-100 text-blue-700'}
                size={20}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
