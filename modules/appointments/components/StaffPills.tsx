import React, { useMemo } from 'react';
import type { StaffMember } from '../../../types';

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
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Praticien</div>
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] transition-colors ${
            selectedStaffId === null
              ? 'bg-pink-500 text-white font-semibold'
              : 'bg-slate-950 border border-slate-600 text-slate-300 hover:border-slate-400'
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
              className={`px-3 py-1.5 rounded-full text-[11px] transition-colors flex items-center gap-1 ${
                isSelected
                  ? 'bg-pink-500 text-white font-medium'
                  : 'bg-slate-950 border border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {label}
              {isSelected && <span className="opacity-70 ml-0.5">✕</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
