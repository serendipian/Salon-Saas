import type React from 'react';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { AppointmentStatus, type ServiceCategory, type StaffMember } from '../../../types';

type StatusFilter = 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS;

interface AppointmentFiltersProps {
  staff: StaffMember[];
  categories: ServiceCategory[];
  staffValue: string;
  categoryValue: string;
  statusValue: StatusFilter;
  onStaffChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  onReset: () => void;
}

const chipBase =
  'shrink-0 snap-start px-3 min-h-[36px] rounded-full text-xs font-medium transition-colors flex items-center gap-1.5';
const chipActive = 'bg-slate-900 text-white';
const chipIdle = 'bg-slate-100 text-slate-700 hover:bg-slate-200';

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${chipBase} ${active ? chipActive : chipIdle}`}
  >
    {children}
  </button>
);

export const AppointmentFilters: React.FC<AppointmentFiltersProps> = ({
  staff,
  categories,
  staffValue,
  categoryValue,
  statusValue,
  onStaffChange,
  onCategoryChange,
  onStatusChange,
  onReset,
}) => {
  const { isMobile } = useMediaQuery();
  const anyActive = staffValue !== 'ALL' || categoryValue !== 'ALL' || statusValue !== 'ALL';

  const hasStaffOptions = staff.length > 0;
  const hasCategoryOptions = categories.length > 0;
  if (!hasStaffOptions && !hasCategoryOptions) return null;

  const rowClass = `flex gap-2 ${isMobile ? 'overflow-x-auto snap-x scrollbar-hide' : 'flex-wrap'}`;

  return (
    <div className="mb-4 space-y-2">
      {hasStaffOptions && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium w-20 shrink-0">Employé</span>
          <div className={rowClass}>
            <Chip active={staffValue === 'ALL'} onClick={() => onStaffChange('ALL')}>
              Tous
            </Chip>
            {staff.map((s) => (
              <Chip
                key={s.id}
                active={staffValue === s.id}
                onClick={() => onStaffChange(s.id)}
              >
                {s.photoUrl ? (
                  <img
                    src={s.photoUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : null}
                <span>{s.firstName}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {hasCategoryOptions && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium w-20 shrink-0">Catégorie</span>
          <div className={rowClass}>
            <Chip active={categoryValue === 'ALL'} onClick={() => onCategoryChange('ALL')}>
              Toutes
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c.id}
                active={categoryValue === c.id}
                onClick={() => onCategoryChange(c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium w-20 shrink-0">Statut</span>
        <div className={`${rowClass} flex-1`}>
          <Chip active={statusValue === 'ALL'} onClick={() => onStatusChange('ALL')}>
            Tous
          </Chip>
          <Chip
            active={statusValue === AppointmentStatus.SCHEDULED}
            onClick={() => onStatusChange(AppointmentStatus.SCHEDULED)}
          >
            Planifié
          </Chip>
          <Chip
            active={statusValue === AppointmentStatus.IN_PROGRESS}
            onClick={() => onStatusChange(AppointmentStatus.IN_PROGRESS)}
          >
            En cours
          </Chip>
        </div>
        {anyActive && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold shrink-0"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
};
