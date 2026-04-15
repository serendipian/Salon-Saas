import React, { useState, useMemo } from 'react';
import { ArrowLeft, Trash2, Search, X, Plus, ChevronRight } from 'lucide-react';
import type { AppointmentStatus } from '../../../types';
import { UseAppointmentFormProps, useAppointmentForm } from '../hooks/useAppointmentForm';
import { formatPrice, formatDuration } from '../../../lib/format';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileClientSearch } from './MobileClientSearch';
import { MobileServicePicker } from './MobileServicePicker';
import StaffPills from './StaffPills';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import ReminderToggle from './ReminderToggle';

interface AppointmentBuilderMobileProps extends UseAppointmentFormProps {
  onCancel: () => void;
  onDelete?: () => void;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED' as AppointmentStatus, label: 'Planifi\u00e9', color: 'bg-blue-500' },
  { value: 'IN_PROGRESS' as AppointmentStatus, label: 'En cours', color: 'bg-violet-500' },
  { value: 'COMPLETED' as AppointmentStatus, label: 'Compl\u00e9t\u00e9', color: 'bg-green-500' },
  { value: 'CANCELLED' as AppointmentStatus, label: 'Annul\u00e9', color: 'bg-red-500' },
  { value: 'NO_SHOW' as AppointmentStatus, label: 'Absent', color: 'bg-orange-500' },
];

