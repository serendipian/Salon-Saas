// modules/settings/hooks/useSettings.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { rawInsert, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
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
      params.append('limit', '1');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('salons', params.toString(), signal);
      const row = data[0];
      if (!row) throw new Error('Salon introuvable');
      return toSalonSettings(row);
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SalonSettings) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${salonId}`);
      await rawUpdate('salons', params.toString(), toSalonUpdate(settings));
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
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('expense_categories', params.toString(), signal);
      return data.map(toExpenseCategory);
    },
    enabled: !!salonId,
  });

  const updateExpenseCategoriesMutation = useMutation({
    mutationFn: async (categories: ExpenseCategorySetting[]) => {
      // Fetch existing IDs
      const fetchParams = new URLSearchParams();
      fetchParams.append('select', 'id');
      fetchParams.append('salon_id', `eq.${salonId}`);
      fetchParams.append('deleted_at', 'is.null');
      const existing = await rawSelect<{ id: string }>(
        'expense_categories',
        fetchParams.toString(),
      );

      const existingIds = new Set(existing.map((c) => c.id));
      const newIds = new Set(categories.map((c) => c.id));

      // Soft-delete removed categories
      const toDelete = [...existingIds].filter((id) => !newIds.has(id));
      if (toDelete.length > 0) {
        const delParams = new URLSearchParams();
        delParams.append('id', `in.(${toDelete.join(',')})`);
        delParams.append('salon_id', `eq.${salonId}`);
        await rawUpdate('expense_categories', delParams.toString(), {
          deleted_at: new Date().toISOString(),
        });
      }

      // Upsert remaining categories
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toExpenseCategoryInsert(cat, salonId, i);
        if (existingIds.has(cat.id)) {
          const updParams = new URLSearchParams();
          updParams.append('id', `eq.${cat.id}`);
          updParams.append('salon_id', `eq.${salonId}`);
          await rawUpdate('expense_categories', updParams.toString(), {
            name: row.name,
            color: row.color,
            sort_order: row.sort_order,
          });
        } else {
          await rawInsert('expense_categories', row);
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
      params.append('order', 'name.asc');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('recurring_expenses', params.toString(), signal);
      return data.map(toRecurringExpense);
    },
    enabled: !!salonId,
  });

  const updateRecurringExpensesMutation = useMutation({
    mutationFn: async (expenses: RecurringExpense[]) => {
      // Fetch existing IDs
      const fetchParams = new URLSearchParams();
      fetchParams.append('select', 'id');
      fetchParams.append('salon_id', `eq.${salonId}`);
      fetchParams.append('deleted_at', 'is.null');
      const existing = await rawSelect<{ id: string }>(
        'recurring_expenses',
        fetchParams.toString(),
      );

      const existingIds = new Set(existing.map((e) => e.id));
      const newIds = new Set(expenses.map((e) => e.id));

      // Soft-delete removed
      const toDelete = [...existingIds].filter((id) => !newIds.has(id));
      if (toDelete.length > 0) {
        const delParams = new URLSearchParams();
        delParams.append('id', `in.(${toDelete.join(',')})`);
        delParams.append('salon_id', `eq.${salonId}`);
        await rawUpdate('recurring_expenses', delParams.toString(), {
          deleted_at: new Date().toISOString(),
        });
      }

      // Upsert remaining
      for (const expense of expenses) {
        const row = toRecurringExpenseInsert(expense, salonId);
        if (existingIds.has(expense.id)) {
          const updParams = new URLSearchParams();
          updParams.append('id', `eq.${expense.id}`);
          updParams.append('salon_id', `eq.${salonId}`);
          await rawUpdate('recurring_expenses', updParams.toString(), {
            name: row.name,
            amount: row.amount,
            frequency: row.frequency,
            next_date: row.next_date,
          });
        } else {
          await rawInsert('recurring_expenses', row);
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
