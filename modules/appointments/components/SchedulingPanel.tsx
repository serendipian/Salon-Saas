import React from 'react';
import type { AppointmentStatus, Service, StaffMember } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import ReminderToggle from './ReminderToggle';
import AppointmentSummary from './AppointmentSummary';

interface SchedulingPanelProps {
  serviceBlocks: ServiceBlockState[];
  activeBlockIndex: number;
  onActivateBlock: (index: number) => void;
  onBlockChange: (index: number, updates: Partial<ServiceBlockState>) => void;
  status: AppointmentStatus;
  onStatusChange: (status: AppointmentStatus) => void;
  reminderMinutes: number | null;
  onReminderChange: (minutes: number | null) => void;
  services: Service[];
  team: StaffMember[];
  unavailableHours?: Set<number>;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED' as AppointmentStatus, label: 'Planifié', color: 'bg-blue-500' },
  { value: 'COMPLETED' as AppointmentStatus, label: 'Complété', color: 'bg-green-500' },
  { value: 'CANCELLED' as AppointmentStatus, label: 'Annulé', color: 'bg-red-500' },
  { value: 'NO_SHOW' as AppointmentStatus, label: 'Absent', color: 'bg-orange-500' },
];

export default function SchedulingPanel({
  serviceBlocks,
  activeBlockIndex,
  onActivateBlock,
  onBlockChange,
  status,
  onStatusChange,
  reminderMinutes,
  onReminderChange,
  services,
  team,
  unavailableHours,
}: SchedulingPanelProps) {
  const activeBlock = serviceBlocks[activeBlockIndex];
  if (!activeBlock) return null;

  const getTabLabel = (block: ServiceBlockState, index: number) => {
    const svc = services.find((s) => s.id === block.serviceId);
    const variant = svc?.variants.find((v) => v.id === block.variantId);
    const staff = team.find((m) => m.id === block.staffId);
    return {
      name: svc?.name ?? 'Service',
      subtitle: [variant?.name, staff ? `${staff.firstName} ${staff.lastName[0]}.` : null]
        .filter(Boolean)
        .join(' · '),
    };
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Service tabs */}
      <div className="flex border-b-2 border-slate-700 bg-slate-950 overflow-x-auto">
        {serviceBlocks.map((block, i) => {
          const tab = getTabLabel(block, i);
          const isActive = i === activeBlockIndex;
          const circled = '\u2460\u2461\u2462\u2463\u2464'[i] ?? `${i + 1}`;

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onActivateBlock(i)}
              className={`
                flex-1 min-w-0 px-4 py-2.5 text-center transition-colors
                ${isActive
                  ? 'text-pink-500 font-semibold border-b-2 border-pink-500 -mb-[2px]'
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <div className="text-xs truncate">{circled} {tab.name}</div>
              {tab.subtitle && (
                <div className={`text-[9px] mt-0.5 truncate ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                  {tab.subtitle}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {/* Status */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Statut
          </div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AppointmentStatus)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:border-pink-500 focus:outline-none min-h-[44px] appearance-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Date *
          </div>
          <InlineCalendar
            value={activeBlock.date}
            onChange={(date) => onBlockChange(activeBlockIndex, { date })}
          />
        </div>

        {/* Time Picker */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Heure *
          </div>
          <TimePicker
            hour={activeBlock.hour}
            minute={activeBlock.minute}
            onHourChange={(hour) => onBlockChange(activeBlockIndex, { hour })}
            onMinuteChange={(minute) => onBlockChange(activeBlockIndex, { minute })}
            unavailableHours={unavailableHours}
          />
        </div>

        {/* Reminder */}
        <div className="mb-4">
          <ReminderToggle
            value={reminderMinutes}
            onChange={onReminderChange}
          />
        </div>

        {/* Summary */}
        <AppointmentSummary
          serviceBlocks={serviceBlocks}
          activeBlockIndex={activeBlockIndex}
          services={services}
        />
      </div>
    </div>
  );
}
