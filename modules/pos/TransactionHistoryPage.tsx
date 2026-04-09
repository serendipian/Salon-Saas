
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ChevronLeft, ChevronRight, ArrowLeft, Eye, Receipt, Ban, RotateCcw, Search } from 'lucide-react';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useMediaQuery } from '../../context/MediaQueryContext';
import { formatPrice } from '../../lib/format';
import { getTransactionStatus, TransactionStatus } from './mappers';
import { Transaction } from '../../types';
import { ReceiptModal, TransactionDetailModal } from './components/POSModals';
import { VoidModal } from './components/VoidModal';
import { RefundModal } from './components/RefundModal';

const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const TransactionHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useMediaQuery();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canVoid = can('void', 'pos');
  const canRefund = can('refund', 'pos');

  // Date navigation
  const [historyDate, setHistoryDate] = useState(() => new Date());
  const todayStr = toLocalDate(new Date());
  const historyDateStr = toLocalDate(historyDate);
  const isHistoryToday = historyDateStr === todayStr;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const isHistoryYesterday = historyDateStr === toLocalDate(yesterdayDate);

  const historyDateLabel = isHistoryToday
    ? "Aujourd'hui"
    : isHistoryYesterday
      ? 'Hier'
      : historyDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  const goToPrevDay = () => {
    setHistoryDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentFilter(null);
  };

  const goToNextDay = () => {
    if (isHistoryToday) return;
    setHistoryDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentFilter(null);
  };

  // Data
  const posRange = React.useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { transactions, voidTransaction, refundTransaction, isVoiding, isRefunding } = useTransactions(posRange);

  // Modals
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'voided' | 'refunded'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);

  // Filter by selected date
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(trx => toLocalDate(new Date(trx.date)) === historyDateStr);
  }, [transactions, historyDateStr]);

  // Group: SALE as parents, VOID/REFUND as children
  const groupedTransactions = React.useMemo(() => {
    const childMap = new Map<string, Transaction[]>();
    const parentIds = new Set<string>();
    const parents: Transaction[] = [];

    for (const trx of filteredTransactions) {
      if (trx.originalTransactionId) {
        const children = childMap.get(trx.originalTransactionId) || [];
        children.push(trx);
        childMap.set(trx.originalTransactionId, children);
      } else {
        parents.push(trx);
        parentIds.add(trx.id);
      }
    }

    const orphans: Transaction[] = [];
    childMap.forEach((children, parentId) => {
      if (!parentIds.has(parentId)) orphans.push(...children);
    });

    const grouped = parents.map(parent => ({
      parent,
      children: childMap.get(parent.id) || [],
    }));
    orphans.forEach(orphan => grouped.push({ parent: orphan, children: [] }));

    return grouped;
  }, [filteredTransactions]);

  // Derive available payment methods from this day's transactions
  const availablePaymentMethods = React.useMemo(() => {
    const methods = new Set<string>();
    for (const { parent } of groupedTransactions) {
      for (const p of parent.payments) {
        methods.add(p.method);
      }
    }
    return [...methods].sort();
  }, [groupedTransactions]);

  // Apply search + status + payment filters
  const displayedTransactions = React.useMemo(() => {
    return groupedTransactions.filter(({ parent: trx }) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchClient = trx.clientName?.toLowerCase().includes(term);
        const matchItem = trx.items.some(i => i.name.toLowerCase().includes(term));
        if (!matchClient && !matchItem) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const status = getTransactionStatus(trx, transactions);
        if (statusFilter === 'voided' && status !== 'voided') return false;
        if (statusFilter === 'refunded' && status !== 'fully_refunded' && status !== 'partially_refunded') return false;
      }

      // Payment method filter
      if (paymentFilter) {
        const hasMethod = trx.payments.some(p => p.method === paymentFilter);
        if (!hasMethod) return false;
      }

      return true;
    });
  }, [groupedTransactions, searchTerm, statusFilter, paymentFilter, transactions]);

  const PAYMENT_METHOD_SHORT: Record<string, string> = {
    'Carte Bancaire': 'Carte',
    'Carte Cadeau': 'Cadeau',
  };

  const dailySummary = React.useMemo(() => {
    const activeSales = groupedTransactions.filter(({ parent: trx }) => {
      const status = getTransactionStatus(trx, transactions);
      return trx.type === 'SALE' && (status === 'active' || status === 'partially_refunded');
    });
    if (activeSales.length === 0) return null;

    const total = activeSales.reduce((sum, { parent }) => sum + parent.total, 0);
    const byMethod: Record<string, number> = {};
    for (const { parent } of activeSales) {
      for (const p of parent.payments) {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      }
    }

    return { total, count: activeSales.length, byMethod };
  }, [groupedTransactions, transactions]);

  const isToday = (date: string) => new Date(date).toDateString() === new Date().toDateString();

  const statusBadge = (status: TransactionStatus, trx: Transaction) => {
    if (trx.type === 'VOID') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-red-200 text-red-600">Annulation</span>;
    if (trx.type === 'REFUND') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">Remboursement</span>;
    if (status === 'voided') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-red-200 text-red-600">Annulé</span>;
    if (status === 'fully_refunded') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">Remboursé</span>;
    if (status === 'partially_refunded') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">Remb. partiel</span>;
    return null;
  };

  const getStaffDisplay = (trx: Transaction): { label: string; title?: string } | null => {
    const names = [...new Set(trx.items.filter(i => i.staffName).map(i => i.staffName!))];
    if (names.length === 0) return null;
    if (names.length === 1) return { label: names[0] };
    return { label: `${names[0]} +${names.length - 1}`, title: names.join(', ') };
  };

  const handleVoidConfirm = async (reasonCategory: string, reasonNote: string) => {
    if (!voidTarget) return;
    try {
      await voidTransaction(voidTarget.id, reasonCategory, reasonNote);
      setVoidTarget(null);
      setDetailTransaction(null);
    } catch {
      // Error toast handled by mutation onError
    }
  };

  const handleRefundConfirm = async (
    items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[],
    payments: { method: string; amount: number }[],
    reasonCategory: string,
    reasonNote: string,
    restock: boolean
  ) => {
    if (!refundTarget) return;
    try {
      await refundTransaction(refundTarget.id, items, payments, reasonCategory, reasonNote, restock);
      setRefundTarget(null);
      setDetailTransaction(null);
    } catch {
      // Error toast handled by mutation onError
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Merged Header: back + title on left, date nav on right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
            aria-label="Retour à la caisse"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Historique</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevDay}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
            aria-label="Jour précédent"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 min-w-[120px] text-center">
            {historyDateLabel}
            <span className="ml-1.5 text-xs text-slate-400 font-normal">{filteredTransactions.length}</span>
          </span>
          <button
            onClick={goToNextDay}
            disabled={isHistoryToday}
            className={`p-1.5 rounded-lg transition-colors ${isHistoryToday ? 'text-slate-200 cursor-not-allowed' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            aria-label="Jour suivant"
          >
            <ChevronRight size={18} />
          </button>
          {!isHistoryToday && (
            <button
              onClick={() => { setHistoryDate(new Date()); setSearchTerm(''); setStatusFilter('all'); setPaymentFilter(null); }}
              className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors ml-1"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* Transaction List Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {filteredTransactions.length > 0 && (
          <div className="px-4 pt-4 pb-2 space-y-3 border-b border-slate-100">
            {/* Search input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher un client ou service..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {/* Filter pills */}
            <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto flex-nowrap pb-1' : 'flex-wrap'}`}>
              {/* Status pills */}
              {(['all', 'voided', 'refunded'] as const).map(f => {
                const labels = { all: 'Tous', voided: 'Annulés', refunded: 'Remboursés' };
                const isActive = statusFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {labels[f]}
                  </button>
                );
              })}
              {/* Payment method pills */}
              {availablePaymentMethods.map(method => {
                const isActive = paymentFilter === method;
                return (
                  <button
                    key={method}
                    onClick={() => setPaymentFilter(isActive ? null : method)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {dailySummary && (
          isMobile ? (
            <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
              <div>{formatPrice(dailySummary.total)} · {dailySummary.count} vente{dailySummary.count > 1 ? 's' : ''}</div>
              <div className="mt-0.5">
                {Object.entries(dailySummary.byMethod).map(([method, amount], i) => (
                  <span key={method}>{i > 0 ? ' · ' : ''}{PAYMENT_METHOD_SHORT[method] || method}: {formatPrice(amount)}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 py-3 border-b border-slate-100 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{formatPrice(dailySummary.total)}</span>
              {' · '}{dailySummary.count} vente{dailySummary.count > 1 ? 's' : ''}
              {Object.entries(dailySummary.byMethod).map(([method, amount]) => (
                <span key={method}> · {method}: {formatPrice(amount)}</span>
              ))}
            </div>
          )
        )}

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <History size={36} className="mx-auto mb-4 text-slate-300" />
            <p className="text-slate-400">Aucune transaction enregistrée.</p>
          </div>
        ) : isMobile ? (
          /* Mobile: card layout */
          <div className="divide-y divide-slate-100">
            {displayedTransactions.map(({ parent: trx, children }) => {
              const status = getTransactionStatus(trx, transactions);
              const isVoided = status === 'voided';
              const showVoid = canVoid && trx.type === 'SALE' && status === 'active' && isToday(trx.date);
              const showRefund = canRefund && trx.type === 'SALE' && status !== 'voided' && status !== 'fully_refunded';
              return (
              <div key={trx.id}>
              <div className={`w-full text-left px-4 py-4 ${isVoided ? 'opacity-60' : ''}`}>
                <button
                  type="button"
                  onClick={() => setDetailTransaction(trx)}
                  className="w-full text-left focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
                  aria-label={`Détails transaction ${trx.clientName || 'Client de passage'}, ${formatPrice(trx.total)}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className={`font-semibold text-slate-900 text-sm ${isVoided ? 'line-through' : ''}`}>
                        {trx.clientName || <span className="text-slate-400 italic">Client de passage</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {(() => {
                            const staff = getStaffDisplay(trx);
                            if (!staff) return null;
                            return <span title={staff.title}> · {staff.label}</span>;
                          })()}
                        </span>
                        {statusBadge(status, trx)}
                      </div>
                    </div>
                    <span className={`font-bold ${trx.total < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatPrice(trx.total)}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {trx.items.length} article{trx.items.length > 1 ? 's' : ''} · {trx.items.map(i => i.name).join(', ')}
                  </div>
                </button>
                <div className="flex justify-end mt-2 pt-2 border-t border-slate-100 gap-2">
                  {showVoid && (
                    <button type="button" onClick={() => setVoidTarget(trx)} className="p-2 text-red-400 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Annuler">
                      <Ban size={16} />
                    </button>
                  )}
                  {showRefund && (
                    <button type="button" onClick={() => setRefundTarget(trx)} className="p-2 text-orange-400 hover:text-orange-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Rembourser">
                      <RotateCcw size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReceiptTransaction(trx)}
                    className="p-2 text-slate-400 hover:text-slate-900 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Ticket de caisse"
                  >
                    <Receipt size={16} />
                  </button>
                </div>
              </div>
              {children.map(child => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setDetailTransaction(child)}
                  className="w-full text-left ml-4 mt-1 bg-slate-50 rounded-lg border border-slate-100 px-3 py-2 flex justify-between items-center"
                >
                  <div className="flex items-center gap-2">
                    {child.type === 'VOID' ? <Ban size={12} className="text-red-500" /> : <RotateCcw size={12} className="text-orange-500" />}
                    {statusBadge('active', child)}
                    <span className="text-xs text-slate-500">{new Date(child.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className="font-semibold text-sm text-red-600">{formatPrice(child.total)}</span>
                </button>
              ))}
              </div>
              );
            })}
          </div>
        ) : (
          /* Desktop: table layout */
          <table className="w-full text-left">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-xs text-slate-400 font-normal">Heure</th>
                <th className="px-6 py-3 text-xs text-slate-400 font-normal">Client</th>
                <th className="px-6 py-3 text-xs text-slate-400 font-normal">Styliste</th>
                <th className="px-6 py-3 text-xs text-slate-400 font-normal">Détails</th>
                <th className="px-6 py-3 text-xs text-slate-400 font-normal text-right">Total</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransactions.map(({ parent: trx, children }) => {
                const status = getTransactionStatus(trx, transactions);
                const isVoided = status === 'voided';
                const showVoid = canVoid && status === 'active' && isToday(trx.date);
                const showRefund = canRefund && status !== 'voided' && status !== 'fully_refunded';
                return (
                <React.Fragment key={trx.id}>
                <tr className={`group hover:bg-slate-50/80 transition-colors ${isVoided ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-5 font-medium text-slate-700">
                    {new Date(trx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      {trx.clientName ? (
                        <span className={`text-slate-900 font-medium text-sm ${isVoided ? 'line-through' : ''}`}>{trx.clientName}</span>
                      ) : (
                        <span className="text-slate-400 italic text-sm">Client de passage</span>
                      )}
                      {statusBadge(status, trx)}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {(() => {
                      const staff = getStaffDisplay(trx);
                      if (!staff) return null;
                      return <span className="text-sm text-slate-600" title={staff.title}>{staff.label}</span>;
                    })()}
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-600 max-w-xs truncate">
                      {trx.items.map(i => i.name).join(', ')}
                    </div>
                  </td>
                  <td className={`px-6 py-5 text-right font-bold ${trx.total < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatPrice(trx.total)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      {showVoid && (
                        <button onClick={() => setVoidTarget(trx)} className="p-2 text-red-300 hover:text-red-600 transition-colors" title="Annuler">
                          <Ban size={16} />
                        </button>
                      )}
                      {showRefund && (
                        <button onClick={() => setRefundTarget(trx)} className="p-2 text-orange-300 hover:text-orange-600 transition-colors" title="Rembourser">
                          <RotateCcw size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setDetailTransaction(trx)}
                        className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                        title="Voir les détails"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => setReceiptTransaction(trx)}
                        className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                        title="Imprimer ticket"
                      >
                        <Receipt size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                {children.map(child => (
                  <tr key={child.id} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <td className="px-6 py-2 pl-10 text-xs text-slate-500">
                      {new Date(child.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-6 py-2">
                      <div className="flex items-center gap-2">
                        {child.type === 'VOID' ? <Ban size={12} className="text-red-500" /> : <RotateCcw size={12} className="text-orange-500" />}
                        {statusBadge('active', child)}
                      </div>
                    </td>
                    <td className="px-6 py-2"></td>
                    <td className="px-6 py-2">
                      <div className="text-xs text-slate-500 max-w-xs truncate">
                        {child.items.map(i => i.name).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-2 text-right font-semibold text-sm text-red-600">
                      {formatPrice(child.total)}
                    </td>
                    <td className="px-6 py-2 text-right">
                      <button onClick={() => setDetailTransaction(child)} className="p-1.5 text-slate-300 hover:text-slate-900 transition-colors" title="Voir les détails">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {receiptTransaction && (
        <ReceiptModal
          transaction={receiptTransaction}
          allTransactions={transactions}
          onClose={() => setReceiptTransaction(null)}
        />
      )}

      {detailTransaction && (
        <TransactionDetailModal
          transaction={detailTransaction}
          allTransactions={transactions}
          onClose={() => setDetailTransaction(null)}
          onVoidClick={canVoid ? (t: Transaction) => { setDetailTransaction(null); setVoidTarget(t); } : undefined}
          onRefundClick={canRefund ? (t: Transaction) => { setDetailTransaction(null); setRefundTarget(t); } : undefined}
          onViewTransaction={setDetailTransaction}
        />
      )}

      {voidTarget && (
        <VoidModal
          transaction={voidTarget}
          onConfirm={handleVoidConfirm}
          onClose={() => setVoidTarget(null)}
          isPending={isVoiding}
        />
      )}

      {refundTarget && (
        <RefundModal
          transaction={refundTarget}
          allTransactions={transactions}
          onConfirm={handleRefundConfirm}
          onClose={() => setRefundTarget(null)}
          isPending={isRefunding}
        />
      )}
    </div>
  );
};
