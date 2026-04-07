import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Award, Wallet, BarChart2, ChevronRight } from 'lucide-react';
import { StaffAvatar } from '../../../components/StaffAvatar';
import { DateRangePicker } from '../../../components/DateRangePicker';
import { formatPrice } from '../../../lib/format';
import type { StaffMember } from '../../../types';
import { useTeamPerformance, StaffPerformance } from '../hooks/useTeamPerformance';

interface TeamPerformanceProps {
  staff: StaffMember[];
}

function RatioBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-slate-400 text-xs italic">—</span>;
  const pct = Math.min(ratio * 33, 100);
  const color =
    ratio >= 2.5 ? 'bg-emerald-500' :
    ratio >= 1.5 ? 'bg-blue-500' :
    ratio >= 1   ? 'bg-amber-500' :
                   'bg-rose-500';
  const textColor =
    ratio >= 2.5 ? 'text-emerald-700' :
    ratio >= 1.5 ? 'text-blue-700' :
    ratio >= 1   ? 'text-amber-700' :
                   'text-rose-700';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${textColor}`}>{ratio.toFixed(2)}x</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PerformanceCard({ perf, onClick }: { perf: StaffPerformance; onClick: () => void }) {
  const { staff, revenue, revenuePerDay, workingDays, bonusAttribue, baseSalary } = perf;
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-left w-full hover:border-slate-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <StaffAvatar firstName={staff.firstName} lastName={staff.lastName} photoUrl={staff.photoUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{staff.firstName} {staff.lastName}</p>
          <p className="text-xs text-slate-500">{staff.role}</p>
        </div>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500">CA période</span>
          </div>
          <p className="text-base font-bold text-slate-900">{formatPrice(revenue)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500">CA / jour</span>
          </div>
          <p className="text-base font-bold text-slate-900">{workingDays > 0 ? formatPrice(revenuePerDay) : '—'}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Award size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500">Bonus</span>
          </div>
          <p className={`text-base font-bold ${bonusAttribue > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {bonusAttribue > 0 ? formatPrice(bonusAttribue) : '—'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500">Ratio</span>
          </div>
          <p className="text-sm">
            <RatioBar ratio={perf.ratio} />
          </p>
        </div>
      </div>
      {baseSalary != null && (
        <p className="text-xs text-slate-400">Salaire : {formatPrice(baseSalary)}</p>
      )}
    </button>
  );
}

function PerformanceRow({ perf, totalRevenue, onClick }: { perf: StaffPerformance; totalRevenue: number; onClick: () => void }) {
  const { staff, revenue, revenuePerDay, workingDays, bonusAttribue, baseSalary } = perf;
  const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
  return (
    <tr
      onClick={onClick}
      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <StaffAvatar firstName={staff.firstName} lastName={staff.lastName} photoUrl={staff.photoUrl} size={32} />
          <div>
            <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
              {staff.firstName} {staff.lastName}
            </p>
            <p className="text-xs text-slate-500">{staff.role}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm font-semibold text-slate-900">{formatPrice(revenue)}</p>
        <p className="text-xs text-slate-400">{share.toFixed(1)}%</p>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-slate-700">{workingDays > 0 ? formatPrice(revenuePerDay) : '—'}</p>
        <p className="text-xs text-slate-400">{workingDays} j.</p>
      </td>
      <td className="py-3 px-4 text-right">
        {bonusAttribue > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Award size={12} />
            {formatPrice(bonusAttribue)}
          </span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-slate-700">{baseSalary != null ? formatPrice(baseSalary) : '—'}</p>
      </td>
      <td className="py-3 px-4 min-w-[140px]">
        <RatioBar ratio={perf.ratio} />
      </td>
      <td className="py-3 px-4">
        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
      </td>
    </tr>
  );
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({ staff }) => {
  const { performances, dateRange, setDateRange, totalRevenue, isLoadingPii } = useTeamPerformance(staff);
  const navigate = useNavigate();

  const activeStaff = performances.filter(p => p.staff.active).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Performance Équipe</h1>
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">CA total équipe</p>
          <p className="text-xl font-bold text-slate-900">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Membres actifs</p>
          <p className="text-xl font-bold text-slate-900">{activeStaff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">CA moyen / membre</p>
          <p className="text-xl font-bold text-slate-900">
            {activeStaff.length > 0 ? formatPrice(totalRevenue / activeStaff.length) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Bonus attribués</p>
          <p className="text-xl font-bold text-amber-600">
            {formatPrice(activeStaff.reduce((s, p) => s + p.bonusAttribue, 0))}
          </p>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoadingPii && (
          <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            Chargement des salaires…
          </div>
        )}
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4">Membre</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4">CA période</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4">CA / jour</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4">Bonus</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4">Salaire base</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4 min-w-[140px]">Ratio</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {activeStaff.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                  Aucun membre actif
                </td>
              </tr>
            ) : (
              activeStaff.map(perf => (
                <PerformanceRow
                  key={perf.staff.id}
                  perf={perf}
                  totalRevenue={totalRevenue}
                  onClick={() => navigate(`/team/${perf.staff.slug}?tab=performance`)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="grid md:hidden grid-cols-1 sm:grid-cols-2 gap-4">
        {activeStaff.length === 0 ? (
          <p className="text-slate-400 text-sm text-center col-span-2 py-8">Aucun membre actif</p>
        ) : (
          activeStaff.map(perf => (
            <PerformanceCard
              key={perf.staff.id}
              perf={perf}
              onClick={() => navigate(`/team/${perf.staff.slug}?tab=performance`)}
            />
          ))
        )}
      </div>

    </div>
  );
};
