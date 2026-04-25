import { ArrowLeft, Plus, Save, Trash2, Users } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useShake } from '../../../hooks/useShake';
import type { FavoriteItem } from '../../../types';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import { humanizeMissing } from '../utils/missingFields';
import AppointmentSummary from './AppointmentSummary';
import ClientField from './ClientField';
import MissingFieldsHint from './MissingFieldsHint';
import ServiceBlock from './ServiceBlock';
import StaffCalendarPanel from './StaffCalendarPanel';

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

  const { addToast } = useToast();
  const shake = useShake();
  const [pulseTrigger, setPulseTrigger] = useState(0);

  const clientPanelRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const conflictBannerRef = useRef<HTMLDivElement | null>(null);

  const setBlockRef = (i: number) => (el: HTMLDivElement | null) => {
    blockRefs.current.set(i, el);
  };

  const handleSaveClick = () => {
    if (form.canSubmit) {
      form.handleSubmit();
      return;
    }
    setPulseTrigger((n) => n + 1);
    const missing = form.missingFields;
    const conflictBlockIndex =
      form.blockConflicts.size > 0 ? Array.from(form.blockConflicts.keys())[0] : null;

    let target: HTMLElement | null = null;
    if (missing.length > 0) {
      const first = missing[0];
      if (first.kind === 'client') target = clientPanelRef.current;
      else target = blockRefs.current.get(first.blockIndex) ?? null;
    } else if (conflictBlockIndex !== null) {
      target = conflictBannerRef.current ?? blockRefs.current.get(conflictBlockIndex) ?? null;
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      shake(target);
    }

    const message =
      missing.length > 0
        ? `Veuillez compléter : ${humanizeMissing(missing)}`
        : 'Conflit de planning. Modifiez le membre ou le créneau.';
    addToast({ type: 'warning', message });
  };

  // Merge pack favorites into the favorites array (packs live in a separate
  // data source so they aren't included in useServices().favorites).
  const allFavorites = useMemo<FavoriteItem[]>(() => {
    const baseFavs = hookProps.favorites ?? [];
    const packs = hookProps.packs ?? [];
    const packFavs: FavoriteItem[] = packs
      .filter((p) => p.isFavorite)
      .map((p) => ({ type: 'pack', pack: p, sortOrder: p.favoriteSortOrder ?? 9999 }));
    if (packFavs.length === 0) return baseFavs;
    return [...baseFavs, ...packFavs].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [hookProps.favorites, hookProps.packs]);

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
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={form.isSaving}
              aria-disabled={!form.canSubmit}
              className={`bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2 ${
                form.canSubmit ? '' : 'opacity-50'
              }`}
            >
              <Save size={15} />
              {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <MissingFieldsHint
              missingFields={form.missingFields}
              pulseTrigger={pulseTrigger}
              className="text-right"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-5 max-md:flex-col relative">
        {/* Horizontal connector: Step 1 → Step 2 — spans the gap between left sidebar and right area */}
        <div
          className="absolute h-0.5 bg-blue-400 max-md:hidden max-[1200px]:hidden"
          style={{
            top: 28,
            left: 'calc((100% - 20px) / 4)',
            width: 20,
          }}
        />

        {/* LEFT SIDEBAR — 1/4 */}
        <div className="flex-[1] space-y-4 max-md:order-first">
          {/* Step 1 — Client */}
          <div
            ref={clientPanelRef}
            className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                  1
                </span>
                <span className="text-slate-900 text-base font-semibold">Client</span>
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
                  Existant
                </button>
              )}
            </div>
            <div className="border-b border-slate-200 mb-3" />
            <ClientField
              clients={hookProps.clients}
              selectedClientId={form.clientId}
              onSelectClient={(id) => {
                form.setClientId(id);
                form.setNewClient(null);
                form.clearFieldError('clientId');
              }}
              onClearClient={() => form.setClientId(null)}
              newClientData={form.newClient}
              onNewClientChange={form.setNewClient}
              error={form.errors.clientId}
              showExistingSearch={showExistingClientSearch}
              onShowExistingSearchChange={setShowExistingClientSearch}
            />
          </div>

          {/* Total Summary — always visible */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <AppointmentSummary
              serviceBlocks={form.serviceBlocks}
              services={hookProps.services}
              team={hookProps.team}
              clients={hookProps.clients}
              clientId={form.clientId}
              newClient={form.newClient}
              packs={hookProps.packs ?? []}
              showNotes={showNotes}
              onToggleNotes={() => {
                const next = !showNotes;
                setShowNotes(next);
                if (!next) form.setNotes('');
              }}
              notes={form.notes}
              onNotesChange={form.setNotes}
            />
          </div>
        </div>

        {/* RIGHT AREA — 3/4 */}
        <div className="flex-[3] relative">
          <div className="flex gap-5 max-[1200px]:flex-col">
            {/* Services subpanel — 2/3 */}
            <div className="flex-[2] space-y-3">
              {form.serviceBlocks.map((block, i) => (
                <div key={block.id} ref={setBlockRef(i)}>
                  <ServiceBlock
                    block={block}
                    index={i}
                    isActive={i === form.activeBlockIndex}
                    services={hookProps.services}
                    categories={hookProps.categories}
                    favorites={allFavorites}
                    packs={hookProps.packs ?? []}
                    onAddPackBlocks={form.addPackBlocks}
                    onActivate={() => form.setActiveBlockIndex(i)}
                    onRemove={() => form.removeBlock(i)}
                    onUpdate={(updates) => form.updateBlock(i, updates)}
                    onToggleItem={(serviceId, variantId) =>
                      form.toggleBlockItem(i, serviceId, variantId)
                    }
                    onClearItems={() => form.clearBlockItems(i)}
                    summaryText={form.getBlockSummary(block)}
                    stepOffset={1}
                    hasConflict={form.blockConflicts.has(i)}
                  />
                </div>
              ))}

              {/* Add service button */}
              <button
                type="button"
                onClick={form.addBlock}
                className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3.5 text-slate-400 text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Ajouter un service
              </button>
            </div>

            {/* Connector line: Step 2 → Step 3 — spans the gap between services and staff panel */}
            <div
              className="absolute border-t-2 border-blue-400 max-[1200px]:hidden"
              style={{
                top: 28,
                left: 'calc((100% - 20px) * 2 / 3)',
                width: 20,
              }}
            />

            {/* Staff + Calendar subpanel — 1/3 */}
            <div className="flex-[1]">
              <div className="sticky top-4">
                <StaffCalendarPanel
                  activeBlock={form.activeBlock}
                  activeBlockIndex={form.activeBlockIndex}
                  team={hookProps.team}
                  services={hookProps.services}
                  unavailableHours={form.unavailableHours}
                  onUpdateBlock={form.updateBlock}
                  reminderMinutes={form.reminderMinutes}
                  onReminderChange={form.setReminderMinutes}
                  conflict={form.blockConflicts.get(form.activeBlockIndex)}
                  isStaffAvailableForSlot={(staffId) => {
                    const b = form.activeBlock;
                    if (!b?.date || b.hour === null) return true;
                    return form.isStaffAvailableForSlot(
                      staffId,
                      b.date,
                      b.hour,
                      b.minute,
                      form.activeBlockIndex,
                    );
                  }}
                  conflictRef={conflictBannerRef}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
