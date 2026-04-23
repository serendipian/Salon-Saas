import {
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Gift,
  History,
  Receipt,
  RotateCcw,
  Scissors,
  Search,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../context/MediaQueryContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTransactions } from '../../hooks/useTransactions';
import { formatName, formatPrice, formatTicketNumber } from '../../lib/format';
import type { Transaction } from '../../types';
import { ReceiptModal, TransactionDetailModal } from './components/POSModals';
import { RefundModal } from './components/RefundModal';
import { VoidModal } from './components/VoidModal';
import { PAYMENT_METHOD_SHORT } from './constants';
import { getTransactionStatus, type TransactionStatus } from './mappers';

const ALL_PAYMENT_METHODS = ['Espèces', 'Carte Bancaire', 'Virement', 'Carte Cadeau'] as const;

const PAYMENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Espèces: Banknote,
  'Carte Bancaire': CreditCard,
  Virement: ArrowRightLeft,
  'Carte Cadeau': Gift,
};

const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const TransactionHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canVoid = can('void', 'pos');
  const canRefund = can('refund', 'pos');
  const { isMobile } = useMediaQuery();

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
      : historyDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

  const goToPrevDay = () => {
    setHistoryDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentFilter(null);
    setSortBy('time');
    setSortDesc(true);
  };

  const goToNextDay = () => {
    if (isHistoryToday) return;
    setHistoryDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentFilter(null);
    setSortBy('time');
    setSortDesc(true);
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

  const { transactions, voidTransaction, refundTransaction, isVoiding, isRefunding } =
    useTransactions(posRange);

  // Modals
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);

  // Search, filter & sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'voided' | 'refunded'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'amount'>('time');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const sortRefMobile = useRef<HTMLDivElement>(null);
  const sortRefDesktop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMobile = sortRefMobile.current?.contains(target);
      const insideDesktop = sortRefDesktop.current?.contains(target);
      if (!insideMobile && !insideDesktop) setSortOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  // Filter by selected date
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((trx) => toLocalDate(new Date(trx.date)) === historyDateStr);
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

    const grouped = parents.map((parent) => ({
      parent,
      children: childMap.get(parent.id) || [],
    }));
    orphans.forEach((orphan) => grouped.push({ parent: orphan, children: [] }));

    return grouped;
  }, [filteredTransactions]);

  // Derive filter counts from this day's transactions
  const { statusCounts, paymentCounts } = React.useMemo(() => {
    const methodSet = new Map<string, number>();
    const counts = { all: 0, voided: 0, refunded: 0 };
    for (const { parent: trx } of groupedTransactions) {
      const status = getTransactionStatus(trx, transactions);
      counts.all++;
      if (status === 'voided') counts.voided++;
      if (status === 'fully_refunded' || status === 'partially_refunded') counts.refunded++;
      for (const p of trx.payments) {
        methodSet.set(p.method, (methodSet.get(p.method) || 0) + 1);
      }
    }
    return { statusCounts: counts, paymentCounts: methodSet };
  }, [groupedTransactions, transactions]);

  // Apply search + status + payment filters, then sort
  const displayedTransactions = React.useMemo(() => {
    const filtered = groupedTransactions.filter(({ parent: trx }) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchClient = trx.clientName?.toLowerCase().includes(term);
        const matchItem = trx.items.some((i) => i.name.toLowerCase().includes(term));
        if (!matchClient && !matchItem) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const status = getTransactionStatus(trx, transactions);
        if (statusFilter === 'voided' && status !== 'voided') return false;
        if (
          statusFilter === 'refunded' &&
          status !== 'fully_refunded' &&
          status !== 'partially_refunded'
        )
          return false;
      }

      // Payment method filter
      if (paymentFilter) {
        const hasMethod = trx.payments.some((p) => p.method === paymentFilter);
        if (!hasMethod) return false;
      }

      return true;
    });

    // Sort
    const dir = sortDesc ? -1 : 1;
    filtered.sort((a, b) => {
      const ta = a.parent,
        tb = b.parent;
      switch (sortBy) {
        case 'time':
          return dir * (new Date(ta.date).getTime() - new Date(tb.date).getTime());
        case 'amount':
          return dir * (ta.total - tb.total);
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    groupedTransactions,
    searchTerm,
    statusFilter,
    paymentFilter,
    transactions,
    sortBy,
    sortDesc,
  ]);

  const dailySummary = React.useMemo(() => {
    const activeSales = groupedTransactions.filter(({ parent: trx }) => {
      const status = getTransactionStatus(trx, transactions);
      return trx.type === 'SALE' && (status === 'active' || status === 'partially_refunded');
    });
    if (activeSales.length === 0) return null;

    const total = activeSales.reduce((sum, { parent }) => sum + parent.total, 0);
    let serviceCount = 0;
    let productCount = 0;
    const byMethod: Record<string, number> = {};
    for (const { parent } of activeSales) {
      for (const item of parent.items) {
        if (item.type === 'SERVICE') serviceCount += item.quantity;
        else if (item.type === 'PRODUCT') productCount += item.quantity;
      }
      for (const p of parent.payments) {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      }
    }

    return { total, count: activeSales.length, serviceCount, productCount, byMethod };
  }, [groupedTransactions, transactions]);

  const isToday = (date: string) => new Date(date).toDateString() === new Date().toDateString();

  const statusBadge = (status: TransactionStatus, trx: Transaction) => {
    if (trx.type === 'VOID')
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-red-200 text-red-600">
          Annulation
        </span>
      );
    if (trx.type === 'REFUND')
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">
          Remboursement
        </span>
      );
    if (status === 'voided')
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-red-200 text-red-600">
          Annulé
        </span>
      );
    if (status === 'fully_refunded')
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">
          Remboursé
        </span>
      );
    if (status === 'partially_refunded')
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">
          Remb. partiel
        </span>
      );
    return null;
  };

  const getStaffNames = (trx: Transaction): string[] => {
    return [...new Set(trx.items.filter((i) => i.staffName).map((i) => i.staffName!))];
  };

  const TAG =
    'text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200';
  const SERVICE_TAG =
    'text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100';

  const itemLabel = (item: { name: string; variantName?: string }) =>
    item.variantName ? `${item.name} - ${item.variantName}` : item.name;

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
    items: {
      original_item_id: string | null;
      quantity: number;
      price_override?: number;
      price?: number;
      name?: string;
    }[],
    payments: { method: string; amount: number }[],
    reasonCategory: string,
    reasonNote: string,
    restock: boolean,
  ) => {
    if (!refundTarget) return;
    try {
      await refundTransaction(
        refundTarget.id,
        items,
        payments,
        reasonCategory,
        reasonNote,
        restock,
      );
      setRefundTarget(null);
      setDetailTransaction(null);
    } catch {
      // Error toast handled by mutation onError
    }
  };

  return (
    <div className="w-full space-y-4 md:space-y-6">
      {/* Header: stacks on mobile (title row + date nav row) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 -ml-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
            aria-label="Retour à la caisse"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Historique
          </h1>
          {!isHistoryToday && (
            <button
              onClick={() => {
                setHistoryDate(new Date());
                setSearchTerm('');
                setStatusFilter('all');
                setPaymentFilter(null);
                setSortBy('time');
                setSortDesc(true);
              }}
              className="md:hidden ml-auto text-xs font-medium text-blue-500 hover:text-blue-700 active:text-blue-800 transition-colors"
            >
              Aujourd'hui
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={goToPrevDay}
            className="p-2 md:p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors text-slate-500 hover:text-slate-900"
            aria-label="Jour précédent"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="flex-1 md:flex-none rounded-full bg-slate-100 px-3 py-1.5 md:py-1 text-sm font-medium text-slate-700 md:min-w-[120px] text-center tabular-nums">
            {historyDateLabel}
            <span className="ml-1.5 text-xs text-slate-400 font-normal">
              {filteredTransactions.length}
            </span>
          </span>
          <button
            onClick={goToNextDay}
            disabled={isHistoryToday}
            className={`p-2 md:p-1.5 rounded-lg transition-colors ${isHistoryToday ? 'text-slate-200 cursor-not-allowed' : 'hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
            aria-label="Jour suivant"
          >
            <ChevronRight size={18} />
          </button>
          {!isHistoryToday && (
            <button
              onClick={() => {
                setHistoryDate(new Date());
                setSearchTerm('');
                setStatusFilter('all');
                setPaymentFilter(null);
                setSortBy('time');
                setSortDesc(true);
              }}
              className="hidden md:inline text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors ml-1"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      {dailySummary && (
        <div className="grid gap-2 md:gap-3 grid-cols-2 md:grid-cols-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 mb-1">
              <TrendingUp size={14} className="shrink-0" />
              <span className="text-[11px] md:text-xs font-medium truncate">
                Chiffre d'affaires
              </span>
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
              {formatPrice(dailySummary.total)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 mb-1">
              <Receipt size={14} className="shrink-0" />
              <span className="text-[11px] md:text-xs font-medium truncate">Transactions</span>
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
              {dailySummary.count}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 mb-1">
              <Scissors size={14} className="shrink-0" />
              <span className="text-[11px] md:text-xs font-medium truncate">Prestations</span>
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
              {dailySummary.serviceCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 mb-1">
              <ShoppingBag size={14} className="shrink-0" />
              <span className="text-[11px] md:text-xs font-medium truncate">Produits</span>
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
              {dailySummary.productCount}
            </div>
          </div>
        </div>
      )}

      {/* Search, Filter & Sort Bar */}
      {filteredTransactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:px-4 md:py-3 flex flex-col md:flex-row gap-2 md:gap-2 md:items-center">
          {/* Row 1 (mobile): search + sort toggle. Desktop: just the search sized at 260. */}
          <div className="flex items-center gap-2 md:contents">
            <div className="relative flex-1 md:flex-shrink-0 md:flex-none md:w-[260px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-8 pr-3 h-10 md:h-8 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {/* Mobile sort inline with search */}
            <div ref={sortRefMobile} className="relative md:hidden">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="h-10 px-3 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors flex items-center gap-1.5"
                  aria-label="Trier"
                >
                  <ArrowUpDown size={14} />
                  <span>{{ time: 'Heure', amount: 'Mt.' }[sortBy]}</span>
                </button>
                <button
                  onClick={() => setSortDesc(!sortDesc)}
                  className="h-10 w-10 rounded-lg bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors flex items-center justify-center"
                  aria-label={sortDesc ? 'Décroissant' : 'Croissant'}
                >
                  {sortDesc ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>
              </div>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-10 min-w-[140px]">
                  {(
                    [
                      ['time', 'Heure'],
                      ['amount', 'Montant'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSortBy(key);
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${sortBy === key ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 active:bg-slate-50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter pills: horizontal scroll on mobile, wrap on desktop */}
          <div className="-mx-3 px-3 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible scrollbar-hide">
            <div className="flex gap-1.5 md:flex-wrap w-max md:w-auto">
              {/* Status pills */}
              {(['all', 'voided', 'refunded'] as const).map((f) => {
                const labels = { all: 'Tous', voided: 'Annulés', refunded: 'Remboursés' };
                const icons = { all: History, voided: Ban, refunded: RotateCcw };
                const count = statusCounts[f];
                const isActive = statusFilter === f;
                const Icon = icons[f];
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`h-9 md:h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${isActive ? 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-200'}`}
                  >
                    <Icon size={12} />
                    {labels[f]}
                    <span className={isActive ? 'text-blue-400' : 'text-slate-400'}>{count}</span>
                  </button>
                );
              })}
              {/* Separator */}
              <div className="w-px h-9 md:h-8 bg-slate-200 flex-shrink-0" />
              {/* Payment method pills */}
              {ALL_PAYMENT_METHODS.map((method) => {
                const isActive = paymentFilter === method;
                const count = paymentCounts.get(method) || 0;
                const Icon = PAYMENT_ICONS[method] || CreditCard;
                return (
                  <button
                    key={method}
                    onClick={() => setPaymentFilter(isActive ? null : method)}
                    className={`h-9 md:h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${isActive ? 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-200'}`}
                  >
                    <Icon size={12} />
                    {PAYMENT_METHOD_SHORT[method] || method}
                    <span className={isActive ? 'text-blue-400' : 'text-slate-400'}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop sort dropdown */}
          <div ref={sortRefDesktop} className="hidden md:block ml-auto flex-shrink-0 relative">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="h-8 px-3 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <ArrowUpDown size={12} />
                {{ time: 'Heure', amount: 'Montant' }[sortBy]}
              </button>
              <button
                onClick={() => setSortDesc(!sortDesc)}
                className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
                title={sortDesc ? 'Décroissant' : 'Croissant'}
              >
                {sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              </button>
            </div>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-10 min-w-[120px]">
                {(
                  [
                    ['time', 'Heure'],
                    ['amount', 'Montant'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSortBy(key);
                      setSortOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${sortBy === key ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction List — empty state */}
      {filteredTransactions.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-10 md:p-12 text-center">
            <History size={36} className="mx-auto mb-4 text-slate-300" />
            <p className="text-slate-400 text-sm md:text-base">Aucune transaction enregistrée.</p>
          </div>
        </div>
      )}

      {/* Transaction List — mobile cards */}
      {isMobile && filteredTransactions.length > 0 && (
        <div className="space-y-2.5">
          {displayedTransactions.map(({ parent: trx, children }) => {
            const status = getTransactionStatus(trx, transactions);
            const isVoided = status === 'voided';
            const showVoid = canVoid && status === 'active' && isToday(trx.date);
            const showRefund = canRefund && status !== 'voided' && status !== 'fully_refunded';
            const timeStr = new Date(trx.date).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const staffNames = getStaffNames(trx);
            return (
              <div key={trx.id} className="space-y-1.5">
                {/* Parent card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailTransaction(trx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailTransaction(trx);
                    }
                  }}
                  className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden active:bg-slate-50 transition-colors cursor-pointer ${isVoided ? 'opacity-60' : ''}`}
                >
                  {/* Top: time chip + client + total */}
                  <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
                    <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 tabular-nums tracking-tight">
                        {timeStr}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isVoided
                            ? 'bg-red-400'
                            : status === 'fully_refunded' || status === 'partially_refunded'
                              ? 'bg-orange-400'
                              : 'bg-emerald-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap leading-tight">
                        {trx.clientName ? (
                          <span
                            className={`text-slate-900 font-semibold text-[15px] ${isVoided ? 'line-through' : ''}`}
                          >
                            {formatName(trx.clientName)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-sm">Client de passage</span>
                        )}
                        {statusBadge(status, trx)}
                      </div>
                      {staffNames.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500 truncate">
                          {staffNames.join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-[17px] font-bold tabular-nums leading-none ${trx.total < 0 ? 'text-red-600' : 'text-slate-900'}`}
                      >
                        {formatPrice(trx.total)}
                      </div>
                      {trx.payments.length > 0 && (
                        <div className="mt-1.5 flex gap-1 justify-end">
                          {trx.payments.slice(0, 3).map((p, i) => {
                            const PIcon = PAYMENT_ICONS[p.method] || CreditCard;
                            return (
                              <span
                                key={i}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 text-slate-500"
                                title={p.method}
                              >
                                <PIcon size={11} />
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Service chips */}
                  {trx.items.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1">
                      {trx.items.map((item, i) => (
                        <span key={i} className={SERVICE_TAG}>
                          {itemLabel(item)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action strip */}
                  {(showVoid || showRefund) && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-1.5 flex items-center justify-end gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptTransaction(trx);
                        }}
                        className="px-3 h-9 rounded-lg text-slate-500 hover:text-slate-900 active:bg-slate-200 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
                        aria-label="Ticket"
                      >
                        <Receipt size={14} />
                        Ticket
                      </button>
                      {showRefund && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRefundTarget(trx);
                          }}
                          className="px-3 h-9 rounded-lg text-orange-500 hover:text-orange-700 active:bg-orange-100 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
                          aria-label="Rembourser"
                        >
                          <RotateCcw size={14} />
                          Remb.
                        </button>
                      )}
                      {showVoid && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVoidTarget(trx);
                          }}
                          className="px-3 h-9 rounded-lg text-red-500 hover:text-red-700 active:bg-red-100 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
                          aria-label="Annuler"
                        >
                          <Ban size={14} />
                          Annuler
                        </button>
                      )}
                    </div>
                  )}
                  {!showVoid && !showRefund && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-1.5 flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptTransaction(trx);
                        }}
                        className="h-8 rounded-lg text-slate-500 active:bg-slate-200 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
                        aria-label="Ticket"
                      >
                        <Receipt size={14} />
                        Ticket
                      </button>
                    </div>
                  )}
                </div>

                {/* Child cards (void/refund) with connector */}
                {children.length > 0 && (
                  <div className="pl-5 space-y-1.5">
                    {children.map((child) => {
                      const childTime = new Date(child.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isVoid = child.type === 'VOID';
                      const accentColor = isVoid ? 'text-red-500' : 'text-orange-500';
                      const borderColor = isVoid ? 'border-red-200' : 'border-orange-200';
                      return (
                        <div
                          key={child.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailTransaction(child)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDetailTransaction(child);
                            }
                          }}
                          className={`relative bg-white rounded-lg border ${borderColor} shadow-sm active:bg-slate-50 transition-colors cursor-pointer p-3 pl-5`}
                        >
                          {/* Connector line on left */}
                          <span
                            className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg ${isVoid ? 'bg-red-300' : 'bg-orange-300'}`}
                          />
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isVoid ? 'bg-red-50' : 'bg-orange-50'} ${accentColor}`}
                            >
                              {isVoid ? <Ban size={14} /> : <RotateCcw size={14} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 leading-tight">
                                {statusBadge('active', child)}
                                <span className="text-[11px] text-slate-400 tabular-nums">
                                  {childTime}
                                </span>
                              </div>
                              {child.items.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {child.items.slice(0, 3).map((item, i) => (
                                    <span
                                      key={i}
                                      className="text-[11px] font-medium bg-blue-50/60 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[140px]"
                                    >
                                      {itemLabel(item)}
                                    </span>
                                  ))}
                                  {child.items.length > 3 && (
                                    <span className="text-[11px] text-slate-400 px-1.5 py-0.5">
                                      +{child.items.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold tabular-nums text-red-600">
                                {formatPrice(child.total)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction List — desktop table */}
      {!isMobile && filteredTransactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  N°
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Heure
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Styliste
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Détails
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Total
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Paiement
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {displayedTransactions.map(({ parent: trx, children }, idx) => {
                const status = getTransactionStatus(trx, transactions);
                const isVoided = status === 'voided';
                const showVoid = canVoid && status === 'active' && isToday(trx.date);
                const showRefund = canRefund && status !== 'voided' && status !== 'fully_refunded';
                return (
                  <React.Fragment key={trx.id}>
                    <tr
                      className={`transition-colors ${idx % 2 === 1 ? 'bg-slate-100/50' : ''} hover:bg-slate-100/70 ${isVoided ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-5 font-mono text-xs text-slate-500">
                        {formatTicketNumber(trx.ticketNumber)}
                      </td>
                      <td className="px-6 py-5 font-medium text-slate-700">
                        {new Date(trx.date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          {trx.clientName ? (
                            <span
                              className={`text-slate-900 font-medium text-sm ${isVoided ? 'line-through' : ''}`}
                            >
                              {formatName(trx.clientName)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-sm">Client de passage</span>
                          )}
                          {statusBadge(status, trx)}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1">
                          {getStaffNames(trx).map((name) => (
                            <span key={name} className={TAG}>
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {trx.items.map((item, idx) => (
                            <span key={idx} className={SERVICE_TAG}>
                              {itemLabel(item)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td
                        className={`px-6 py-5 text-right font-bold ${trx.total < 0 ? 'text-red-600' : 'text-slate-900'}`}
                      >
                        {formatPrice(trx.total)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1">
                          {trx.payments.map((p, idx) => {
                            const PIcon = PAYMENT_ICONS[p.method] || CreditCard;
                            return (
                              <span key={idx} className={`${TAG} flex items-center gap-1`}>
                                <PIcon size={11} />
                                {PAYMENT_METHOD_SHORT[p.method] || p.method}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {showVoid && (
                            <button
                              onClick={() => setVoidTarget(trx)}
                              className="p-2 text-red-300 hover:text-red-600 transition-colors"
                              title="Annuler"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                          {showRefund && (
                            <button
                              onClick={() => setRefundTarget(trx)}
                              className="p-2 text-orange-300 hover:text-orange-600 transition-colors"
                              title="Rembourser"
                            >
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
                            onClick={() =>
                              window.open(
                                `/pos/historique/${trx.id}/print`,
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                            className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                            title="Imprimer ticket"
                          >
                            <Receipt size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {children.map((child) => (
                      <tr
                        key={child.id}
                        className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
                      >
                        <td className="px-6 py-2 font-mono text-xs text-slate-400">
                          {formatTicketNumber(child.ticketNumber)}
                        </td>
                        <td className="px-6 py-2 pl-10 text-xs text-slate-500">
                          {new Date(child.date).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-2">
                            {child.type === 'VOID' ? (
                              <Ban size={12} className="text-red-500" />
                            ) : (
                              <RotateCcw size={12} className="text-orange-500" />
                            )}
                            {statusBadge('active', child)}
                          </div>
                        </td>
                        <td className="px-6 py-2"></td>
                        <td className="px-6 py-2">
                          <div className="flex flex-wrap gap-1">
                            {child.items.map((item, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] font-medium bg-blue-50/50 text-blue-500 px-1.5 py-0.5 rounded border border-blue-100"
                              >
                                {itemLabel(item)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-2 text-right font-semibold text-sm text-red-600">
                          {formatPrice(child.total)}
                        </td>
                        <td className="px-6 py-2"></td>
                        <td className="px-6 py-2 text-right">
                          <button
                            onClick={() => setDetailTransaction(child)}
                            className="p-1.5 text-slate-300 hover:text-slate-900 transition-colors"
                            title="Voir les détails"
                          >
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
        </div>
      )}

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
          onVoidClick={
            canVoid
              ? (t: Transaction) => {
                  setDetailTransaction(null);
                  setVoidTarget(t);
                }
              : undefined
          }
          onRefundClick={
            canRefund
              ? (t: Transaction) => {
                  setDetailTransaction(null);
                  setRefundTarget(t);
                }
              : undefined
          }
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
