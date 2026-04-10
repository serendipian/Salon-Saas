import React, { useMemo } from 'react';
import type { ServiceBlockState } from '../../../types';
import type { StaffMember, Service } from '../../../types';
import StaffPills from './StaffPills';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';

interface StaffCalendarPanelProps {
  activeBlock: ServiceBlockState | undefined;
  activeBlockIndex: number;
  team: StaffMember[];
  services: Service[];
  unavailableHours: Set<number>;
  onUpdateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
}

export default function StaffCalendarPanel({
  activeBlock,
  activeBlockIndex,
  team,
  services,
  unavailableHours,
  onUpdateBlock,
}: StaffCalendarPanelProps) {
  const hasService = (activeBlock?.items.length ?? 0) > 0;
  const hasStaff = hasService; // "N'importe qui" (staffId === null) counts as selected when items exist

  // Derive the category from the first item's service for staff filtering
  const firstItemCategoryId = useMemo(() => {
    if (!activeBlock || activeBlock.items.length === 0) return null;
    const svc = services.find((s) => s.id === activeBlock.items[0].serviceId);
    return svc?.categoryId ?? null;
  }, [activeBlock, services]);

  return (
    <div className="space-y-4">
      {/* Step 3 — Praticien */}
      <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">3</span>
          <span className="text-slate-900 text-sm font-semibold">Praticien</span>
        </div>
        <div className="relative">
          <div className={hasService ? '' : 'opacity-40 pointer-events-none'}>
            <StaffPills
              team={team}
              categoryId={firstItemCategoryId}
              selectedStaffId={activeBlock?.staffId ?? null}
              onSelect={(staffId) => onUpdateBlock(activeBlockIndex, { staffId })}
              hideLabel
            />
          </div>
          {!hasService && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg shadow-sm">
                Choisissez un service
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step 4 — Date & Heure */}
      <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">4</span>
          <span className="text-slate-900 text-sm font-semibold">Date & Heure</span>
        </div>
        <div className="relative">
          <div className={hasStaff ? '' : 'opacity-40 pointer-events-none'}>
            <div className="space-y-4">
              <InlineCalendar
                value={activeBlock?.date ?? null}
                onChange={(date) => onUpdateBlock(activeBlockIndex, { date })}
              />
              <TimePicker
                hour={activeBlock?.hour ?? null}
                minute={activeBlock?.minute ?? 0}
                onHourChange={(hour) => onUpdateBlock(activeBlockIndex, { hour })}
                onMinuteChange={(minute) => onUpdateBlock(activeBlockIndex, { minute })}
                unavailableHours={unavailableHours}
                dateSelected={(activeBlock?.date ?? null) !== null}
              />
            </div>
          </div>
          {!hasStaff && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg shadow-sm">
                Sélectionnez un praticien
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
