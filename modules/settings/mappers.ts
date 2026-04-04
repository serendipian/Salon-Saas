import type { SalonSettings, WorkSchedule, ExpenseCategorySetting, RecurringExpense } from '../../types';

// --- Salon Settings (reads from salons table row) ---

interface SalonRow {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  currency: string;
  vat_rate: number;
  timezone: string;
  schedule: WorkSchedule | null;
  plan_id: string | null;
  subscription_tier: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toSalonSettings(row: SalonRow): SalonSettings {
  return {
    name: row.name,
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    website: row.website ?? '',
    logoUrl: row.logo_url,
    currency: row.currency,
    vatRate: row.vat_rate,
    schedule: row.schedule ?? undefined,
  };
}

export function toSalonUpdate(settings: SalonSettings) {
  return {
    name: settings.name,
    address: settings.address || null,
    phone: settings.phone || null,
    email: settings.email || null,
    website: settings.website || null,
    logo_url: settings.logoUrl,
    currency: settings.currency,
    vat_rate: settings.vatRate,
    schedule: settings.schedule ?? null,
  };
}

// --- Expense Categories ---

interface ExpenseCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toExpenseCategory(row: ExpenseCategoryRow): ExpenseCategorySetting {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? 'bg-slate-100 text-slate-700',
  };
}

export function toExpenseCategoryInsert(cat: ExpenseCategorySetting, salonId: string, sortOrder: number) {
  return {
    id: cat.id || undefined,
    salon_id: salonId,
    name: cat.name,
    color: cat.color,
    sort_order: sortOrder,
  };
}

// --- Recurring Expenses ---

interface RecurringExpenseRow {
  id: string;
  salon_id: string;
  name: string;
  amount: number;
  frequency: string;
  next_date: string;
  category_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toRecurringExpense(row: RecurringExpenseRow): RecurringExpense {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    frequency: row.frequency as RecurringExpense['frequency'],
    nextDate: row.next_date,
  };
}

export function toRecurringExpenseInsert(expense: RecurringExpense, salonId: string) {
  return {
    id: expense.id || undefined,
    salon_id: salonId,
    name: expense.name,
    amount: expense.amount,
    frequency: expense.frequency,
    next_date: expense.nextDate,
    active: true,
  };
}
