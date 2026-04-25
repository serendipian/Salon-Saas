import {
  ArrowRightLeft,
  Banknote,
  ChevronDown,
  CreditCard,
  Gift,
  Heart,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { formatPrice } from '../../../lib/format';
import type { CartItem, PaymentEntry, StaffMember } from '../../../types';
import type { TransactionTipPayload } from '../mappers';

interface PaymentModalProps {
  total: number;
  cart?: CartItem[];
  /** Staff list for tip-recipient dropdown. Filtered to active staff before display. */
  staff?: StaffMember[];
  onClose: () => void;
  onComplete: (payments: PaymentEntry[], tips: TransactionTipPayload[]) => void;
  isProcessing?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const METHODS_PRIMARY = [
  { method: 'Espèces', Icon: Banknote },
  { method: 'Carte Bancaire', Icon: CreditCard },
] as const;

const METHODS_SECONDARY = [
  { method: 'Virement', Icon: ArrowRightLeft },
  { method: 'Carte Cadeau', Icon: Gift },
  { method: 'Autre', Icon: Tag },
] as const;

const ALL_METHODS = [...METHODS_PRIMARY, ...METHODS_SECONDARY] as const;

const QUICK_DENOMINATIONS = [50, 100, 200] as const;
const TIP_PERCENT_CHIPS = [5, 10, 15, 20] as const;

// Map UI labels to RPC-wire constants. Keep in sync with mappers.ts methodMap.
const METHOD_TO_WIRE: Record<string, string> = {
  Espèces: 'CASH',
  'Carte Bancaire': 'CARD',
  Virement: 'TRANSFER',
  Chèque: 'CHECK',
  Mobile: 'MOBILE',
  'Carte Cadeau': 'OTHER',
  Autre: 'OTHER',
};

interface TipRow {
  /** Local row id, not persisted. */
  id: string;
  staffId: string;
  /** Free-text amount input. Parsed to number at submit time. */
  amount: string;
  /** UI label (Espèces / Carte Bancaire / etc.). Mapped to wire format on submit. */
  method: string;
  /** Set true only on user-originated method change. Programmatic default-sync MUST NOT flip this. */
  isMethodCustom: boolean;
}

const getIcon = (method: string) => {
  if (method.includes('Carte Bancaire')) return CreditCard;
  if (method.includes('Espèces')) return Banknote;
  if (method.includes('Virement')) return ArrowRightLeft;
  if (method.includes('Cadeau')) return Gift;
  return Tag;
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  total,
  cart = [],
  staff = [],
  onClose,
  onComplete,
  isProcessing,
}) => {
  const { isMobile } = useMediaQuery();
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Mode A (default): single payment, method is selected mutually-exclusively
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // Mode B (opt-in): list of payments built incrementally; remaining locks at 0
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  const [currentAmount, setCurrentAmount] = useState<string>(total.toFixed(2));
  // Tracks whether the cashier has manually typed in the amount input.
  // When false (default), the input auto-syncs to total + tipsTotal so the
  // "tendered" value reflects the grand total to collect. When true, leave
  // the cashier's value alone — they're declaring an explicit overpay or
  // partial amount.
  const [isAmountCustom, setIsAmountCustom] = useState(false);
  const [splitToggleError, setSplitToggleError] = useState<string | null>(null);

  // Tips state — section is collapsed by default; expands when cashier clicks
  // "+ Ajouter un pourboire" or any existing row is present.
  const [tipRows, setTipRows] = useState<TipRow[]>([]);
  const [tipsExpanded, setTipsExpanded] = useState(false);

  // Staff candidates: those who appear on the cart's items (the people who
  // actually performed the services for this client). Falls back to the full
  // active staff list when no cart items have a staff (walk-in product sale).
  const tipStaffCandidates = useMemo(() => {
    const idsOnCart = new Set(cart.filter((i) => i.staffId).map((i) => i.staffId as string));
    const activeStaff = staff.filter((s) => s.active && !s.deletedAt);
    if (idsOnCart.size === 0) return activeStaff;
    const filtered = activeStaff.filter((s) => idsOnCart.has(s.id));
    return filtered.length > 0 ? filtered : activeStaff;
  }, [cart, staff]);

  // Services subtotal — used to compute the % chip amounts. Products aren't
  // tipped per cultural convention.
  const servicesSubtotal = useMemo(
    () =>
      round2(
        cart
          .filter((i) => i.type === 'SERVICE')
          .reduce((sum, i) => sum + i.price * i.quantity, 0),
      ),
    [cart],
  );

  const tipsTotal = useMemo(
    () => round2(tipRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)),
    [tipRows],
  );

  // The "main method" used as the default for new tip rows and to sync rows
  // that haven't been manually overridden. Mode A: selectedMethod. Mode B:
  // first payment in the list. Fallback: Espèces.
  const mainMethod = isSplitMode
    ? (payments[0]?.method ?? 'Espèces')
    : (selectedMethod ?? 'Espèces');

  // Sync tip rows whose isMethodCustom is false to the current mainMethod.
  // Programmatic update — does NOT flip isMethodCustom.
  useEffect(() => {
    setTipRows((prev) =>
      prev.map((r) => (r.isMethodCustom ? r : { ...r, method: mainMethod })),
    );
  }, [mainMethod]);

  const addTipRow = () => {
    setTipRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        staffId: tipStaffCandidates[0]?.id ?? '',
        amount: '',
        method: mainMethod,
        isMethodCustom: false,
      },
    ]);
    setTipsExpanded(true);
  };

  const updateTipRow = (id: string, updates: Partial<TipRow>) => {
    setTipRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeTipRow = (id: string) => {
    setTipRows((prev) => prev.filter((r) => r.id !== id));
  };

  const applyTipPercent = (rowId: string, percent: number) => {
    const amt = round2(servicesSubtotal * (percent / 100));
    updateTipRow(rowId, { amount: amt.toFixed(2) });
  };

  // Tip-row classification (per spec):
  // - fully empty (no staff + no amount): silently dropped at submit
  // - half-filled (one of the two): shown with red border + "Complétez" hint;
  //   blocks confirm
  // - valid (staff + amount > 0): emitted to RPC
  const tipRowStatus = (r: TipRow): 'empty' | 'halfFilled' | 'valid' => {
    const hasAmount = parseFloat(r.amount) > 0;
    const hasStaff = !!r.staffId;
    if (!hasAmount && !hasStaff) return 'empty';
    if (hasAmount !== hasStaff) return 'halfFilled';
    return 'valid';
  };

  const hasInvalidTipRow = tipRows.some((r) => tipRowStatus(r) === 'halfFilled');

  const totalPaidInSplit = useMemo(
    () => round2(payments.reduce((sum, p) => sum + p.amount, 0)),
    [payments],
  );
  const remaining = useMemo(
    () => round2(Math.max(0, total - totalPaidInSplit)),
    [total, totalPaidInSplit],
  );

  // Body scroll lock + Escape key on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isMobile, onClose]);

  // In split mode, sync the input to the remaining due (keeps the "next
  // payment is for this much" affordance). In single mode, sync to
  // total + tipsTotal so the "tendered" amount reflects the grand total to
  // collect — UNLESS the cashier has manually overridden it (isAmountCustom).
  useEffect(() => {
    if (isSplitMode) {
      setCurrentAmount(remaining.toFixed(2));
    } else if (!isAmountCustom) {
      setCurrentAmount(round2(total + tipsTotal).toFixed(2));
    }
    // tipsTotal is read inside; intentional dep
  }, [isSplitMode, remaining, total, tipsTotal, isAmountCustom]);

  const parsedAmount = (() => {
    const n = parseFloat(currentAmount);
    return Number.isNaN(n) ? 0 : round2(n);
  })();

  // Grand total to collect = services + tips. Change is what the cashier
  // gives back from the tendered amount, after both services and tips are
  // covered.
  const grandTotal = round2(total + tipsTotal);
  const change = round2(Math.max(0, parsedAmount - grandTotal));
  const isSingleAmountValid = parsedAmount > 0 && parsedAmount >= grandTotal;

  // ---- Mode A: single payment ----

  const handleSelectMethod = (method: string) => {
    setSelectedMethod((prev) => (prev === method ? prev : method));
    setSplitToggleError(null);
  };

  const handleQuickAmount = (denomination: number | 'exact') => {
    // "Exact" means exactly the grand total to collect (services + tips).
    // Numeric denominations are absolute note amounts (50, 100, 200) used
    // when the cashier hands the customer a fixed-denomination note.
    const value = denomination === 'exact' ? grandTotal : denomination;
    setCurrentAmount(value.toFixed(2));
    setIsAmountCustom(true);
  };

  // ---- Mode B: split payment ----

  const handleAddSplitPayment = (method: string) => {
    const amount = parsedAmount;
    if (amount <= 0) return;
    // Cap at remaining — split is exact-only; overpay belongs in Mode A
    const capped = round2(Math.min(amount, remaining));
    if (capped <= 0) return;
    setPayments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), method, amount: capped },
    ]);
  };

  const handleRemovePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  // ---- Mode toggle ----

  const enterSplitMode = () => {
    setSplitToggleError(null);
    if (selectedMethod && parsedAmount > 0) {
      if (parsedAmount > total) {
        setSplitToggleError(
          'Le paiement multiple ne permet pas de rendre la monnaie. Restez en paiement simple.',
        );
        return;
      }
      // Promote pending Mode-A state to a first payment so cashier intent
      // isn't lost across the toggle.
      setPayments([
        {
          id: crypto.randomUUID(),
          method: selectedMethod,
          amount: round2(Math.min(parsedAmount, total)),
        },
      ]);
    }
    setSelectedMethod(null);
    setIsSplitMode(true);
  };

  const exitSplitMode = () => {
    if (payments.length > 0) return;
    setIsSplitMode(false);
    setIsAmountCustom(false); // back to auto-sync mode
  };

  // ---- Confirm ----

  const canConfirm =
    isProcessing || hasInvalidTipRow
      ? false
      : isSplitMode
        ? remaining === 0 && payments.length > 0
        : selectedMethod !== null && isSingleAmountValid;

  const buildTipPayload = (): TransactionTipPayload[] =>
    tipRows
      .filter((r) => tipRowStatus(r) === 'valid')
      .map((r) => ({
        staff_id: r.staffId,
        amount: round2(parseFloat(r.amount)),
        method: METHOD_TO_WIRE[r.method] ?? 'OTHER',
      }));

  const handleConfirm = () => {
    if (!canConfirm) return;
    const tips = buildTipPayload();
    if (isSplitMode) {
      onComplete(payments, tips);
      return;
    }
    if (!selectedMethod) return;
    onComplete(
      [{ id: crypto.randomUUID(), method: selectedMethod, amount: parsedAmount }],
      tips,
    );
  };

  // ---- Confirm button copy ----

  const confirmCopy = (() => {
    if (isProcessing) {
      return { topLine: 'Traitement…', bottomLine: null as string | null };
    }
    if (hasInvalidTipRow) {
      return {
        topLine: 'Complétez les pourboires en cours',
        bottomLine: null,
      };
    }
    const tipsBottom = tipsTotal > 0 ? ` + ${formatPrice(tipsTotal)} pourboire` : '';
    if (isSplitMode) {
      if (payments.length === 0) {
        return { topLine: 'Ajoutez un paiement', bottomLine: null };
      }
      if (remaining > 0) {
        return {
          topLine: `Restant : ${formatPrice(remaining)}`,
          bottomLine: `${payments.length} paiement${payments.length > 1 ? 's' : ''} enregistré${payments.length > 1 ? 's' : ''}${tipsTotal > 0 ? ` (+ ${formatPrice(tipsTotal)} pourboire)` : ''}`,
        };
      }
      return {
        topLine: `Valider la transaction${tipsBottom}`,
        bottomLine: `${payments.length} paiement${payments.length > 1 ? 's' : ''}`,
      };
    }
    if (!selectedMethod) {
      return { topLine: 'Sélectionnez un mode de paiement', bottomLine: null };
    }
    if (!isSingleAmountValid) {
      return { topLine: 'Saisissez un montant valide', bottomLine: null };
    }
    if (change > 0) {
      return {
        topLine: `Encaisser ${formatPrice(parsedAmount)}${tipsBottom} · ${selectedMethod}`,
        bottomLine: `Rendre ${formatPrice(change)}`,
      };
    }
    return {
      topLine: `Encaisser ${formatPrice(parsedAmount)}${tipsBottom} · ${selectedMethod}`,
      bottomLine: null,
    };
  })();

  // ---- Mobile collapsible summary ----
  const mobileSummary =
    cart.length > 0 && isMobile ? (
      <div className="border-b border-slate-100">
        <button
          type="button"
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm"
        >
          <span className="text-slate-600">
            {cart.length} article{cart.length > 1 ? 's' : ''} · {formatPrice(total)}
          </span>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {summaryExpanded && (
          <div className="px-5 pb-3 space-y-2">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs text-slate-600">
                <span>
                  {item.name} {item.variantName ? `(${item.variantName})` : ''} × {item.quantity}
                </span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null;

  // ---- Method buttons (Mode A: select; Mode B: add) ----

  const methodButton = (
    method: string,
    Icon: typeof Banknote,
    layout: 'primary' | 'secondary',
  ) => {
    const active = !isSplitMode && selectedMethod === method;
    const disabledInSplit = isSplitMode && remaining <= 0;
    const baseLayout =
      layout === 'primary'
        ? 'flex flex-col items-center justify-center gap-2 p-5 rounded-xl border min-h-[80px] shadow-sm'
        : 'flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border min-h-[72px] shadow-sm';
    const stateClass = active
      ? 'bg-slate-900 text-white border-slate-900'
      : disabledInSplit
        ? 'bg-white border-slate-200 opacity-50 cursor-not-allowed'
        : 'bg-white border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-colors';
    const handleClick = () => {
      if (isSplitMode) {
        handleAddSplitPayment(method);
      } else {
        handleSelectMethod(method);
      }
    };
    return (
      <button
        key={method}
        type="button"
        onClick={handleClick}
        disabled={disabledInSplit}
        aria-pressed={!isSplitMode ? selectedMethod === method : undefined}
        className={`${baseLayout} ${stateClass}`}
      >
        <Icon
          size={layout === 'primary' ? 28 : 22}
          className={active ? 'text-white' : 'text-slate-400'}
        />
        <span
          className={`font-bold ${layout === 'primary' ? 'text-sm' : 'text-xs'} ${active ? 'text-white' : 'text-slate-700'}`}
        >
          {method}
        </span>
      </button>
    );
  };

  // ---- Body content shared between mobile and desktop shells ----

  const bodyContent = (
    <>
      <div className="space-y-5">
        {/* Total + mode toggle */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              {isSplitMode ? 'Restant à payer' : 'Total à encaisser'}
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {formatPrice(isSplitMode ? remaining : total)}
            </div>
          </div>
          <div className="flex flex-col items-end">
            {isSplitMode ? (
              <button
                type="button"
                onClick={exitSplitMode}
                disabled={payments.length > 0}
                aria-disabled={payments.length > 0}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Retour au paiement simple
              </button>
            ) : (
              <button
                type="button"
                onClick={enterSplitMode}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={12} /> Paiement multiple
              </button>
            )}
            {isSplitMode && payments.length > 0 && (
              <span className="text-[10px] text-slate-400 mt-1 max-w-[200px] text-right">
                Retirez d'abord les paiements en cours.
              </span>
            )}
            {splitToggleError && (
              <span className="text-[11px] text-amber-700 mt-1 max-w-[220px] text-right">
                {splitToggleError}
              </span>
            )}
          </div>
        </div>

        {/* Method selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {METHODS_PRIMARY.map(({ method, Icon }) => methodButton(method, Icon, 'primary'))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {METHODS_SECONDARY.map(({ method, Icon }) => methodButton(method, Icon, 'secondary'))}
          </div>
        </div>

        {/* Amount input (always visible) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            {isSplitMode ? 'Montant du prochain paiement' : 'Montant reçu'}
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={currentAmount}
              onChange={(e) => {
                setCurrentAmount(e.target.value);
                setIsAmountCustom(true);
              }}
              className="w-full text-3xl font-bold text-slate-900 border-b-2 border-slate-200 focus:border-slate-900 outline-none py-1 bg-white"
              placeholder="0.00"
            />
          </div>

          {/* Quick-amount chips: Espèces only, Mode A only */}
          {!isSplitMode && selectedMethod === 'Espèces' && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => handleQuickAmount('exact')}
                className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
              >
                Exact
              </button>
              {QUICK_DENOMINATIONS.filter((d) => d > grandTotal).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleQuickAmount(d)}
                  className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
                >
                  {formatPrice(d)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Change-due — Mode A only, when overpaid */}
        {!isSplitMode && change > 0 && selectedMethod && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wider">
              Rendre
            </span>
            <span className="text-3xl font-bold text-emerald-900 tabular-nums">
              {formatPrice(change)}
            </span>
          </div>
        )}

        {/* Tips section — collapsed by default */}
        {tipRows.length === 0 && !tipsExpanded ? (
          <button
            type="button"
            onClick={addTipRow}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            <Heart size={14} />
            Ajouter un pourboire
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Heart size={12} />
                Pourboires
              </span>
              {tipsTotal > 0 && (
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                  Total : {formatPrice(tipsTotal)}
                </span>
              )}
            </div>

            {tipRows.map((row) => {
              const status = tipRowStatus(row);
              const invalid = status === 'halfFilled';
              return (
                <div
                  key={row.id}
                  className={`bg-white rounded-lg border ${invalid ? 'border-red-300' : 'border-slate-200'} p-3 space-y-2`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={row.staffId}
                      onChange={(e) => updateTipRow(row.id, { staffId: e.target.value })}
                      className="flex-1 min-w-[120px] text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-slate-900"
                    >
                      <option value="" disabled>
                        Choisir un membre
                      </option>
                      {tipStaffCandidates.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={row.amount}
                      placeholder="0.00"
                      onChange={(e) => updateTipRow(row.id, { amount: e.target.value })}
                      className="w-24 text-sm font-semibold border border-slate-300 rounded-md px-2 py-1.5 bg-white text-right tabular-nums focus:outline-none focus:border-slate-900"
                    />
                    <select
                      value={row.method}
                      onChange={(e) =>
                        updateTipRow(row.id, { method: e.target.value, isMethodCustom: true })
                      }
                      className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-slate-900"
                    >
                      {ALL_METHODS.map((m) => (
                        <option key={m.method} value={m.method}>
                          {m.method}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeTipRow(row.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      aria-label="Retirer ce pourboire"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Percentage chips — services-only, hidden when no services */}
                  {servicesSubtotal > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {TIP_PERCENT_CHIPS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => applyTipPercent(row.id, p)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          {p}% ({formatPrice(round2(servicesSubtotal * (p / 100)))})
                        </button>
                      ))}
                    </div>
                  )}
                  {invalid && (
                    <div className="text-[11px] text-red-600">
                      Complétez ce pourboire (membre + montant) ou retirez-le.
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addTipRow}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-slate-300 text-xs text-slate-600 hover:border-slate-400 hover:bg-white transition-colors"
            >
              <Plus size={12} />
              Ajouter
            </button>
          </div>
        )}

        {/* Split payments list — Mode B only */}
        {isSplitMode && payments.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase">Paiements enregistrés</div>
            {payments.map((p) => {
              const Icon = getIcon(p.method);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <Icon size={14} className="text-slate-400" />
                    <span>{p.method}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-sm tabular-nums">
                      {formatPrice(p.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(p.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                      aria-label="Retirer ce paiement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  // ---- Confirmer button (footer) ----

  const confirmButton = (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={!canConfirm}
      className={`w-full rounded-xl font-bold transition-all flex flex-col items-center justify-center shadow-sm ${
        canConfirm
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
      } ${isMobile ? 'py-4 min-h-[64px]' : 'py-3 min-h-[56px]'}`}
    >
      <span className="text-base">{confirmCopy.topLine}</span>
      {confirmCopy.bottomLine && (
        <span className="text-xs font-medium opacity-90 mt-0.5">{confirmCopy.bottomLine}</span>
      )}
    </button>
  );

  // ---- Mobile shell ----
  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Encaissement"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Encaissement</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {mobileSummary}

        <div className="flex-1 overflow-y-auto px-5 py-4">{bodyContent}</div>

        <div
          className="shrink-0 px-5 py-4 bg-slate-50 border-t border-slate-200"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          {confirmButton}
        </div>
      </div>,
      document.body,
    );
  }

  // ---- Desktop shell ----
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Encaissement"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Encaissement</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{bodyContent}</div>

        <div className="shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-200">
          {confirmButton}
        </div>
      </div>
    </div>,
    document.body,
  );
};
