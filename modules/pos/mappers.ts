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
  original_item_id: string | null;
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
  appointment_id: string | null;
  date: string;
  total: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  type: string;
  original_transaction_id: string | null;
  reason_category: string | null;
  reason_note: string | null;
  transaction_items: TransactionItemRow[];
  transaction_payments: TransactionPaymentRow[];
  clients: { first_name: string; last_name: string } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
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
    originalItemId: item.original_item_id ?? undefined,
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
    appointmentId: row.appointment_id ?? undefined,
    items,
    payments,
    type: (row.type as 'SALE' | 'VOID' | 'REFUND') ?? 'SALE',
    originalTransactionId: row.original_transaction_id ?? undefined,
    reasonCategory: row.reason_category ?? undefined,
    reasonNote: row.reason_note ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdByName: row.profiles
      ? `${row.profiles.first_name ?? ''} ${row.profiles.last_name ?? ''}`.trim() || undefined
      : undefined,
  };
}

// --- Frontend → RPC Payload ---

export function toTransactionRpcPayload(
  cart: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string,
  appointmentId?: string
) {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const p_items = cart.map(item => ({
    reference_id: item.referenceId,
    type: item.type,
    name: item.name,
    variant_name: item.variantName ?? null,
    price: round2(item.price),
    original_price: round2(item.originalPrice ?? item.price),
    quantity: item.quantity,
    cost: round2(item.cost ?? 0),
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
    p_appointment_id: appointmentId ?? null,
    p_items,
    p_payments,
  };
}

// --- Transaction status helpers ---

export type TransactionStatus = 'active' | 'voided' | 'partially_refunded' | 'fully_refunded' | 'reversal';

export function getTransactionStatus(
  transaction: Transaction,
  allTransactions: Transaction[]
): TransactionStatus {
  if (transaction.type !== 'SALE') return 'reversal';

  const relatedVoid = allTransactions.find(
    t => t.type === 'VOID' && t.originalTransactionId === transaction.id
  );
  if (relatedVoid) return 'voided';

  const refunds = allTransactions.filter(
    t => t.type === 'REFUND' && t.originalTransactionId === transaction.id
  );
  if (refunds.length === 0) return 'active';

  const totalRefunded = refunds.reduce((sum, r) => sum + Math.abs(r.total), 0);
  if (totalRefunded >= transaction.total - 0.01) return 'fully_refunded';
  return 'partially_refunded';
}

export function getRefundedAmount(
  transactionId: string,
  allTransactions: Transaction[]
): number {
  return allTransactions
    .filter(t => t.type === 'REFUND' && t.originalTransactionId === transactionId)
    .reduce((sum, r) => sum + Math.abs(r.total), 0);
}