export default function AppointmentBuilderMobile({
  onCancel,
  onDelete,
  ...hookProps
}: AppointmentBuilderMobileProps) {
  const [screen, setScreen] = useState<'services' | 'scheduling'>('services');
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const [newClientOnOpen, setNewClientOnOpen] = useState(false);
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [serviceSheetBlockIndex, setServiceSheetBlockIndex] = useState(0);

  const form = useAppointmentForm(hookProps);

  const isEditing = !!hookProps.initialData?.serviceBlocks;

  // Find selected client from props
  const selectedClient = useMemo(() => {
    if (!form.clientId) return null;
    return hookProps.clients.find((c) => c.id === form.clientId) ?? null;
  }, [form.clientId, hookProps.clients]);

  // Build display info for a block's items (multi-item aware)
  const getBlockInfo = (block: {
    items: Array<{ serviceId: string; variantId: string; priceOverride?: number }>;
  }) => {
    if (block.items.length === 0) return null;
    const details = block.items.map((item) => {
      const svc = hookProps.services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.variantId);
      return {
        service: svc ?? null,
        variant: variant ?? null,
        duration: variant?.durationMinutes ?? svc?.durationMinutes ?? 0,
        price: item.priceOverride ?? variant?.price ?? svc?.price ?? 0,
      };
    });
    const duration = details.reduce((sum, d) => sum + d.duration, 0);
    const price = details.reduce((sum, d) => sum + d.price, 0);
    const primary = details[0];
    const label =
      details.length === 1 ? `${primary.service?.name ?? ''}` : `${details.length} prestations`;
    const subtitle =
      details.length === 1
        ? [primary.variant?.name, formatDuration(duration), formatPrice(price)]
            .filter(Boolean)
            .join(' · ')
        : `${details
            .map((d) => d.service?.name)
            .filter(Boolean)
            .join(' · ')} · ${formatDuration(duration)} · ${formatPrice(price)}`;
    return {
      label,
      subtitle,
      primaryService: primary.service,
      firstCategoryId: primary.service?.categoryId ?? null,
    };
  };

  // Summary for footer
  const serviceCount = form.serviceBlocks.filter((b) => b.items.length > 0).length;

  const openServiceSheet = (blockIndex: number) => {
    setServiceSheetBlockIndex(blockIndex);
    setServiceSheetOpen(true);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // ─── SCREEN 1: Qui & Quoi ───

  if (screen === 'services') {
    return (
      <div className="bg-slate-50 flex flex-col min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900">
              {isEditing ? 'Modifier le RDV' : 'Nouveau RDV'}
            </h1>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-10 h-10 rounded-xl border border-red-200 flex items-center justify-center hover:bg-red-50 transition-colors"
            >
              <Trash2 size={18} className="text-red-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-44">
          {/* Client section */}
          <div className="px-4 pt-4 pb-3">
            <label className="text-xs font-medium text-slate-500 mb-2 block">Client *</label>

            {selectedClient ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {selectedClient.firstName.charAt(0)}
                  {selectedClient.lastName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </div>
                  {selectedClient.phone && (
                    <div className="text-xs text-slate-400 truncate">{selectedClient.phone}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    form.setClientId(null);
                    form.setNewClient(null);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
            ) : form.newClient ? (
              <div className="bg-blue-50 rounded-2xl border border-blue-200 p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {form.newClient.firstName.charAt(0)}
                  {form.newClient.lastName ? form.newClient.lastName.charAt(0) : ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {form.newClient.firstName} {form.newClient.lastName}
                  </div>
                  <div className="text-xs text-blue-600">Nouveau client</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    form.setNewClient(null);
                    form.setClientId(null);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors shrink-0"
                >
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setClientSheetOpen(true)}
                  className="flex-1 min-h-[52px] bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 text-left hover:border-slate-300 transition-colors"
                >
                  <Search size={18} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-400">Rechercher un client...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClientSheetOpen(true);
                    setNewClientOnOpen(true);
                  }}
                  className="w-[52px] h-[52px] bg-blue-500 rounded-2xl flex items-center justify-center shrink-0 hover:bg-blue-600 transition-colors"
                >
                  <Plus size={20} className="text-white" />
                </button>
              </div>
            )}

            {form.errors.clientId && (
              <p className="text-xs text-red-500 mt-1.5">{form.errors.clientId}</p>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-slate-100" />

          {/* Service blocks section */}
          <div className="px-4 pt-3 pb-2">
            <label className="text-xs font-medium text-slate-500 mb-2 block">Services *</label>

            <div className="space-y-3">
              {form.serviceBlocks.map((block, i) => {
                const info = getBlockInfo(block);

                if (info) {
                  return (
                    <div
                      key={block.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                    >
                      {/* Service header */}
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {info.label}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {info.subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openServiceSheet(i)}
                            className="text-xs text-blue-600 font-medium px-2 py-1"
                          >
                            Modifier
                          </button>
                          {form.serviceBlocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => form.removeBlock(i)}
                              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                            >
                              <X size={14} className="text-slate-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Staff pills */}
                      <div className="border-t border-slate-100 pt-2 px-4 pb-3">
                        <StaffPills
                          team={hookProps.team}
                          categoryId={info.firstCategoryId}
                          selectedStaffId={block.staffId}
                          onSelect={(staffId) => form.updateBlock(i, { staffId })}
                        />
                      </div>
                    </div>
                  );
                }

                // No items yet
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => openServiceSheet(i)}
                    className="w-full bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 min-h-[52px] hover:border-slate-300 transition-colors"
                  >
                    <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm text-slate-400 flex-1 text-left">
                      Choisir un service...
                    </span>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Add service button */}
            <button
              type="button"
              onClick={form.addBlock}
              className="w-full mt-3 min-h-[48px] rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
            >
              <Plus size={16} />
              Ajouter un service
            </button>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-slate-100 my-2" />

          {/* Options section */}
          <div className="px-4 pb-4 space-y-4">
            {/* Status */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">Statut</label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = form.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => form.setStatus(opt.value)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => form.setNotes(e.target.value)}
                placeholder="Notes pour ce rendez-vous..."
                className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none transition-all"
              />
            </div>

            {/* Reminder */}
            <ReminderToggle value={form.reminderMinutes} onChange={form.setReminderMinutes} />
          </div>
        </div>

        {/* Sticky footer — above BottomTabBar */}
        <div
          className="fixed left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-2 z-10"
          style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
        >
          {serviceCount > 0 && (
            <p className="text-xs text-slate-500 text-center">
              {serviceCount} service{serviceCount > 1 ? 's' : ''} &middot;{' '}
              {formatDuration(form.totalDuration)} &middot; {formatPrice(form.totalPrice)}
            </p>
          )}
          <button
            type="button"
            disabled={!form.hasCompleteServiceBlock}
            onClick={() => setScreen('scheduling')}
            className="w-full bg-blue-500 text-white py-3.5 rounded-2xl min-h-[52px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-600"
          >
            Continuer
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Client bottom sheet */}
        <MobileBottomSheet
          isOpen={clientSheetOpen}
          onClose={() => setClientSheetOpen(false)}
          title="Client"
        >
          <MobileClientSearch
            clients={hookProps.clients}
            startInCreateMode={newClientOnOpen}
            onSelectClient={(clientId) => {
              form.setClientId(clientId);
              form.setNewClient(null);
              form.clearFieldError('clientId');
            }}
            onNewClient={(data) => {
              form.setNewClient(data);
              form.setClientId(null);
              form.clearFieldError('clientId');
            }}
            onClose={() => {
              setClientSheetOpen(false);
              setNewClientOnOpen(false);
            }}
          />
        </MobileBottomSheet>

        {/* Service bottom sheet */}
        <MobileBottomSheet
          isOpen={serviceSheetOpen}
          onClose={() => setServiceSheetOpen(false)}
          title="Service"
        >
          <MobileServicePicker
            services={hookProps.services}
            categories={hookProps.categories}
            favorites={hookProps.favorites}
            packs={hookProps.packs}
            initialCategoryId={form.serviceBlocks[serviceSheetBlockIndex]?.categoryId ?? null}
            initialItems={form.serviceBlocks[serviceSheetBlockIndex]?.items ?? []}
            onConfirm={(items, categoryId) => {
              form.updateBlock(serviceSheetBlockIndex, {
                items,
                categoryId,
              });
            }}
            onPackSelect={(pack) => {
              form.addPackBlocks(pack);
            }}
            onClose={() => setServiceSheetOpen(false)}
          />
        </MobileBottomSheet>
      </div>
    );
  }

  // ─── SCREEN 2: Quand ───

  const activeBlock = form.activeBlock;
  const activeBlockInfo = activeBlock ? getBlockInfo(activeBlock) : null;

  // Find staff name for context header
  const activeStaffName = form.activeStaff
    ? `${form.activeStaff.firstName}${form.activeStaff.lastName ? ` ${form.activeStaff.lastName[0]}.` : ''}`
    : null;

  // Summary for footer
  const clientName = selectedClient
    ? `${selectedClient.firstName} ${selectedClient.lastName}`
    : form.newClient
      ? `${form.newClient.firstName} ${form.newClient.lastName}`
      : '';

  const serviceNames = form.serviceBlocks
    .map((b) => {
      const info = getBlockInfo(b);
      return info?.label;
    })
    .filter(Boolean)
    .join(' + ');

  const firstDate = form.serviceBlocks.find((b) => b.date)?.date;

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 z-10">
        <button
          type="button"
          onClick={() => setScreen('services')}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Quand ?</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-44">
        {/* Block selector (if multiple blocks) */}
        {form.serviceBlocks.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
            {form.serviceBlocks.map((block, i) => {
              const info = getBlockInfo(block);
              const isActive = i === form.activeBlockIndex;
              const isScheduled = block.date !== null && block.hour !== null;

              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => form.setActiveBlockIndex(i)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-sm'
                      : isScheduled
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {info?.label ?? `Service ${i + 1}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Context header */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Planifier</div>
          {activeBlockInfo && (
            <div className="text-sm text-slate-700">
              {activeBlockInfo.label}
              {activeStaffName && (
                <span className="text-slate-400"> &middot; {activeStaffName}</span>
              )}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="px-4 mb-4">
          <InlineCalendar
            value={activeBlock?.date ?? null}
            onChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
          />
        </div>

        {/* Time picker */}
        <div className="px-4 mb-4">
          <TimePicker
            hour={activeBlock?.hour ?? null}
            minute={activeBlock?.minute ?? 0}
            onHourChange={(hour) => form.updateBlock(form.activeBlockIndex, { hour })}
            onMinuteChange={(minute) => form.updateBlock(form.activeBlockIndex, { minute })}
            unavailableHours={form.unavailableHours}
            dateSelected={!!activeBlock?.date}
          />
        </div>
      </div>

      {/* Sticky footer — above BottomTabBar */}
      <div
        className="fixed left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-2 z-10"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        <p className="text-xs text-slate-500 text-center truncate">
          {clientName && <span>{clientName} &middot; </span>}
          {serviceNames}
          {firstDate && <span> &middot; {formatDate(firstDate)}</span>}
          {form.totalPrice > 0 && <span> &middot; {formatPrice(form.totalPrice)}</span>}
        </p>
        <button
          type="button"
          disabled={!form.allBlocksScheduled || form.isSaving}
          onClick={form.handleSubmit}
          className="w-full bg-blue-500 text-white py-3.5 rounded-2xl min-h-[52px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-600"
        >
          {form.isSaving ? 'Enregistrement...' : 'Confirmer'}
        </button>
      </div>
    </div>
  );
}
