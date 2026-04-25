// hooks/useLinkedTransaction.ts
//
// Resolves the POS transaction (if any) linked to an appointment OR any of
// its sibling appointments in the same group. Used by AppointmentDetails to
// render a "Voir le reçu" button that deep-links to the print view.
//
// Why look up via the whole group: create_transaction stores only the anchor
// appointment id on transactions.appointment_id. A multi-service group rung
// up in one go has just one transaction row — the anchor — and the siblings
// share its receipt. To find the transaction for a given appointment we
// either match its own id or any sibling that's in the same group.
//
// allAppointments is passed in by the caller (AppointmentDetails already
// receives it as a prop) so the hook doesn't need to call useAppointments
// internally and double-register realtime subscriptions.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Appointment } from '../types';

export interface LinkedTransactionRef {
  id: string;
  ticketNumber: number;
}

export const useLinkedTransaction = (
  appointment: Appointment | null | undefined,
  allAppointments: Appointment[],
) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Resolve the candidate appointment ids: this appointment plus any siblings
  // sharing its groupId.
  const candidateIds: string[] = (() => {
    if (!appointment) return [];
    if (!appointment.groupId) return [appointment.id];
    const ids = allAppointments
      .filter((a) => a.groupId === appointment.groupId)
      .map((a) => a.id);
    return ids.length > 0 ? ids : [appointment.id];
  })();

  return useQuery({
    queryKey: ['linked-transaction', salonId, candidateIds],
    queryFn: async (): Promise<LinkedTransactionRef | null> => {
      if (candidateIds.length === 0) return null;
      const { data, error } = await supabase
        .from('transactions')
        .select('id, ticket_number')
        .eq('salon_id', salonId)
        .in('appointment_id', candidateIds)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, ticketNumber: data.ticket_number };
    },
    enabled: !!salonId && candidateIds.length > 0,
  });
};
