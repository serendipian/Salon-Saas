import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { ServiceSettings } from '../../../types';

const DEFAULTS: ServiceSettings = {
  defaultDuration: 60,
  defaultVariantName: 'Standard',
  showCostsInList: false,
  defaultView: 'table',
};

export function useServiceSettings() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  const { data: serviceSettings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['service_settings', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', 'service_settings');
      params.append('id', `eq.${salonId}`);
      params.append('limit', '1');
      const data = await rawSelect<{ service_settings: Record<string, unknown> | null }>(
        'salons',
        params.toString(),
        signal,
      );
      const raw = data[0]?.service_settings ?? null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        defaultDuration:
          typeof raw.defaultDuration === 'number' ? raw.defaultDuration : DEFAULTS.defaultDuration,
        defaultVariantName:
          typeof raw.defaultVariantName === 'string'
            ? raw.defaultVariantName
            : DEFAULTS.defaultVariantName,
        showCostsInList:
          typeof raw.showCostsInList === 'boolean' ? raw.showCostsInList : DEFAULTS.showCostsInList,
        defaultView:
          raw.defaultView === 'card' || raw.defaultView === 'table'
            ? raw.defaultView
            : DEFAULTS.defaultView,
      } satisfies ServiceSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: ServiceSettings) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${salonId}`);
      await rawUpdate('salons', params.toString(), { service_settings: settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_settings', salonId] });
      toastOnSuccess('Paramètres des services enregistrés')();
    },
    onError: toastOnError('Impossible de modifier les paramètres des services'),
  });

  return {
    serviceSettings,
    isLoading,
    updateServiceSettings: (settings: ServiceSettings) => updateSettingsMutation.mutate(settings),
  };
}
