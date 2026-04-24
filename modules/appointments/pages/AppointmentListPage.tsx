import type React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useFreshness } from '../../../hooks/useFreshness';
import { formatName } from '../../../lib/format';
import type { CancellationReason } from '../../../types';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { AppointmentList } from '../components/AppointmentList';
import { CancelAppointmentModal } from '../components/CancelAppointmentModal';
import { useAppointments } from '../hooks/useAppointments';

export const AppointmentListPage: React.FC = () => {
  const navigate = useNavigate();
  const { role, activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const [showDeleted, setShowDeleted] = useState(false);
  const { lastUpdated } = useFreshness({
    queryKeyRoots: ['appointments', 'clients', 'services'],
    salonId,
  });
  const {
    appointments,
    allAppointments,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    cancelAppointments,
    isCancelling,
    updateStatus,
  } = useAppointments(showDeleted);
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  // Cancel-with-reason modal state
  const [cancelRequest, setCancelRequest] = useState<string[] | null>(null);

  // Resolve a friendly label for the modal header (service name for single, client for group).
  const cancelSubject = useMemo(() => {
    if (!cancelRequest || cancelRequest.length === 0) return undefined;
    const first = allAppointments.find((a) => a.id === cancelRequest[0]);
    if (!first) return undefined;
    if (cancelRequest.length === 1) return first.serviceName || undefined;
    return formatName(first.clientName) || undefined;
  }, [cancelRequest, allAppointments]);

  const handleConfirmCancel = async (reason: CancellationReason, note: string) => {
    if (!cancelRequest) return;
    try {
      await cancelAppointments(cancelRequest, reason, note || undefined);
      setCancelRequest(null);
    } catch {
      // Error toast handled by mutation onError; leave modal open so user can retry.
    }
  };

  return (
    <>
      <AppointmentList
        appointments={appointments}
        serviceCategories={serviceCategories}
        services={services}
        allStaff={team}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onAdd={() => navigate('/calendar/new')}
        onDetails={(id) => navigate(`/calendar/${id}`)}
        onEdit={(id) => navigate(`/calendar/${id}/edit`)}
        onRequestCancel={(ids) => setCancelRequest(ids)}
        onStatusChange={(id, status) => updateStatus(id, status)}
        showDeleted={showDeleted}
        onToggleDeleted={role === 'owner' ? () => setShowDeleted(!showDeleted) : undefined}
        freshnessUpdatedAt={lastUpdated}
      />
      <CancelAppointmentModal
        isOpen={cancelRequest !== null}
        onClose={() => {
          if (!isCancelling) setCancelRequest(null);
        }}
        scope={cancelRequest && cancelRequest.length > 1 ? 'group' : 'single'}
        count={cancelRequest?.length ?? 0}
        subjectLabel={cancelSubject}
        onConfirm={handleConfirmCancel}
        isSubmitting={isCancelling}
      />
    </>
  );
};
