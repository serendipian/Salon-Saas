// modules/accounting/mappers.ts
import type { Expense, PaymentMethod } from '../../types';

// --- Row interfaces matching Supabase JOIN result ---

export interface ExpenseRow {
  id: string;
  salon_id: string;
  date: string;
  description: string;
  category_id: string;
  amount: number;
  supplier_id: string | null;
  proof_url: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  expense_categories: { name: string; color: string } | null;
  suppliers: { name: string } | null;
}

// --- Row → Frontend ---

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category_id,
    categoryName: row.expense_categories?.name ?? undefined,
    categoryColor: row.expense_categories?.color ?? undefined,
    amount: row.amount,
    supplier: row.suppliers?.name ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    proofUrl: row.proof_url ?? undefined,
    paymentMethod: (row.payment_method as PaymentMethod) ?? undefined,
  };
}

// --- Frontend → Insert ---

export function toExpenseInsert(expense: Omit<Expense, 'id'>, salonId: string) {
  return {
    salon_id: salonId,
    date: expense.date,
    description: expense.description,
    category_id: expense.category,
    amount: expense.amount,
    supplier_id: expense.supplierId ?? null,
    proof_url: expense.proofUrl ?? null,
    payment_method: expense.paymentMethod ?? null,
  };
}
