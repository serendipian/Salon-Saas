import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { ProductSettings } from '../../../types';

const DEFAULTS: ProductSettings = {
  lowStockThreshold: 10,
  showCostsInList: false,
  defaultView: 'table',
};

export function useProductSettings() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  const { data: productSettings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['product_settings', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('product_settings')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      const raw = data?.product_settings as Record<string, unknown> | null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        lowStockThreshold: typeof raw.lowStockThreshold === 'number' ? raw.lowStockThreshold : DEFAULTS.lowStockThreshold,
        showCostsInList: typeof raw.showCostsInList === 'boolean' ? raw.showCostsInList : DEFAULTS.showCostsInList,
        defaultView: raw.defaultView === 'card' || raw.defaultView === 'table' ? raw.defaultView : DEFAULTS.defaultView,
      } satisfies ProductSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: ProductSettings) => {
      const { error } = await supabase
        .from('salons')
        .update({ product_settings: settings as unknown as Record<string, unknown> })
        .eq('id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_settings', salonId] });
      toastOnSuccess('Paramètres des produits enregistrés')();
    },
    onError: toastOnError('Impossible de modifier les paramètres des produits'),
  });

  return {
    productSettings,
    isLoading,
    updateProductSettings: (settings: ProductSettings) => updateSettingsMutation.mutate(settings),
  };
}
