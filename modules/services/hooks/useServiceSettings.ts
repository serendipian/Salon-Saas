import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('service_settings')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      const raw = data?.service_settings as Record<string, unknown> | null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        defaultDuration: typeof raw.defaultDuration === 'number' ? raw.defaultDuration : DEFAULTS.defaultDuration,
        defaultVariantName: typeof raw.defaultVariantName === 'string' ? raw.defaultVariantName : DEFAULTS.defaultVariantName,
        showCostsInList: typeof raw.showCostsInList === 'boolean' ? raw.showCostsInList : DEFAULTS.showCostsInList,
        defaultView: raw.defaultView === 'card' || raw.defaultView === 'table' ? raw.defaultView : DEFAULTS.defaultView,
      } satisfies ServiceSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: ServiceSettings) => {
      const { error } = await supabase
        .from('salons')
        .update({ service_settings: settings as any })
        .eq('id', salonId);
      if (error) throw error;
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
