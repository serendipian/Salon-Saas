// modules/pos/mappers.ts
import { CartItem, PaymentEntry, Transaction } from '../../types';

// --- Row interfaces matching Supabase JOIN result ---

export interface TransactionItemRow {
  id: string;
  reference_id: string;
  type: string;
  name: string;
  variant_name: string | null;
  price: number;
  original_price: number | null;
  quantity: number;
  cost: number | null;
  note: string | null;
  staff_id: string | null;
  staff_name: string | null;
}

export interface TransactionPaymentRow {
  id: string;
  method: string;
  amount: number;
}

export interface TransactionRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  date: string;
  total: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  transaction_items: TransactionItemRow[];
  transaction_payments: TransactionPaymentRow[];
  clients: { first_name: string; last_name: string } | null;
}

// --- Row → Frontend ---

export function toTransaction(row: TransactionRow): Transaction {
  const clientName = row.clients
    ? `${row.clients.first_name} ${row.clients.last_name}`.trim()
    : undefined;

  const items: CartItem[] = (row.transaction_items ?? []).map(item => ({
    id: item.id,
    referenceId: item.reference_id,
    type: item.type as 'SERVICE' | 'PRODUCT',
    name: item.name,
    variantName: item.variant_name ?? undefined,
    price: item.price,
    originalPrice: item.original_price ?? undefined,
    quantity: item.quantity,
    cost: item.cost ?? undefined,
    note: item.note ?? undefined,
    staffId: item.staff_id ?? undefined,
    staffName: item.staff_name ?? undefined,
  }));

  // Map DB constants back to French labels for display
  const dbMethodToLabel: Record<string, string> = {
    'CASH': 'Espèces',
    'CARD': 'Carte Bancaire',
    'TRANSFER': 'Virement',
    'CHECK': 'Chèque',
    'MOBILE': 'Mobile',
    'OTHER': 'Autre',
  };

  const payments: PaymentEntry[] = (row.transaction_payments ?? []).map(p => ({
    id: p.id,
    method: dbMethodToLabel[p.method] ?? p.method,
    amount: p.amount,
  }));

  return {
    id: row.id,
    date: row.date,
    total: row.total,
    clientName,
    clientId: row.client_id ?? undefined,
    items,
    payments,
  };
}

// --- Frontend → RPC Payload ---

export function toTransactionRpcPayload(
  cart: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string
) {
  const p_items = cart.map(item => ({
    reference_id: item.referenceId,
    type: item.type,
    name: item.name,
    variant_name: item.variantName ?? null,
    price: item.price,
    original_price: item.originalPrice ?? item.price,
    quantity: item.quantity,
    cost: item.cost ?? 0,
    note: item.note ?? null,
    staff_id: item.staffId ?? null,
    staff_name: item.staffName ?? null,
  }));

  // Map French UI labels to DB constants
  const methodMap: Record<string, string> = {
    'Espèces': 'CASH',
    'Carte Bancaire': 'CARD',
    'Virement': 'TRANSFER',
    'Chèque': 'CHECK',
    'Mobile': 'MOBILE',
    'Carte Cadeau': 'OTHER',
    'Autre': 'OTHER',
  };

  const p_payments = payments.map(p => ({
    method: methodMap[p.method] ?? 'OTHER',
    amount: p.amount,
  }));

  return {
    p_salon_id: salonId,
    p_client_id: clientId ?? null,
    p_items,
    p_payments,
  };
}
