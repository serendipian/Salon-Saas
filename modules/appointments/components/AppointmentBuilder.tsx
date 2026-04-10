import React, { useState } from 'react';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import ClientField from './ClientField';
import ServiceBlock from './ServiceBlock';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import ReminderToggle from './ReminderToggle';
import AppointmentSummary from './AppointmentSummary';
import { ArrowLeft, Save, Trash2, Plus, Users, StickyNote } from 'lucide-react';

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
  const [showNotes, setShowNotes] = useState(() => Boolean(form.notes));
  const [showExistingClientSearch, setShowExistingClientSearch] = useState(false);

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-500" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {form.initialData?.serviceBlocks ? 'Modifier le Rendez-Vous' : 'Nouveau Rendez-Vous'}
          </h1>
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
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            <Save size={15} />
            {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="flex gap-5 max-md:flex-col">
        {/* LEFT PANEL */}
        <div className="flex-[1.3] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          {/* Step 1 — Client */}
          <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">1</span>
                <span className="text-slate-900 text-sm font-semibold">Client</span>
              </div>
              {!form.clientId && !showExistingClientSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setShowExistingClientSearch(true);
                    form.setNewClient(null);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Users size={12} />
                  Client existant
                </button>
              )}
            </div>
            <ClientField
              clients={hookProps.clients}
              selectedClientId={form.clientId}
              onSelectClient={(id) => { form.setClientId(id); form.setNewClient(null); form.clearFieldError('clientId'); }}
              onClearClient={() => form.setClientId(null)}
              newClientData={form.newClient}
              onNewClientChange={form.setNewClient}
              error={form.errors.clientId}
              showExistingSearch={showExistingClientSearch}
              onShowExistingSearchChange={setShowExistingClientSearch}
            />
          </div>

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
                favorites={hookProps.favorites ?? []}
                team={hookProps.team}
                packs={hookProps.packs ?? []}
                onAddPackBlocks={form.addPackBlocks}
                onActivate={() => form.setActiveBlockIndex(i)}
                onRemove={() => form.removeBlock(i)}
                onUpdate={(updates) => form.updateBlock(i, updates)}
                onToggleItem={(serviceId, variantId) => form.toggleBlockItem(i, serviceId, variantId)}
                onClearItems={() => form.clearBlockItems(i)}
                summaryText={form.getBlockSummary(block)}
                stepOffset={1}
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

        {/* RIGHT PANEL — single card containing step 4 + Rappel + Notes */}
        <div className="flex-[0.6]">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
            {/* Step 4 — Date & Heure (blue section containing only date + time pickers) */}
            <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">4</span>
                <span className="text-slate-900 text-sm font-semibold">Date & Heure</span>
              </div>
              <div className="space-y-4">
                <InlineCalendar
                  value={form.activeBlock?.date ?? null}
                  onChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
                />
                <TimePicker
                  hour={form.activeBlock?.hour ?? null}
                  minute={form.activeBlock?.minute ?? 0}
                  onHourChange={(hour) => form.updateBlock(form.activeBlockIndex, { hour })}
                  onMinuteChange={(minute) => form.updateBlock(form.activeBlockIndex, { minute })}
                  unavailableHours={form.unavailableHours}
                  dateSelected={(form.activeBlock?.date ?? null) !== null}
                />
              </div>
            </div>

            {/* Rappel */}
            <div className="pt-1">
              <ReminderToggle value={form.reminderMinutes} onChange={form.setReminderMinutes} />
            </div>

            {/* Notes — toggleable */}
            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <StickyNote size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Notes</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showNotes;
                    setShowNotes(next);
                    if (!next) form.setNotes('');
                  }}
                  className={`w-10 h-[22px] rounded-full relative transition-colors ${showNotes ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all shadow-sm ${showNotes ? 'right-[2px]' : 'left-[2px]'}`} />
                </button>
              </div>
              {showNotes && (
                <textarea
                  value={form.notes}
                  onChange={(e) => form.setNotes(e.target.value)}
                  placeholder="Ajouter des notes..."
                  rows={3}
                  className="mt-3 w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none min-h-[44px] transition-all"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
