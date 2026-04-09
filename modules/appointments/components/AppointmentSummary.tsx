import React from 'react';
import { formatPrice, formatDuration } from '../../../lib/format';
import type { Service, ServiceBlockItem } from '../../../types';

interface ServiceBlockSummary {
  items: ServiceBlockItem[];
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
}

interface AppointmentSummaryProps {
  serviceBlocks: ServiceBlockSummary[];
  services: Service[];
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

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function formatBlockDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return dateFmt.format(d);
}

export default function AppointmentSummary({
  serviceBlocks,
  services,
}: AppointmentSummaryProps) {
  // Build one display row per block; multi-item blocks show concatenated service names
  const blockDetails = serviceBlocks.map((block) => {
    const itemDetails = block.items.map((item) => {
      const svc = services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.variantId);
      return {
        name: svc?.name ?? '',
        variantName: variant?.name ?? '',
        duration: variant?.durationMinutes ?? svc?.durationMinutes ?? 0,
        price: item.priceOverride ?? variant?.price ?? svc?.price ?? 0,
      };
    });
    const totalDuration = itemDetails.reduce((sum, i) => sum + i.duration, 0);
    const totalPrice = itemDetails.reduce((sum, i) => sum + i.price, 0);
    const label =
      itemDetails.length === 1
        ? `${itemDetails[0].name}${itemDetails[0].variantName ? ` · ${itemDetails[0].variantName}` : ''}`
        : `${itemDetails.length} prestations : ${itemDetails.map((i) => i.name).join(', ')}`;
    return {
      label,
      duration: totalDuration,
      price: totalPrice,
      date: block.date,
      hour: block.hour,
      minute: block.minute,
    };
  });

  const totalDuration = blockDetails.reduce((sum, b) => sum + b.duration, 0);
  const totalPrice = blockDetails.reduce((sum, b) => sum + b.price, 0);

  if (serviceBlocks.length <= 1) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="text-xs text-blue-600 font-semibold mb-3">Total rendez-vous</div>
      <div className="space-y-2">
        {blockDetails.map((b, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                <span className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full inline-flex items-center justify-center text-[10px] font-bold mr-2">{i + 1}</span>
                {b.label}
              </span>
              <span className="text-slate-800 font-medium">{formatPrice(b.price)}</span>
            </div>
            {b.date && b.hour !== null && (
              <div className="text-[11px] text-slate-400 mt-0.5 ml-7">
                {formatBlockDate(b.date)} · {formatTime(b.hour, b.minute, b.duration)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
        <span className="text-sm text-slate-500">Durée : <strong className="text-slate-800">{formatDuration(totalDuration)}</strong></span>
        <strong className="text-blue-600 text-base">{formatPrice(totalPrice)}</strong>
      </div>
    </div>
  );
}
