import React from 'react';
import { formatPrice } from '../../../lib/format';
import type { Service, ServiceVariant } from '../../../types';

interface ServiceBlockSummary {
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
}

interface AppointmentSummaryProps {
  serviceBlocks: ServiceBlockSummary[];
  activeBlockIndex: number;
  services: Service[];
}

function getVariant(services: Service[], serviceId: string | null, variantId: string | null): ServiceVariant | null {
  if (!serviceId || !variantId) return null;
  const svc = services.find((s) => s.id === serviceId);
  return svc?.variants.find((v) => v.id === variantId) ?? null;
}

function getServiceName(services: Service[], serviceId: string | null): string {
  return services.find((s) => s.id === serviceId)?.name ?? '';
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function formatBlockDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return dateFmt.format(d);
}

export default function AppointmentSummary({
  serviceBlocks,
  activeBlockIndex,
  services,
}: AppointmentSummaryProps) {
  const activeBlock = serviceBlocks[activeBlockIndex];
  const activeVariant = activeBlock
    ? getVariant(services, activeBlock.serviceId, activeBlock.variantId)
    : null;

  const blockDetails = serviceBlocks.map((block) => {
    const variant = getVariant(services, block.serviceId, block.variantId);
    return {
      name: getServiceName(services, block.serviceId),
      variantName: variant?.name ?? '',
      duration: variant?.durationMinutes ?? 0,
      price: variant?.price ?? 0,
      time: formatTime(block.hour, block.minute, variant?.durationMinutes ?? 0),
      date: block.date,
      hour: block.hour,
      minute: block.minute,
    };
  });

  const totalDuration = blockDetails.reduce((sum, b) => sum + b.duration, 0);
  const totalPrice = blockDetails.reduce((sum, b) => sum + b.price, 0);

  return (
    <div>
      {activeVariant && (
        <div className="border-t border-slate-200 pt-3 mb-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Ce service</div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Durée : <strong className="text-slate-800">{formatDuration(activeVariant.durationMinutes)}</strong></span>
            <span className="text-slate-500">Prix : <strong className="text-pink-600">{formatPrice(activeVariant.price)}</strong></span>
          </div>
          {activeBlock?.hour !== null && (
            <div className="text-slate-400 text-[10px] mt-1">
              {'\uD83D\uDCC5'} {formatTime(activeBlock.hour, activeBlock.minute, activeVariant.durationMinutes)}
            </div>
          )}
        </div>
      )}
      {serviceBlocks.length > 1 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
          <div className="text-[10px] text-pink-600 uppercase tracking-wider font-semibold mb-1.5">Total rendez-vous</div>
          {blockDetails.map((b, i) => (
            <div key={i} className="mb-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">{'\u2460\u2461\u2462\u2463\u2464'[i]} {b.name}{b.variantName ? ` · ${b.variantName}` : ''}</span>
                <span className="text-slate-800">{formatPrice(b.price)}</span>
              </div>
              {b.date && b.hour !== null && (
                <div className="text-[10px] text-slate-400 mt-0.5 ml-4">
                  {'\uD83D\uDCC5'} {formatBlockDate(b.date)} · {formatTime(b.hour, b.minute, b.duration)}
                </div>
              )}
            </div>
          ))}
          <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex justify-between text-sm">
            <span className="text-slate-500">Durée : <strong className="text-slate-800">{formatDuration(totalDuration)}</strong></span>
            <strong className="text-pink-600">{formatPrice(totalPrice)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
