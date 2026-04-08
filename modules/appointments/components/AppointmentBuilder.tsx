import React from 'react';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import ClientField from './ClientField';
import ServiceBlock from './ServiceBlock';
import SchedulingPanel from './SchedulingPanel';
import AppointmentSummary from './AppointmentSummary';
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react';

interface AppointmentBuilderProps extends UseAppointmentFormProps {
  onCancel: () => void;
  onDelete?: () => void;
}

export default function AppointmentBuilder({
  onCancel,
  onDelete,
  ...hookProps
}: AppointmentBuilderProps) {
  const form = useAppointmentForm(hookProps);

  return (
    <div className="flex gap-5 max-md:flex-col">
      {/* LEFT PANEL */}
      <div className="flex-[1.3] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={18} className="text-slate-500" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900">
              {form.initialData?.serviceBlocks ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
            </h3>
          </div>
          <div className="flex gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="w-9 h-9 rounded-xl border border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors"
              >
                <Trash2 size={16} className="text-red-500" />
              </button>
            )}
            <button
              type="button"
              onClick={form.handleSubmit}
              disabled={form.isSaving}
              className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <Save size={15} />
              {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Client */}
        <ClientField
          clients={hookProps.clients}
          selectedClientId={form.clientId}
          onSelectClient={(id) => { form.setClientId(id); form.setNewClient(null); form.clearFieldError('clientId'); }}
          onClearClient={() => form.setClientId(null)}
          newClientData={form.newClient}
          onNewClientChange={form.setNewClient}
          error={form.errors.clientId}
        />

        <div className="border-t border-slate-100 mb-5" />

        {/* Service blocks */}
        <div className="space-y-3 mb-4">
          {form.serviceBlocks.map((block, i) => (
            <ServiceBlock
              key={block.id}
              block={block}
              index={i}
              isActive={i === form.activeBlockIndex}
              services={hookProps.services}
              categories={hookProps.categories}
              team={hookProps.team}
              onActivate={() => form.setActiveBlockIndex(i)}
              onRemove={() => form.removeBlock(i)}
              onChange={(updates) => form.updateBlock(i, updates)}
              summaryText={form.getBlockSummary(block)}
            />
          ))}
        </div>

        {/* Add service button */}
        <button
          type="button"
          onClick={form.addBlock}
          className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3.5 text-slate-400 text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 mb-5"
        >
          <Plus size={16} /> Ajouter un service
        </button>

        {/* Notes */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Notes</div>
          <textarea
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder="Ajouter des notes..."
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none min-h-[44px] transition-all"
          />
        </div>

        {/* Total Summary */}
        {form.serviceBlocks.length > 0 && (
          <div className="mt-4">
            <AppointmentSummary
              serviceBlocks={form.serviceBlocks}
              services={hookProps.services}
            />
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-[0.6]">
        <SchedulingPanel
          activeDate={form.activeBlock?.date ?? null}
          activeHour={form.activeBlock?.hour ?? null}
          activeMinute={form.activeBlock?.minute ?? 0}
          onDateChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
          onHourChange={(hour) => form.updateBlock(form.activeBlockIndex, { hour })}
          onMinuteChange={(minute) => form.updateBlock(form.activeBlockIndex, { minute })}
          status={form.status}
          onStatusChange={form.setStatus}
          reminderMinutes={form.reminderMinutes}
          onReminderChange={form.setReminderMinutes}
          unavailableHours={form.unavailableHours}
        />
      </div>
    </div>
  );
}
