import { Activity, CalendarDays, ChevronLeft, TrendingUp, User, Wallet } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTransactions } from '../../../hooks/useTransactions';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { useSettings } from '../../settings/hooks/useSettings';
import { InvitationModal } from '../components/InvitationModal';
import { StaffActivityTab } from '../components/StaffActivityTab';
import { StaffAgendaTab } from '../components/StaffAgendaTab';
import { StaffHeader } from '../components/StaffHeader';
import { StaffPerformanceTab } from '../components/StaffPerformanceTab';
import { StaffProfileTab } from '../components/StaffProfileTab';
import { StaffRemunerationTab } from '../components/StaffRemunerationTab';
import { useInvitation } from '../hooks/useInvitation';
import { useStaffDetail } from '../hooks/useStaffDetail';

const TABS = [
  { key: 'profil', label: 'Profil', icon: User },
  { key: 'performance', label: 'Performance', icon: TrendingUp },
  { key: 'remuneration', label: 'Rémunération', icon: Wallet },
  { key: 'agenda', label: 'Agenda', icon: CalendarDays },
  { key: 'activite', label: 'Activité', icon: Activity },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const StaffDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = (searchParams.get('tab') as TabKey) || 'profil';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Sync tab when URL param changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabKey;
    if (tab && TABS.some((t) => t.key === tab)) setActiveTab(tab);
  }, [searchParams]);

  const staffSlug = slug ?? '';
  const { staff, isLoading, isArchived, updateSection, isUpdating, archive, restore, loadPii } =
    useStaffDetail(staffSlug);
  const { invitation, createInvitation, cancelInvitation, isCancelling } = useInvitation(
    staff?.id ?? '',
  );
  const { allAppointments } = useAppointments();

  const monthRange = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return { from: monthStart.toISOString(), to: new Date().toISOString() };
  }, []);

  const { transactions } = useTransactions(monthRange);
  const { salonSettings } = useSettings();

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  // Monthly stats for header
  const monthlyStats = useMemo(() => {
    if (!staff || !transactions) return { revenue: 0, appointments: 0 };
    const revenue = (transactions || []).reduce((sum: number, t: any) => {
      return (
        sum +
        (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0)
      );
    }, 0);
    // monthRange already scopes transactions to current month from DB;
    // allAppointments is NOT date-scoped (H-1 scope), so filter stays
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const apptCount = (allAppointments || []).filter(
      (a: any) =>
        a.staffId === staff.id && new Date(a.date) >= monthStart && a.status !== 'CANCELLED',
    ).length;
    return { revenue, appointments: apptCount };
  }, [staff, transactions, allAppointments]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Membre introuvable</p>
        <button
          onClick={() => navigate('/team')}
          className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
        >
          Retour à l'équipe
        </button>
      </div>
    );
  }

  const handleArchive = async () => {
    await archive();
    await navigate('/team');
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/team')}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="w-4 h-4" /> Équipe
      </button>

      <StaffHeader
        staff={staff}
        isArchived={isArchived}
        monthlyRevenue={monthlyStats.revenue}
        monthlyAppointments={monthlyStats.appointments}
        hasPendingInvitation={!!invitation}
        invitationExpiresAt={invitation?.expires_at}
        onInvite={() => setShowInviteModal(true)}
        onCancelInvitation={cancelInvitation}
        isCancellingInvitation={isCancelling}
        onArchive={handleArchive}
        onRestore={restore}
      />

      {!isArchived && (
        <>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'profil' && (
            <StaffProfileTab
              staff={staff}
              loadPii={loadPii}
              onSave={updateSection}
              isSaving={isUpdating}
              currencySymbol={currencySymbol}
              onArchive={handleArchive}
              onSwitchTab={(tab: string) => setActiveTab(tab as TabKey)}
            />
          )}
          {activeTab === 'performance' && <StaffPerformanceTab staffId={staff.id} />}
          {activeTab === 'remuneration' && (
            <StaffRemunerationTab
              staff={staff}
              currencySymbol={currencySymbol}
              onSave={updateSection}
            />
          )}
          {activeTab === 'agenda' && <StaffAgendaTab staff={staff} />}
          {activeTab === 'activite' && <StaffActivityTab staffId={staff.id} />}
        </>
      )}

      {showInviteModal && (
        <InvitationModal
          staffRole={staff.role}
          onCreateInvitation={createInvitation}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};
