import type { ServiceBlockState } from '../../../types';

export type MissingField =
  | { kind: 'client' }
  | { kind: 'service'; blockIndex: number }
  | { kind: 'staff'; blockIndex: number }
  | { kind: 'datetime'; blockIndex: number };

interface BuildInput {
  clientId: string | null;
  newClient: { firstName: string; lastName: string; phone: string } | null;
  blocks: ServiceBlockState[];
}

export function buildMissingFields(input: BuildInput): MissingField[] {
  const { clientId, newClient, blocks } = input;
  const out: MissingField[] = [];

  if (!clientId && !newClient) out.push({ kind: 'client' });

  blocks.forEach((b, i) => {
    if (b.items.length === 0) {
      out.push({ kind: 'service', blockIndex: i });
      return;
    }
    if (!b.staffId && b.staffConfirmed !== true) {
      out.push({ kind: 'staff', blockIndex: i });
    }
    if (!b.date || b.hour === null) {
      out.push({ kind: 'datetime', blockIndex: i });
    }
  });

  return out;
}

const ORDER: MissingField['kind'][] = ['client', 'service', 'staff', 'datetime'];
const LABELS: Record<MissingField['kind'], string> = {
  client: 'Client',
  service: 'Service',
  staff: 'Membre',
  datetime: 'Date & heure',
};

export function humanizeMissing(fields: MissingField[]): string {
  if (fields.length === 0) return '';
  const kinds = new Set(fields.map((f) => f.kind));
  return ORDER.filter((k) => kinds.has(k))
    .map((k) => LABELS[k])
    .join(', ');
}
