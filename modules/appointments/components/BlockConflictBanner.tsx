import { AlertTriangle } from 'lucide-react';
import { formatHour, formatLongDate } from '../../../lib/format';
import type { BlockConflict } from '../utils/deriveBlockConflicts';

interface Props {
  conflict: BlockConflict | undefined;
}

export default function BlockConflictBanner({ conflict }: Props) {
  if (!conflict) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>
        {conflict.kind === 'staff_unavailable' && (
          <>
            <strong>{conflict.staffName}</strong> n'est pas disponible le{' '}
            {formatLongDate(conflict.date)} à {formatHour(conflict.hour, conflict.minute)}.
          </>
        )}
        {conflict.kind === 'staff_offday' && (
          <>
            <strong>{conflict.staffName}</strong> ne travaille pas le{' '}
            {formatLongDate(conflict.date)}.
          </>
        )}
        {conflict.kind === 'sibling_overlap' && (
          <>
            Conflit avec un autre service de ce rendez-vous : <strong>{conflict.staffName}</strong>{' '}
            est déjà réservée pour « {conflict.otherBlockLabel} ».
          </>
        )}
      </span>
    </div>
  );
}
