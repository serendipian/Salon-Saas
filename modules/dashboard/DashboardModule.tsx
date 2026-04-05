
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus, Calendar, Users, DollarSign, ShoppingBag, XCircle, ChevronRight, ChevronDown, ChevronUp, Clock, Crown, TrendingUp, Scissors, MapPin } from 'lucide-react';
import { useTransactions } from '../../hooks/useTransactions';
import { useClients } from '../clients/hooks/useClients';
import { useAppointments } from '../appointments/hooks/useAppointments';
import { useServices } from '../services/hooks/useServices';
import { useTeam } from '../team/hooks/useTeam';
import { formatPrice } from '../../lib/format';
import { DateRange, AppointmentStatus } from '../../types';
import { DateRangePicker } from '../../components/DateRangePicker';
import { TodayCalendarCard } from './components/TodayCalendarCard';

interface MetricCardProps {
  title: string;
  value: number | string;
  trend: number | null;
  isPositive: boolean;
  subtitle?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  isCurrency?: boolean;
}

const formatCount = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

const MetricCard = ({ title, value, trend, isPositive, subtitle, icon: Icon, isCurrency = false }: MetricCardProps) => {
  const trendIsZero = trend !== null && Math.abs(trend) < 0.05;
  const trendColor = trendIsZero
    ? 'bg-slate-50 text-slate-500'
    : isPositive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600';
  const TrendIcon = trendIsZero ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between group">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xs md:text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">{title}</h3>
          {Icon && <Icon size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />}
        </div>
        <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight break-words">
          {typeof value === 'number' ? (isCurrency ? formatPrice(value) : formatCount(value)) : value}
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 mt-3 md:mt-4 pt-2 md:pt-3 border-t border-slate-50">
          {trend !== null && (
             <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${trendColor}`}>
               <TrendIcon size={12} />
               {Math.abs(trend).toFixed(1)}%
             </span>
          )}
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
    </div>
  );
};

export const DashboardModule: React.FC = () => {
  const navigate = useNavigate();
  const { transactions } = useTransactions();
  const { allAppointments: appointments } = useAppointments();
  const { allClients: clients } = useClients();
  const { services, serviceCategories } = useServices();
  const { allStaff } = useTeam();

  // State for Date Range (Default: This Month)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
        label: 'Ce mois-ci'
    };
  });

  // --- 1. Filter Data based on Selection (Current & Previous) ---
  const data = useMemo(() => {
    // Current Period
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;

    // Previous Period (Same duration right before)
    const prevTo = from - 1; 
    const prevFrom = prevTo - duration;

    // Helper to filter
    const filterByRange = <T extends object>(dataArr: T[], dateField: keyof T, start: number, end: number): T[] => {
      return dataArr.filter(item => {
        const d = new Date(item[dateField] as string).getTime();
        return d >= start && d <= end;
      });
    };

    const currentTrx = filterByRange(transactions, 'date', from, to);
    const prevTrx = filterByRange(transactions, 'date', prevFrom, prevTo);

    const currentAppts = filterByRange(appointments, 'date', from, to);
    const prevAppts = filterByRange(appointments, 'date', prevFrom, prevTo);

    const currentClients = filterByRange(clients, 'createdAt', from, to);
    const prevClients = filterByRange(clients, 'createdAt', prevFrom, prevTo);

    return {
      current: { transactions: currentTrx, appointments: currentAppts, newClients: currentClients },
      previous: { transactions: prevTrx, appointments: prevAppts, newClients: prevClients }
    };
  }, [transactions, appointments, clients, dateRange]);

  // --- 2. Compute KPIs & Trends ---
  const stats = useMemo(() => {
    // Current Metrics
    const revenue = data.current.transactions.reduce((sum, t) => sum + t.total, 0);
    const totalAppts = data.current.appointments.length;
    const newClientsCount = data.current.newClients.length;
    const avgBasket = data.current.transactions.length > 0 ? revenue / data.current.transactions.length : 0;

    // Cancellation rate (cancelled + no-show vs total booked)
    const cancelledAppts = data.current.appointments.filter(
      a => a.status === AppointmentStatus.CANCELLED || a.status === AppointmentStatus.NO_SHOW
    ).length;
    const cancellationRate = totalAppts > 0 ? (cancelledAppts / totalAppts) * 100 : 0;

    // Previous Metrics
    const prevRevenue = data.previous.transactions.reduce((sum, t) => sum + t.total, 0);
    const prevAppts = data.previous.appointments.length;
    const prevClientsCount = data.previous.newClients.length;
    const prevAvgBasket = data.previous.transactions.length > 0 ? prevRevenue / data.previous.transactions.length : 0;

    const prevCancelledAppts = data.previous.appointments.filter(
      a => a.status === AppointmentStatus.CANCELLED || a.status === AppointmentStatus.NO_SHOW
    ).length;
    const prevCancellationRate = prevAppts > 0 ? (prevCancelledAppts / prevAppts) * 100 : 0;

    // Calculate Trends
    const calcTrend = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

    return {
      revenue,
      revenueTrend: calcTrend(revenue, prevRevenue),

      totalAppts,
      apptsTrend: calcTrend(totalAppts, prevAppts),

      newClients: newClientsCount,
      clientsTrend: calcTrend(newClientsCount, prevClientsCount),

      avgBasket,
      basketTrend: calcTrend(avgBasket, prevAvgBasket),

      cancellationRate,
      cancellationTrend: calcTrend(cancellationRate, prevCancellationRate),
    };
  }, [data]);

  // --- 3. Generate Dynamic Chart Data (Smart Granularity) ---
  const chartData = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    
    const isMonthly = daysDiff > 60; // Switch to monthly view if range > 60 days
    const map = new Map<string, { name: string, sortKey: number, ventes: number, rdv: number }>();

    // Initialize Map keys to ensure continuity
    const current = new Date(from);
    while (current <= to) {
        let key, sortKey;
        if (isMonthly) {
            key = current.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); // e.g. "janv. 23"
            sortKey = current.getFullYear() * 100 + current.getMonth(); // 202300
            current.setMonth(current.getMonth() + 1);
            current.setDate(1); // Reset to 1st to avoid skipping months
        } else {
            key = current.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); // e.g. "1 janv."
            sortKey = current.getTime();
            current.setDate(current.getDate() + 1);
        }
        
        if (!map.has(key)) {
            map.set(key, { name: key, sortKey, ventes: 0, rdv: 0 });
        }
    }

    // Aggregate Data
    data.current.transactions.forEach(t => {
      const d = new Date(t.date);
      const key = isMonthly 
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      
      if(map.has(key)) map.get(key)!.ventes += t.total;
    });

    data.current.appointments.forEach(a => {
      const d = new Date(a.date);
      const key = isMonthly 
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        
      if(map.has(key)) map.get(key)!.rdv += 1;
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [data.current, dateRange]);

  // --- 4. Operational Data ---
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(a => new Date(a.date) > now && a.status !== AppointmentStatus.CANCELLED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [appointments]);

  // --- 5. Top Services by Revenue ---
  const topServices = useMemo(() => {
    const serviceMap = new Map<string, { name: string; revenue: number; count: number }>();
    data.current.transactions.forEach(t => {
      t.items.filter(i => i.type === 'SERVICE').forEach(item => {
        const key = item.name;
        const existing = serviceMap.get(key) || { name: key, revenue: 0, count: 0 };
        existing.revenue += item.price * item.quantity;
        existing.count += item.quantity;
        serviceMap.set(key, existing);
      });
    });
    return Array.from(serviceMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [data.current.transactions]);

  // --- 6. Revenue by Staff ---
  const staffRevenue = useMemo(() => {
    const staffMap = new Map<string, { name: string; revenue: number; appointments: number }>();
    // From transaction items (revenue)
    data.current.transactions.forEach(t => {
      t.items.forEach(item => {
        if (!item.staffId || !item.staffName) return;
        const existing = staffMap.get(item.staffId) || { name: item.staffName, revenue: 0, appointments: 0 };
        existing.revenue += item.price * item.quantity;
        staffMap.set(item.staffId, existing);
      });
    });
    // From appointments (count completed)
    data.current.appointments
      .filter(a => a.status === AppointmentStatus.COMPLETED)
      .forEach(a => {
        if (!a.staffId) return;
        const existing = staffMap.get(a.staffId) || { name: a.staffName, revenue: 0, appointments: 0 };
        existing.appointments += 1;
        staffMap.set(a.staffId, existing);
      });
    return Array.from(staffMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [data.current.transactions, data.current.appointments]);

  // --- 7. Staff Occupancy Rate ---
  const occupancyRate = useMemo(() => {
    const from = dateRange.from;
    const to = dateRange.to;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

    // Calculate total available hours for active staff in the period
    let totalAvailableMinutes = 0;
    const activeStaff = allStaff.filter(s => s.active && !s.deletedAt);

    const current = new Date(from);
    while (current <= to) {
      const dayName = dayNames[current.getDay()];
      activeStaff.forEach(staff => {
        const day = staff.schedule?.[dayName];
        if (day?.isOpen && day.start && day.end) {
          const [sh, sm] = day.start.split(':').map(Number);
          const [eh, em] = day.end.split(':').map(Number);
          totalAvailableMinutes += (eh * 60 + em) - (sh * 60 + sm);
        }
      });
      current.setDate(current.getDate() + 1);
    }

    // Calculate total booked minutes (non-cancelled appointments)
    const bookedMinutes = data.current.appointments
      .filter(a => a.status !== AppointmentStatus.CANCELLED)
      .reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

    const rate = totalAvailableMinutes > 0 ? (bookedMinutes / totalAvailableMinutes) * 100 : 0;
    return { rate, bookedMinutes, totalAvailableMinutes };
  }, [data.current.appointments, allStaff, dateRange]);


  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord</h1>
        <div className="flex items-center">
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Chiffre d'Affaires"
          value={stats.revenue}
          trend={stats.revenueTrend}
          isPositive={stats.revenueTrend >= 0}
          subtitle="vs période préc."
          icon={DollarSign}
          isCurrency
        />
        <MetricCard
          title="Panier Moyen"
          value={stats.avgBasket}
          trend={stats.basketTrend}
          isPositive={stats.basketTrend >= 0}
          subtitle="vs période préc."
          icon={ShoppingBag}
          isCurrency
        />
        <MetricCard
          title="Rendez-vous"
          value={stats.totalAppts}
          trend={stats.apptsTrend}
          isPositive={stats.apptsTrend >= 0}
          subtitle="vs période préc."
          icon={Calendar}
        />
        <MetricCard
          title="Nouveaux Clients"
          value={stats.newClients}
          trend={stats.clientsTrend}
          isPositive={stats.clientsTrend >= 0}
          subtitle="vs période préc."
          icon={Users}
        />
        <MetricCard
          title="Taux d'Occupation"
          value={`${occupancyRate.rate.toFixed(1)}%`}
          trend={null}
          isPositive={true}
          subtitle={`${Math.round(occupancyRate.bookedMinutes / 60)}h / ${Math.round(occupancyRate.totalAvailableMinutes / 60)}h dispo.`}
          icon={Clock}
        />
        <MetricCard
          title="Annulations"
          value={`${stats.cancellationRate.toFixed(1)}%`}
          trend={stats.cancellationTrend}
          isPositive={stats.cancellationTrend <= 0}
          subtitle="vs période préc."
          icon={XCircle}
        />
      </div>

      {/* Today's Calendar + Side Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TodayCalendarCard
            appointments={appointments}
            services={services}
            serviceCategories={serviceCategories}
            staff={allStaff}
          />
        </div>

        <div className="space-y-6">
           {/* Upcoming Appointments */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Prochains RDV</h3>
                <button onClick={() => navigate('/calendar')} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
                  Voir tout <ChevronRight size={12} />
                </button>
              </div>

              <div className="px-3 pb-2">
                 {upcomingAppointments.length > 0 ? (
                   <>
                     <div className="space-y-0.5">
                       {(upcomingExpanded ? upcomingAppointments : upcomingAppointments.slice(0, 3)).map((apt, i) => {
                         const date = new Date(apt.date);
                         const endDate = new Date(date.getTime() + apt.durationMinutes * 60000);
                         const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                         const endStr = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                         const isToday = date.toDateString() === new Date().toDateString();
                         const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
                         const dayLabel = isToday ? "Aujourd'hui" : isTomorrow ? 'Demain' : date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

                         return (
                           <div
                             key={apt.id}
                             onClick={() => navigate(`/calendar/${apt.id}`)}
                             className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-all duration-150"
                           >
                             {/* Time block */}
                             <div className="w-[52px] shrink-0 text-center">
                               <div className="text-sm font-bold text-slate-900 leading-tight">{timeStr}</div>
                               <div className="text-[10px] text-slate-400 leading-tight">{endStr}</div>
                             </div>

                             {/* Accent line */}
                             <div className={`w-0.5 h-9 rounded-full shrink-0 ${isToday ? 'bg-blue-400' : 'bg-slate-200'}`} />

                             {/* Details */}
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-1.5">
                                 <span className="text-sm font-semibold text-slate-800 truncate">{apt.clientName}</span>
                               </div>
                               <div className="flex items-center gap-2 mt-0.5">
                                 <span className="text-xs text-slate-500 truncate flex items-center gap-1">
                                   <Scissors size={10} className="text-slate-400 shrink-0" />
                                   {apt.serviceName}
                                 </span>
                               </div>
                             </div>

                             {/* Day badge */}
                             <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${isToday ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                               {dayLabel}
                             </span>

                             <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                           </div>
                         );
                       })}
                     </div>

                     {/* Expand / Collapse */}
                     {upcomingAppointments.length > 3 && (
                       <button
                         onClick={() => setUpcomingExpanded(!upcomingExpanded)}
                         className="w-full mt-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors"
                       >
                         {upcomingExpanded ? (
                           <>Voir moins <ChevronUp size={14} /></>
                         ) : (
                           <>+{upcomingAppointments.length - 3} autres <ChevronDown size={14} /></>
                         )}
                       </button>
                     )}
                   </>
                 ) : (
                   <div className="text-center py-8 px-4">
                     <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                       <Calendar size={18} className="text-slate-300" />
                     </div>
                     <p className="text-sm text-slate-400">Aucun rendez-vous à venir</p>
                   </div>
                 )}
              </div>

           </div>

           {/* Volume Chart */}
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-slate-800">Rendez-vous</h3>
               <button onClick={() => navigate('/calendar')} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
                 Détails <ChevronRight size={12} />
               </button>
             </div>
             <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} barCategoryGap="25%">
                   <defs>
                     <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                       <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={5} minTickGap={30}/>
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} width={28} allowDecimals={false} />
                   <Tooltip
                     cursor={{fill: 'rgba(59, 130, 246, 0.04)', radius: 4}}
                     contentStyle={{borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', fontSize: 12}}
                     formatter={(value: number) => [`${value} rdv`, '']}
                     labelStyle={{fontWeight: 600, color: '#1e293b', marginBottom: 2}}
                   />
                   <Bar dataKey="rdv" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={24} animationDuration={800} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      </div>

      {/* Financial Chart + Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-slate-800">Activité Financière</h3>
             <button onClick={() => navigate('/finances')} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
               Détails <ChevronRight size={12} />
             </button>
          </div>
          <div className="h-64 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#64748b', fontSize: 10}}
                  dy={10}
                  minTickGap={40}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#64748b', fontSize: 10}}
                  tickFormatter={(value) => formatPrice(value)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  formatter={(value: number) => [formatPrice(value), 'Ventes']}
                />
                <Area
                  type="monotone"
                  dataKey="ventes"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVentes)"
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Services */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Crown size={16} className="text-blue-500" />
              Top Services
            </h3>
            <button onClick={() => navigate('/services')} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
              Tous <ChevronRight size={12} />
            </button>
          </div>
          {topServices.length > 0 ? (
            <div className="space-y-3">
              {topServices.map((svc, i) => {
                const maxRevenue = topServices[0]?.revenue || 1;
                const barWidth = (svc.revenue / maxRevenue) * 100;
                return (
                  <div key={svc.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-slate-700 truncate">{svc.name}</span>
                        <span className="text-sm font-bold text-slate-900 ml-2 shrink-0">{formatPrice(svc.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{svc.count} prestation{svc.count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-6">Aucune donnée pour cette période.</p>
          )}
        </div>

        {/* Staff Revenue */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Performance Équipe
            </h3>
            <button onClick={() => navigate('/team')} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
              Voir <ChevronRight size={12} />
            </button>
          </div>
          {staffRevenue.length > 0 ? (
            <div className="space-y-3">
              {staffRevenue.map((staff, i) => {
                const maxRevenue = staffRevenue[0]?.revenue || 1;
                const barWidth = (staff.revenue / maxRevenue) * 100;
                return (
                  <div key={staff.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-slate-700 truncate">{staff.name}</span>
                        <span className="text-sm font-bold text-slate-900 ml-2 shrink-0">{formatPrice(staff.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{staff.appointments} rdv complété{staff.appointments > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-6">Aucune donnée pour cette période.</p>
          )}
        </div>
      </div>
    </div>
  );
};
