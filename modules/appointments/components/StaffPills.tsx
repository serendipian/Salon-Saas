import React, { useMemo } from 'react';
import type { StaffMember } from '../../../types';
import { StaffAvatar } from '../../../components/StaffAvatar';

interface StaffPillsProps {
  team: StaffMember[];
  categoryId: string | null;
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
}

export default function StaffPills({ team, categoryId, selectedStaffId, onSelect }: StaffPillsProps) {
  const eligibleStaff = useMemo(() => {
    if (!categoryId) return team.filter((m) => m.active);
    return team.filter((m) => m.active && m.skills.includes(categoryId));
  }, [team, categoryId]);

  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Praticien</div>
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] transition-colors ${
            selectedStaffId === null
              ? 'bg-pink-400 text-white font-semibold'
              : 'bg-slate-50 border border-slate-300 text-slate-700 hover:border-slate-400'
          }`}
        >
          N'importe qui
        </button>
        {eligibleStaff.map((member) => {
          const isSelected = member.id === selectedStaffId;
          const label = `${member.firstName} ${member.lastName[0]}.`;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : member.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-pink-400 text-white font-medium'
                  : 'bg-slate-50 border border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              <StaffAvatar
                firstName={member.firstName}
                lastName={member.lastName}
                photoUrl={member.photoUrl}
                color={isSelected ? 'rgba(255,255,255,0.3)' : member.color}
                size={18}
              />
              {label}
              {isSelected && <span className="opacity-70 ml-0.5">✕</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
