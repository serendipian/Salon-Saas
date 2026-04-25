import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
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
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', 'product_settings');
      params.append('id', `eq.${salonId}`);
      params.append('limit', '1');
      const data = await rawSelect<{ product_settings: Record<string, unknown> | null }>(
        'salons',
        params.toString(),
        signal,
      );
      const raw = data[0]?.product_settings ?? null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        lowStockThreshold:
          typeof raw.lowStockThreshold === 'number'
            ? raw.lowStockThreshold
            : DEFAULTS.lowStockThreshold,
        showCostsInList:
          typeof raw.showCostsInList === 'boolean' ? raw.showCostsInList : DEFAULTS.showCostsInList,
        defaultView:
          raw.defaultView === 'card' || raw.defaultView === 'table'
            ? raw.defaultView
            : DEFAULTS.defaultView,
      } satisfies ProductSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: ProductSettings) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${salonId}`);
      await rawUpdate('salons', params.toString(), { product_settings: settings });
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
