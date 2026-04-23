// modules/settings/hooks/useSettings.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { supabase } from '../../../lib/supabase';
import { rawSelect } from '../../../lib/supabaseRaw';
import type { ExpenseCategorySetting, RecurringExpense, SalonSettings } from '../../../types';
import {
  toExpenseCategory,
  toExpenseCategoryInsert,
  toRecurringExpense,
  toRecurringExpenseInsert,
  toSalonSettings,
  toSalonUpdate,
} from '../mappers';

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
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('id', `eq.${salonId}`);
      // biome-ignore lint/suspicious/noExplicitAny: toSalonSettings accepts row shape narrower than generated types
      const rows = await rawSelect<any>('salons', params.toString(), signal);
      if (rows.length === 0) throw new Error('Salon introuvable');
      return toSalonSettings(rows[0]);
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SalonSettings) => {
      const { error } = await supabase
        .from('salons')
        .update(toSalonUpdate(settings) as any)
        .eq('id', salonId);
      if (error) throw error;
      return settings;
    },
    onSuccess: (settings) => {
      queryClient.invalidateQueries({ queryKey: ['salon_settings', salonId] });
      // Sync AuthContext so sidebar/header reflect updated name etc.
      refreshActiveSalon({
        name: settings.name,
        currency: settings.currency,
        logo_url: settings.logoUrl,
      });
      toastOnSuccess('Paramètres enregistrés')();
    },
    onError: toastOnError('Impossible de modifier les paramètres du salon'),
  });

  // --- Expense Categories ---
  const { data: expenseCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['expense_categories', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'sort_order.asc.nullslast');
      // biome-ignore lint/suspicious/noExplicitAny: toExpenseCategory accepts row shape narrower than generated types
      const data = await rawSelect<any>('expense_categories', params.toString(), signal);
      return data.map(toExpenseCategory);
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

      const existingIds = new Set((existing ?? []).map((c) => c.id));
      const newIds = new Set(categories.map((c) => c.id));

      // Soft-delete removed categories
      const toDelete = [...existingIds].filter((id) => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete)
          .eq('salon_id', salonId);
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
            .eq('id', cat.id)
            .eq('salon_id', salonId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('expense_categories').insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories', salonId] });
    },
    onError: toastOnError('Impossible de modifier les catégories de dépenses'),
  });

  // --- Recurring Expenses ---
  const { data: recurringExpenses = [], isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['recurring_expenses', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'name');
      // biome-ignore lint/suspicious/noExplicitAny: toRecurringExpense accepts row shape narrower than generated types
      const data = await rawSelect<any>('recurring_expenses', params.toString(), signal);
      return data.map(toRecurringExpense);
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

      const existingIds = new Set((existing ?? []).map((e) => e.id));
      const newIds = new Set(expenses.map((e) => e.id));

      // Soft-delete removed
      const toDelete = [...existingIds].filter((id) => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('recurring_expenses')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete)
          .eq('salon_id', salonId);
        if (error) throw error;
      }

      // Upsert remaining
      for (const expense of expenses) {
        const row = toRecurringExpenseInsert(expense, salonId);
        if (existingIds.has(expense.id)) {
          const { error } = await supabase
            .from('recurring_expenses')
            .update({
              name: row.name,
              amount: row.amount,
              frequency: row.frequency,
              next_date: row.next_date,
            })
            .eq('id', expense.id)
            .eq('salon_id', salonId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('recurring_expenses').insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses', salonId] });
    },
    onError: toastOnError('Impossible de modifier les dépenses récurrentes'),
  });

  // Default settings fallback while loading
  const defaultSettings: SalonSettings = {
    name: activeSalon?.name ?? '',
    address: '',
    street: '',
    city: '',
    postalCode: '',
    country: '',
    neighborhood: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    logoUrl: activeSalon?.logo_url ?? null,
    instagram: '',
    facebook: '',
    tiktok: '',
    googleMapsUrl: '',
    businessRegistration: '',
    currency: activeSalon?.currency ?? 'EUR',
    vatRate: 20,
  };

  return {
    salonSettings: salonSettings ?? defaultSettings,
    expenseCategories,
    recurringExpenses,
    isLoading: isLoadingSettings || isLoadingCategories || isLoadingRecurring,
    updateSalonSettings: (settings: SalonSettings) => updateSettingsMutation.mutateAsync(settings),
    updateExpenseCategories: (categories: ExpenseCategorySetting[]) =>
      updateExpenseCategoriesMutation.mutate(categories),
    updateRecurringExpenses: (expenses: RecurringExpense[]) =>
      updateRecurringExpensesMutation.mutate(expenses),
  };
};
