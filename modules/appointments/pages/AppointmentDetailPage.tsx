import type React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatName } from '../../../lib/format';
import type { CancellationReason } from '../../../types';
import { AppointmentDetails } from '../components/AppointmentDetails';
import { CancelAppointmentModal } from '../components/CancelAppointmentModal';
import { useAppointments } from '../hooks/useAppointments';

export const AppointmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allAppointments, cancelAppointments, isCancelling } = useAppointments();

  const appointment = allAppointments.find((a) => a.id === id);
  const [cancelRequest, setCancelRequest] = useState<string[] | null>(null);

  const cancelSubject = useMemo(() => {
    if (!cancelRequest || cancelRequest.length === 0 || !appointment) return undefined;
    if (cancelRequest.length === 1) return appointment.serviceName || undefined;
    return formatName(appointment.clientName) || undefined;
  }, [cancelRequest, appointment]);

  if (!appointment) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Rendez-vous introuvable
      </div>
    );
  }

  const handleConfirmCancel = async (reason: CancellationReason, note: string) => {
    if (!cancelRequest) return;
    try {
      await cancelAppointments(cancelRequest, reason, note || undefined);
      setCancelRequest(null);
    } catch {
      // Error toast handled by mutation onError; keep modal open for retry.
    }
  };

  return (
    <>
      <AppointmentDetails
        appointment={appointment}
        allAppointments={allAppointments}
        onBack={() => navigate('/calendar')}
        onEdit={() => navigate(`/calendar/${id}/edit`)}
        onRequestCancel={(ids) => setCancelRequest(ids)}
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
