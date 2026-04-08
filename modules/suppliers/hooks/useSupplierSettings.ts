import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('supplier_settings')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      const raw = data?.supplier_settings as Record<string, unknown> | null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        defaultPaymentTerms: typeof raw.defaultPaymentTerms === 'string' ? raw.defaultPaymentTerms : DEFAULTS.defaultPaymentTerms,
        poPrefix: typeof raw.poPrefix === 'string' ? raw.poPrefix : DEFAULTS.poPrefix,
        poNextNumber: typeof raw.poNextNumber === 'number' ? raw.poNextNumber : DEFAULTS.poNextNumber,
        defaultView: raw.defaultView === 'card' || raw.defaultView === 'table' ? raw.defaultView : DEFAULTS.defaultView,
      } satisfies SupplierSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SupplierSettings) => {
      const { error } = await supabase
        .from('salons')
        .update({ supplier_settings: settings as any })
        .eq('id', salonId);
      if (error) throw error;
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
