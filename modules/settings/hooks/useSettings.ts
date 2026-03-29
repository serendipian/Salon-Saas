// modules/settings/hooks/useSettings.ts
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import {
  toSalonSettings,
  toSalonUpdate,
  toExpenseCategory,
  toExpenseCategoryInsert,
  toRecurringExpense,
  toRecurringExpenseInsert,
} from '../mappers';
import type { SalonSettings, ExpenseCategorySetting, RecurringExpense } from '../../../types';

export const useSettings = () => {
  const { activeSalon, refreshActiveSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  const handleSalonChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['salon_settings', salonId] });
  }, [queryClient, salonId]);

  useRealtimeSync('salons', { onEvent: handleSalonChange, filterOverride: `id=eq.${salonId}` });
  useRealtimeSync('expense_categories');
  useRealtimeSync('recurring_expenses');

  // --- Salon Settings (from salons table) ---
  const { data: salonSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['salon_settings', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('*')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      return toSalonSettings(data);
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SalonSettings) => {
      const { error } = await supabase
        .from('salons')
        .update(toSalonUpdate(settings))
        .eq('id', salonId);
      if (error) throw error;
      return settings;
    },
    onSuccess: (settings) => {
      queryClient.invalidateQueries({ queryKey: ['salon_settings', salonId] });
      // Sync AuthContext so sidebar/header reflect updated name etc.
      refreshActiveSalon({ name: settings.name, currency: settings.currency });
      toastOnSuccess('Paramètres enregistrés')();
    },
    onError: toastOnError("Impossible de modifier les paramètres du salon"),
  });

  // --- Expense Categories ---
  const { data: expenseCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['expense_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toExpenseCategory);
    },
    enabled: !!salonId,
  });

  const updateExpenseCategoriesMutation = useMutation({
    mutationFn: async (categories: ExpenseCategorySetting[]) => {
      // Fetch existing IDs
      const { data: existing, error: fetchErr } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('salon_id', salonId)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(c => c.id));
      const newIds = new Set(categories.map(c => c.id));

      // Soft-delete removed categories
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining categories
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toExpenseCategoryInsert(cat, salonId, i);
        if (existingIds.has(cat.id)) {
          const { error } = await supabase
            .from('expense_categories')
            .update({ name: row.name, color: row.color, sort_order: row.sort_order })
            .eq('id', cat.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('expense_categories')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories', salonId] });
    },
    onError: toastOnError("Impossible de modifier les catégories de dépenses"),
  });

  // --- Recurring Expenses ---
  const { data: recurringExpenses = [], isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['recurring_expenses', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toRecurringExpense);
    },
    enabled: !!salonId,
  });

  const updateRecurringExpensesMutation = useMutation({
    mutationFn: async (expenses: RecurringExpense[]) => {
      // Fetch existing IDs
      const { data: existing, error: fetchErr } = await supabase
        .from('recurring_expenses')
        .select('id')
        .eq('salon_id', salonId)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(e => e.id));
      const newIds = new Set(expenses.map(e => e.id));

      // Soft-delete removed
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('recurring_expenses')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining
      for (const expense of expenses) {
        const row = toRecurringExpenseInsert(expense, salonId);
        if (existingIds.has(expense.id)) {
          const { error } = await supabase
            .from('recurring_expenses')
            .update({ name: row.name, amount: row.amount, frequency: row.frequency, next_date: row.next_date })
            .eq('id', expense.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recurring_expenses')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses', salonId] });
    },
    onError: toastOnError("Impossible de modifier les dépenses récurrentes"),
  });

  // Default settings fallback while loading
  const defaultSettings: SalonSettings = {
    name: activeSalon?.name ?? '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: activeSalon?.currency ?? 'EUR',
    vatRate: 20,
  };

  return {
    salonSettings: salonSettings ?? defaultSettings,
    expenseCategories,
    recurringExpenses,
    isLoading: isLoadingSettings || isLoadingCategories || isLoadingRecurring,
    updateSalonSettings: (settings: SalonSettings) => updateSettingsMutation.mutate(settings),
    updateExpenseCategories: (categories: ExpenseCategorySetting[]) =>
      updateExpenseCategoriesMutation.mutate(categories),
    updateRecurringExpenses: (expenses: RecurringExpense[]) =>
      updateRecurringExpensesMutation.mutate(expenses),
  };
};
