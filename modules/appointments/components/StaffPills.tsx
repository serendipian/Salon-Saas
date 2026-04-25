import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { StaffAvatar } from '../../../components/StaffAvatar';
import type { StaffMember } from '../../../types';

interface StaffPillsProps {
  team: StaffMember[];
  categoryId: string | null;
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
  hideLabel?: boolean;
  /**
   * Optional: when supplied, returns true if the staff is available for the
   * current slot. Pills for unavailable staff are dimmed and show an
   * "Indisponible" subtitle. Returning true (or omitting the prop) renders
   * the pill normally. Pills stay clickable either way — the user might pick
   * a staff first and adjust the time afterward.
   */
  isStaffAvailable?: (staffId: string) => boolean;
}

export default function StaffPills({
  team,
  categoryId,
  selectedStaffId,
  onSelect,
  hideLabel,
  isStaffAvailable,
}: StaffPillsProps) {
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
          const available = isStaffAvailable ? isStaffAvailable(member.id) : true;
          const label = member.lastName
            ? `${member.firstName} ${member.lastName[0]}.`
            : member.firstName;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : member.id)}
              className={`px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-blue-500 text-white font-medium shadow-sm'
                  : available
                    ? 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                    : 'bg-white border border-amber-200 text-slate-500 opacity-70 hover:border-amber-300'
              }`}
            >
              <StaffAvatar
                firstName={member.firstName}
                lastName={member.lastName}
                photoUrl={member.photoUrl}
                color={isSelected ? 'rgba(255,255,255,0.3)' : 'bg-blue-100 text-blue-700'}
                size={20}
              />
              <span className="flex flex-col items-start leading-tight">
                <span>{label}</span>
                {!isSelected && !available && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                    <Clock size={10} />
                    Indisponible
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
