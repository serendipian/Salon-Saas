import React, { useMemo } from 'react';
import type { ServiceBlockState } from '../../../types';
import type { StaffMember, Service } from '../../../types';
import StaffPills from './StaffPills';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import { Users, Bell } from 'lucide-react';

interface StaffCalendarPanelProps {
  activeBlock: ServiceBlockState | undefined;
  activeBlockIndex: number;
  team: StaffMember[];
  services: Service[];
  unavailableHours: Set<number>;
  onUpdateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
  reminderMinutes: number | null;
  onReminderChange: (minutes: number | null) => void;
}

export default function StaffCalendarPanel({
  activeBlock,
  activeBlockIndex,
  team,
  services,
  unavailableHours,
  onUpdateBlock,
  reminderMinutes,
  onReminderChange,
}: StaffCalendarPanelProps) {
  const hasService = (activeBlock?.items.length ?? 0) > 0;
  const hasStaff = hasService && (activeBlock?.staffConfirmed === true);

  // Derive the category from the first item's service for staff filtering
  const firstItemCategoryId = useMemo(() => {
    if (!activeBlock || activeBlock.items.length === 0) return null;
    const svc = services.find((s) => s.id === activeBlock.items[0].serviceId);
    return svc?.categoryId ?? null;
  }, [activeBlock, services]);

  return (
    <div className="space-y-0">
      {/* Step 3 — Équipe */}
      <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">3</span>
            <span className="text-slate-900 text-base font-semibold">Équipe</span>
          </div>
          {hasService && (() => {
            const isActive = activeBlock?.staffConfirmed && activeBlock?.staffId === null;
            return (
              <button
                type="button"
                onClick={() => {
                  if (isActive) {
                    onUpdateBlock(activeBlockIndex, { staffId: null, staffConfirmed: false });
                  } else {
                    onUpdateBlock(activeBlockIndex, { staffId: null, staffConfirmed: true });
                  }
                }}
                className={`px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-blue-500 text-white font-medium shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <Users size={14} />
                Aucun
              </button>
            );
          })()}
        </div>
        <div className="border-b border-slate-200 mb-3" />
        <div className="relative">
          <div className={hasService ? '' : 'opacity-40 pointer-events-none'}>
            <StaffPills
              team={team}
              categoryId={firstItemCategoryId}
              selectedStaffId={activeBlock?.staffId ?? null}
              onSelect={(staffId) => onUpdateBlock(activeBlockIndex, { staffId, staffConfirmed: staffId !== null })}
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

      {/* Vertical connector between Step 3 and Step 4 */}
      <div className="flex justify-center max-[1200px]:hidden">
        <div className="w-0.5 h-4 bg-blue-400" />
      </div>
      <div className="h-4 max-[1200px]:block hidden" />

      {/* Step 4 — Date & Heure */}
      <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">4</span>
            <span className="text-slate-900 text-base font-semibold">Date & Heure</span>
          </div>
          <button
            type="button"
            disabled={!hasStaff}
            onClick={() => onReminderChange(reminderMinutes !== null ? null : 60)}
            className={`px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
              !hasStaff
                ? 'opacity-40 cursor-not-allowed bg-white border border-slate-200 text-slate-400'
                : reminderMinutes !== null
                  ? 'bg-blue-500 text-white font-medium shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <Bell size={14} />
            Rappel
          </button>
        </div>
        <div className="border-b border-slate-200 mb-3" />
        {/* Reminder duration options (visible when reminder is on) */}
        {reminderMinutes !== null && (
          <div className="flex gap-2 flex-wrap mb-3">
            {[
              { label: '30 min', value: 30 },
              { label: '1h', value: 60 },
              { label: '3h', value: 180 },
              { label: '1 jour', value: 1440 },
              { label: '2 jours', value: 2880 },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onReminderChange(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  reminderMinutes === opt.value
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
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
                Choisissez un membre
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
