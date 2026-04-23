import { Calendar, Clock, Play, StickyNote, User, UserCircle } from 'lucide-react';
import { formatDuration, formatName, formatPrice } from '../../../lib/format';
import type { Client, Pack, Service, ServiceBlockItem, StaffMember } from '../../../types';

interface ServiceBlockSummary {
  items: ServiceBlockItem[];
  staffId: string | null;
  staffConfirmed?: boolean;
  date: string | null;
  hour: number | null;
  minute: number;
  packId?: string | null;
}

interface AppointmentSummaryProps {
  serviceBlocks: ServiceBlockSummary[];
  services: Service[];
  team: StaffMember[];
  clients: Client[];
  clientId: string | null;
  newClient: { firstName: string; lastName: string; phone: string } | null;
  packs?: Pack[];
  showNotes?: boolean;
  onToggleNotes?: () => void;
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

function formatTime(hour: number | null, minute: number, durationMinutes: number): string {
  if (hour === null) return '';
  const start = `${hour}h${String(minute).padStart(2, '0')}`;
  const endTotal = hour * 60 + minute + durationMinutes;
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const end = `${endH}h${String(endM).padStart(2, '0')}`;
  return `${start} – ${end}`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function formatBlockDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return dateFmt.format(d);
}

export default function AppointmentSummary({
  serviceBlocks,
  services,
  team,
  clients,
  clientId,
  newClient,
  packs = [],
  showNotes = false,
  onToggleNotes,
  notes = '',
  onNotesChange,
}: AppointmentSummaryProps) {
  // Resolve client name
  const clientName = (() => {
    if (clientId) {
      const c = clients.find((cl) => cl.id === clientId);
      return c ? [formatName(c.firstName), formatName(c.lastName)].filter(Boolean).join(' ') : null;
    }
    if (newClient && (newClient.firstName || newClient.lastName)) {
      return (
        [formatName(newClient.firstName), formatName(newClient.lastName)]
          .filter(Boolean)
          .join(' ') || null
      );
    }
    return null;
  })();

  const populatedBlocks = serviceBlocks.filter((b) => b.items.length > 0);

  const blockDetails = populatedBlocks.map((block) => {
    const itemDetails = block.items.map((item) => {
      const svc = services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.variantId);
      return {
        name: svc?.name ?? '',
        variantName: variant?.name ?? '',
        duration: variant?.durationMinutes ?? svc?.durationMinutes ?? 0,
        price: item.priceOverride ?? variant?.price ?? svc?.price ?? 0,
        isPackItem: item.priceOverride != null,
      };
    });
    const totalDuration = itemDetails.reduce((sum, i) => sum + i.duration, 0);
    const totalPrice = itemDetails.reduce((sum, i) => sum + i.price, 0);

    // Staff name
    const staffMember = block.staffId ? team.find((m) => m.id === block.staffId) : null;
    const staffLabel = block.staffConfirmed
      ? staffMember
        ? staffMember.lastName
          ? `${staffMember.firstName} ${staffMember.lastName[0]}.`
          : staffMember.firstName
        : 'Aucune préférence'
      : null;

    // Pack name (if this block belongs to a pack)
    const packName = block.packId ? (packs.find((p) => p.id === block.packId)?.name ?? null) : null;

    return {
      itemDetails,
      totalDuration,
      totalPrice,
      staffLabel,
      packName,
      date: block.date,
      hour: block.hour,
      minute: block.minute,
    };
  });

  const totalDuration = blockDetails.reduce((sum, b) => sum + b.totalDuration, 0);
  const totalPrice = blockDetails.reduce((sum, b) => sum + b.totalPrice, 0);

  const isEmpty = !clientName && populatedBlocks.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <Play size={13} fill="white" />
          </span>
          <span className="text-slate-900 text-base font-semibold">Résumé</span>
        </div>
        {onToggleNotes && (
          <button
            type="button"
            onClick={onToggleNotes}
            className={`px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
              showNotes
                ? 'bg-blue-500 text-white font-medium shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <StickyNote size={14} />
            Notes
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="text-xs text-slate-400 text-center py-3">Les détails apparaîtront ici</div>
      ) : (
        <div className="space-y-3">
          {/* Client row */}
          {clientName && (
            <div className="flex items-center gap-2.5">
              <User size={13} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-700 font-medium">{clientName}</span>
            </div>
          )}

          {/* Service blocks */}
          {blockDetails.map((block, i) => (
            <div key={i} className="border-l-2 border-slate-200 pl-3 space-y-1">
              {/* Service / Pack names */}
              {block.packName ? (
                (() => {
                  const packItems = block.itemDetails.filter((i) => i.isPackItem);
                  const extraItems = block.itemDetails.filter((i) => !i.isPackItem);
                  return (
                    <>
                      <div className="text-sm text-slate-800 font-medium">
                        {block.packName}
                        {packItems.length > 0 && (
                          <span className="text-slate-400 font-normal">
                            {' '}
                            · {packItems.map((i) => i.name).join(', ')}
                          </span>
                        )}
                      </div>
                      {extraItems.map((item, j) => (
                        <div key={j} className="text-sm text-slate-800 font-medium">
                          {item.name}
                          {item.variantName && (
                            <span className="text-slate-400 font-normal">
                              {' '}
                              · {item.variantName}
                            </span>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()
              ) : block.itemDetails.length === 1 ? (
                <div className="text-sm text-slate-800 font-medium">
                  {block.itemDetails[0].name}
                  {block.itemDetails[0].variantName && (
                    <span className="text-slate-400 font-normal">
                      {' '}
                      · {block.itemDetails[0].variantName}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-800 font-medium">
                  {block.itemDetails.map((item, j) => (
                    <span key={j}>
                      {j > 0 && <span className="text-slate-300"> + </span>}
                      {item.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta row: duration + price + staff + time */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {block.totalDuration > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-slate-400" />
                    {formatDuration(block.totalDuration)}
                  </span>
                )}
                {block.staffLabel && (
                  <span className="flex items-center gap-1">
                    <UserCircle size={11} className="text-slate-400" />
                    {block.staffLabel}
                  </span>
                )}
                {block.date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-slate-400" />
                    {formatBlockDate(block.date)}
                    {block.hour !== null &&
                      ` · ${formatTime(block.hour, block.minute, block.totalDuration)}`}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Total footer */}
          {populatedBlocks.length > 0 && (
            <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
              <span className="text-xs text-slate-500">{formatDuration(totalDuration)}</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatPrice(totalPrice)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Notes textarea */}
      {showNotes && onNotesChange && (
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Ajouter des notes..."
          rows={3}
          className="mt-3 w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none min-h-[44px] transition-all"
        />
      )}
    </div>
  );
}
