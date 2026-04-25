import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { SupplierSettings } from '../../../types';

const DEFAULTS: SupplierSettings = {
  defaultPaymentTerms: '30 jours',
  poPrefix: 'BC-',
  poNextNumber: 1,
  defaultView: 'table',
};

export function useSupplierSettings() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  const { data: supplierSettings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['supplier_settings', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', 'supplier_settings');
      params.append('id', `eq.${salonId}`);
      params.append('limit', '1');
      const data = await rawSelect<{ supplier_settings: Record<string, unknown> | null }>(
        'salons',
        params.toString(),
        signal,
      );
      const raw = data[0]?.supplier_settings ?? null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        defaultPaymentTerms:
          typeof raw.defaultPaymentTerms === 'string'
            ? raw.defaultPaymentTerms
            : DEFAULTS.defaultPaymentTerms,
        poPrefix: typeof raw.poPrefix === 'string' ? raw.poPrefix : DEFAULTS.poPrefix,
        poNextNumber:
          typeof raw.poNextNumber === 'number' ? raw.poNextNumber : DEFAULTS.poNextNumber,
        defaultView:
          raw.defaultView === 'card' || raw.defaultView === 'table'
            ? raw.defaultView
            : DEFAULTS.defaultView,
      } satisfies SupplierSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SupplierSettings) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${salonId}`);
      await rawUpdate('salons', params.toString(), { supplier_settings: settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_settings', salonId] });
      toastOnSuccess('Paramètres des fournisseurs enregistrés')();
    },
    onError: toastOnError('Impossible de modifier les paramètres des fournisseurs'),
  });

  return {
    supplierSettings,
    isLoading,
    updateSupplierSettings: (settings: SupplierSettings) => updateSettingsMutation.mutate(settings),
  };
}
