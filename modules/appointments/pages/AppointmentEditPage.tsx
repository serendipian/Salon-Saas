
import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { usePacks } from '../../services/hooks/usePacks';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { supabase } from '../../../lib/supabase';
import { ServiceBlockState } from '../../../types';
import AppointmentBuilder from '../components/AppointmentBuilder';
import AppointmentBuilderMobile from '../components/AppointmentBuilderMobile';

export const AppointmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useMediaQuery();
  const { allAppointments, isLoading, editAppointmentGroup, deleteAppointment } = useAppointments();
  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories, favorites } = useServices();
  const { allStaff: team } = useTeam();
  const { validPacks } = usePacks();

  const selectedAppt = allAppointments.find(a => a.id === id);

  // IDs of appointments in this group — exclude from availability check
  const excludeAppointmentIds = useMemo(() => {
    if (!selectedAppt) return [];
    if (selectedAppt.groupId) {
      return allAppointments.filter(a => a.groupId === selectedAppt.groupId).map(a => a.id);
    }
    return [selectedAppt.id];
  }, [selectedAppt, allAppointments]);

  const { editInitialData, unresolvedCount } = useMemo(() => {
    if (!selectedAppt) return { editInitialData: undefined, unresolvedCount: 0 };

    const groupAppts = selectedAppt.groupId
      ? allAppointments.filter((a) => a.groupId === selectedAppt.groupId)
      : [selectedAppt];

    // Sort chronologically — required for the merge heuristic
    const sorted = [...groupAppts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const serviceBlocks: ServiceBlockState[] = [];
    let current: ServiceBlockState | null = null;
    let currentCursorEnd: Date | null = null;
    let unresolved = 0;

    for (const appt of sorted) {
      const apptStart = new Date(appt.date);
      const apptEnd = new Date(apptStart.getTime() + (appt.durationMinutes ?? 0) * 60_000);
      const dateStr = `${apptStart.getFullYear()}-${String(apptStart.getMonth() + 1).padStart(2, '0')}-${String(apptStart.getDate()).padStart(2, '0')}`;

      const svc = services.find((s) => s.id === appt.serviceId);
      // Resolve variant: exact ID match first, then fall back to price+duration
      // for legacy rows with null variantId. If neither path yields a variant,
      // skip this appointment — an empty variantId would make the block
      // unsaveable and surface an opaque schema error to the user.
      const variant = appt.variantId
        ? svc?.variants.find((v) => v.id === appt.variantId)
        : svc?.variants.find((v) => v.price === appt.price && v.durationMinutes === appt.durationMinutes);

      if (!svc || !variant) {
        unresolved += 1;
        current = null; // break the merge chain at a hole
        currentCursorEnd = null;
        continue;
      }

      const item = {
        serviceId: svc.id,
        variantId: variant.id,
      };

      const canMerge =
        current != null &&
        !current.packId && // pack blocks are atomic
        current.staffId === (appt.staffId ?? null) &&
        current.categoryId === (svc.categoryId ?? null) &&
        current.date === dateStr &&
        currentCursorEnd != null &&
        currentCursorEnd.getTime() === apptStart.getTime();

      if (canMerge && current) {
        current.items.push(item);
        currentCursorEnd = apptEnd;
      } else {
        current = {
          id: crypto.randomUUID(),
          categoryId: svc.categoryId ?? null,
          items: [item],
          staffId: appt.staffId ?? null,
          date: dateStr,
          hour: apptStart.getHours(),
          minute: apptStart.getMinutes(),
        };
        serviceBlocks.push(current);
        currentCursorEnd = apptEnd;
      }
    }

    return {
      editInitialData: {
        clientId: selectedAppt.clientId,
        status: selectedAppt.status,
        notes: selectedAppt.notes ?? '',
        reminderMinutes: null as number | null,
        serviceBlocks,
      },
      unresolvedCount: unresolved,
    };
  }, [selectedAppt, allAppointments, services]);

  // Warn once per load if any appointments in the group couldn't be loaded
  // into the editor (deleted service or unresolvable variant).
  const warnedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${id}:${unresolvedCount}`;
    if (unresolvedCount > 0 && warnedRef.current !== key) {
      warnedRef.current = key;
      addToast({
        type: 'warning',
        message:
          unresolvedCount === 1
            ? "Une prestation n'a pas pu être chargée (service ou variante supprimé). Le bloc a été ignoré."
            : `${unresolvedCount} prestations n'ont pas pu être chargées (service ou variante supprimé). Les blocs ont été ignorés.`,
      });
    }
  }, [unresolvedCount, id, addToast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Chargement...
      </div>
    );
  }

  if (!selectedAppt) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Rendez-vous introuvable
      </div>
    );
  }

  const handleSave = async (payload: Omit<Parameters<typeof editAppointmentGroup>[0], 'oldAppointmentId'> & { newClient: { firstName: string; lastName: string; phone: string } | null }) => {
    if (payload.newClient && activeSalon) {
      const { data: newClientRow, error: clientError } = await supabase
        .from('clients')
        .insert({
          salon_id: activeSalon.id,
          first_name: payload.newClient.firstName,
          last_name: payload.newClient.lastName || null,
          phone: payload.newClient.phone,
        })
        .select('id')
        .single();

      if (clientError) {
        addToast({ type: 'error', message: 'Erreur lors de la création du client' });
        throw clientError;
      }
      payload.clientId = newClientRow.id;
    }
    await editAppointmentGroup({
      oldAppointmentId: id!,
      ...payload,
    });
    navigate('/calendar');
  };

  const handleDelete = async () => {
    try {
      await deleteAppointment(id!);
      navigate('/calendar');
    } catch {
      // Error toast handled by mutation's onError
    }
  };

  const sharedProps = {
    services,
    categories: serviceCategories,
    favorites,
    packs: validPacks,
    team,
    clients,
    appointments: allAppointments,
    excludeAppointmentIds,
    initialData: editInitialData,
    onSave: handleSave,
    onDelete: handleDelete,
    onCancel: () => navigate(`/calendar/${id}`),
  };

  if (isMobile) {
    return <AppointmentBuilderMobile {...sharedProps} />;
  }
  return <AppointmentBuilder {...sharedProps} />;
};
