import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, DollarSign, TrendingUp, Award, Wallet } from 'lucide-react';
import type { StaffMember, BonusTier } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { formatPrice } from '../../../lib/format';
import { BonusSystemEditor } from '../../../components/BonusSystemEditor';
import { useStaffCompensation } from '../hooks/useStaffCompensation';
import { useStaffPayouts } from '../hooks/useStaffPayouts';
import { PayoutForm } from './PayoutForm';
import { PayoutHistory } from './PayoutHistory';

interface StaffRemunerationTabProps {
  staff: StaffMember;
  currencySymbol: string;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
}

function getMonthBounds(): { start: Date; end: Date; startStr: string; endStr: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { start, end, startStr, endStr };
}

export const StaffRemunerationTab: React.FC<StaffRemunerationTabProps> = ({ staff, currencySymbol, onSave }) => {
  const { start, end, startStr, endStr } = useMemo(getMonthBounds, []);

  // Load PII (baseSalary) via RPC
  const { data: piiData } = useQuery({
    queryKey: ['staff_pii', staff.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_staff_pii', { p_staff_id: staff.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { baseSalary: null };
      return {
        baseSalary: row.base_salary != null ? parseFloat(row.base_salary) : null,
      };
    },
  });

  const baseSalary = piiData?.baseSalary ?? null;
  const compensation = useStaffCompensation(staff, start, end, baseSalary);
  const { payouts, addPayout, markAsPaid, cancelPayout } = useStaffPayouts(staff.id);

  // Commission rate inline edit
  const [editingCommission, setEditingCommission] = useState(false);
  const [commissionDraft, setCommissionDraft] = useState(staff.commissionRate);
  useEffect(() => setCommissionDraft(staff.commissionRate), [staff.commissionRate]);

  const saveCommission = async () => {
    await onSave({ commissionRate: commissionDraft });
    setEditingCommission(false);
  };

  // Bonus tiers edit
  const [editingBonus, setEditingBonus] = useState(false);
  const [bonusDraft, setBonusDraft] = useState<BonusTier[]>(staff.bonusTiers || []);
  useEffect(() => setBonusDraft(staff.bonusTiers || []), [staff.bonusTiers]);

  const saveBonus = async () => {
    await onSave({ bonusTiers: bonusDraft });
    setEditingBonus(false);
  };

  // Payout form modal
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Monthly Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
          Résumé — {monthLabel}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryItem
            icon={<DollarSign size={16} />}
            label="Salaire de base"
            value={formatPrice(compensation.baseSalary)}
            color="slate"
          />
          <SummaryItem
            icon={<TrendingUp size={16} />}
            label="Commission"
            value={formatPrice(compensation.commissionEarned)}
            color="blue"
          />
          <SummaryItem
            icon={<Award size={16} />}
            label="Prime"
            value={formatPrice(compensation.bonusEarned)}
            color="amber"
          />
          <SummaryItem
            icon={<Wallet size={16} />}
            label="Total attendu"
            value={formatPrice(compensation.totalExpected)}
            color="emerald"
            bold
          />
        </div>
        <div className="mt-3 text-xs text-slate-400">
          C.A. du mois : {formatPrice(compensation.periodRevenue)}
        </div>
      </div>

      {/* Commission Rate */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
            Taux de commission
          </h3>
          {!editingCommission && (
            <button
              onClick={() => setEditingCommission(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
        {editingCommission ? (
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={commissionDraft}
              onChange={(e) => setCommissionDraft(parseFloat(e.target.value) || 0)}
              className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm"
            />
            <span className="text-sm text-slate-500">%</span>
            <button
              onClick={saveCommission}
              className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Enregistrer
            </button>
            <button
              onClick={() => { setEditingCommission(false); setCommissionDraft(staff.commissionRate); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        ) : (
          <p className="text-2xl font-bold text-slate-900">{staff.commissionRate}%</p>
        )}
      </div>

      {/* Bonus Tiers */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
            Paliers de prime
          </h3>
          {!editingBonus ? (
            <button
              onClick={() => setEditingBonus(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Pencil size={14} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={saveBonus}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Enregistrer
              </button>
              <button
                onClick={() => { setEditingBonus(false); setBonusDraft(staff.bonusTiers || []); }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
        {editingBonus ? (
          <BonusSystemEditor tiers={bonusDraft} onChange={setBonusDraft} currencySymbol={currencySymbol} />
        ) : (
          (staff.bonusTiers && staff.bonusTiers.length > 0) ? (
            <div className="space-y-2">
              {staff.bonusTiers.map((tier, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-600">
                    Objectif : <span className="font-medium text-slate-900">{formatPrice(tier.target)}</span>
                  </span>
                  <span className="text-slate-600">
                    Prime : <span className="font-semibold text-emerald-700">{formatPrice(tier.bonus)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucun palier de prime configuré</p>
          )
        )}
      </div>

      {/* Payout History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
            Historique des paiements
          </h3>
          <button
            onClick={() => setShowPayoutForm(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Marquer comme payé
          </button>
        </div>
        <PayoutHistory
          payouts={payouts}
          onMarkAsPaid={markAsPaid}
          onCancel={cancelPayout}
        />
      </div>

      {/* Payout Form Modal */}
      {showPayoutForm && (
        <PayoutForm
          defaultAmount={compensation.totalExpected}
          defaultType="SALARY"
          periodStart={startStr}
          periodEnd={endStr}
          referenceAmount={compensation.periodRevenue}
          rateSnapshot={staff.commissionRate}
          onSubmit={addPayout}
          onClose={() => setShowPayoutForm(false)}
        />
      )}
    </div>
  );
};

// Small summary item sub-component
function SummaryItem({
  icon,
  label,
  value,
  color,
  bold,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={`p-1 rounded ${colorMap[color] || colorMap.slate}`}>{icon}</span>
        {label}
      </div>
      <p className={`text-lg ${bold ? 'font-bold' : 'font-semibold'} text-slate-900`}>{value}</p>
    </div>
  );
}
