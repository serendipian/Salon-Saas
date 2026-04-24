import type React from 'react';
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

const CHIP_BASE =
  'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0';
const CHIP_ACTIVE = 'bg-slate-900 text-white border border-slate-900';
const CHIP_IDLE = 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
    style={{ scrollSnapAlign: 'start' }}
  >
    {children}
  </button>
);

const Divider: React.FC = () => (
  <span className="shrink-0 self-stretch w-px bg-slate-200 mx-1" aria-hidden="true" />
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
  const anyActive = staffValue !== 'ALL' || categoryValue !== 'ALL' || statusValue !== 'ALL';
  const hasStaffOptions = staff.length > 0;
  const hasCategoryOptions = categories.length > 0;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {hasStaffOptions && (
        <>
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
          <Divider />
        </>
      )}

      {hasCategoryOptions && (
        <>
          <Chip
            active={categoryValue === 'ALL'}
            onClick={() => onCategoryChange('ALL')}
          >
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
          <Divider />
        </>
      )}

      <Chip active={statusValue === 'ALL'} onClick={() => onStatusChange('ALL')}>
        Tous statuts
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

      {anyActive && (
        <>
          <Divider />
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2.5 text-xs text-blue-600 hover:text-blue-700 font-semibold shrink-0 whitespace-nowrap"
          >
            Réinitialiser
          </button>
        </>
      )}
    </div>
  );
};
