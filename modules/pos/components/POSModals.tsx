import {
  Ban,
  Banknote,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  RotateCcw,
  Scissors,
  ShoppingBag,
  Smartphone,
  StickyNote,
  User,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../../../components/FormElements';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { formatPrice, formatTicketNumber } from '../../../lib/format';
import type { CartItem, Service, ServiceVariant, Transaction } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { REFUND_CATEGORIES, VOID_CATEGORIES } from '../constants';
import { getTransactionStatus } from '../mappers';
import { ReceiptBody } from './ReceiptBody';

// Shared hook for mobile fullscreen modal accessibility
function useMobileModalA11y(isMobile: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, onClose]);
}

// --- Item Editor (Discount/Price/Note) ---
export const ItemEditorModal: React.FC<{
  item: CartItem;
  onClose: () => void;
  onSave: (updatedItem: CartItem) => void;
}> = ({ item, onClose, onSave }) => {
  const { salonSettings } = useSettings();
  const [price, setPrice] = useState<number>(item.price);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [note, setNote] = useState<string>(item.note || '');

  const originalPrice = item.originalPrice || item.price;
  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';
  const { isMobile } = useMediaQuery();
  useMobileModalA11y(isMobile, onClose);

  const applyDiscount = (percent: number) => {
    const newPrice = originalPrice * (1 - percent / 100);
    setPrice(parseFloat(newPrice.toFixed(2)));
  };

  const handleSave = () => {
    const safePrice = Number.isNaN(price) || price < 0 ? 0 : price;
    onSave({
      ...item,
      price: safePrice,
      quantity,
      note,
      originalPrice: originalPrice,
    });
    onClose();
  };

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier ${item.name}`}
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{item.name}</h3>
            {item.variantName && <span className="text-xs text-slate-500">{item.variantName}</span>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Prix Unitaire
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="w-full text-3xl font-bold text-slate-900 border-b-2 border-slate-200 focus:border-slate-900 outline-none py-1 bg-white"
              />
              <span className="absolute right-0 bottom-2 text-lg text-slate-400">
                {currencySymbol}
              </span>
              {originalPrice !== price && (
                <span className="absolute right-8 top-2 text-sm text-slate-400 line-through">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => applyDiscount(10)}
              className="py-3 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 min-h-[44px]"
            >
              -10%
            </button>
            <button
              onClick={() => applyDiscount(20)}
              className="py-3 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 min-h-[44px]"
            >
              -20%
            </button>
            <button
              onClick={() => setPrice(0)}
              className="py-3 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-emerald-600 min-h-[44px]"
            >
              Offert
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-700">Quantité</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-lg font-bold"
              >
                -
              </button>
              <span className="font-bold text-lg w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Geste commercial..."
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-slate-400 placeholder:text-slate-400 min-h-[44px]"
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 px-5 py-4 bg-slate-50 border-t border-slate-200"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleSave}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-slate-800"
          >
            Appliquer
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
            {item.variantName && <span className="text-xs text-slate-500">{item.variantName}</span>}
          </div>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400 hover:text-slate-700" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Prix Unitaire
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="w-full text-3xl font-bold text-slate-900 border-b-2 border-slate-200 focus:border-slate-900 outline-none py-1 bg-white"
              />
              <span className="absolute right-0 bottom-2 text-lg text-slate-400">
                {currencySymbol}
              </span>
              {originalPrice !== price && (
                <span className="absolute right-8 top-2 text-sm text-slate-400 line-through">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => applyDiscount(10)}
              className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50"
            >
              -10%
            </button>
            <button
              onClick={() => applyDiscount(20)}
              className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50"
            >
              -20%
            </button>
            <button
              onClick={() => setPrice(0)}
              className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-emerald-600"
            >
              Offert
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-700">Quantité</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200"
              >
                -
              </button>
              <span className="font-bold text-lg w-6 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200"
              >
                +
              </button>
            </div>
          </div>

          <Input
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Geste commercial..."
          />
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handleSave}
            className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-slate-800"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Service Variant Selector ---
export const ServiceVariantModal: React.FC<{
  service: Service;
  onClose: () => void;
  onSelect: (variant: ServiceVariant) => void;
}> = ({ service, onClose, onSelect }) => {
  const { isMobile } = useMediaQuery();
  useMobileModalA11y(isMobile, onClose);

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une option"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">Choisir une option</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {service.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[56px] shadow-sm"
            >
              <div className="text-left">
                <div className="font-semibold text-slate-900">{variant.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={12} /> {variant.durationMinutes} min
                </div>
              </div>
              <div className="font-bold text-slate-900 text-lg">{formatPrice(variant.price)}</div>
            </button>
          ))}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Choisir une option</h3>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="p-2">
          {service.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl group transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="text-left">
                <div className="font-semibold text-slate-900">{variant.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={12} /> {variant.durationMinutes} min
                </div>
              </div>
              <div className="font-bold text-slate-900 text-lg group-hover:scale-110 transition-transform">
                {formatPrice(variant.price)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Receipt Viewer ---
export const ReceiptModal: React.FC<{
  transaction: Transaction;
  allTransactions: Transaction[];
  onClose: () => void;
}> = ({ transaction, allTransactions, onClose }) => {
  const { salonSettings } = useSettings();
  const vatRate = salonSettings.vatRate || 20;
  const { isMobile } = useMediaQuery();
  useMobileModalA11y(isMobile, onClose);
  const receiptStatus = getTransactionStatus(transaction, allTransactions);

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ticket de caisse"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">
            Ticket <span className="font-mono text-slate-500">{formatTicketNumber(transaction.ticketNumber)}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <ReceiptBody
            tx={transaction}
            salonName={salonSettings.name}
            salonAddress={salonSettings.address}
            salonPhone={salonSettings.phone}
            vatRate={vatRate}
            status={receiptStatus}
          />
        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex gap-3"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() =>
              window.open(`/pos/historique/${transaction.id}/print`, '_blank', 'noopener,noreferrer')
            }
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
          >
            Imprimer
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
          >
            Fermer
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">
            Ticket <span className="font-mono text-slate-500">{formatTicketNumber(transaction.ticketNumber)}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <ReceiptBody
            tx={transaction}
            salonName={salonSettings.name}
            salonAddress={salonSettings.address}
            salonPhone={salonSettings.phone}
            vatRate={vatRate}
            status={receiptStatus}
          />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
          <button
            onClick={() =>
              window.open(`/pos/historique/${transaction.id}/print`, '_blank', 'noopener,noreferrer')
            }
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm"
          >
            Imprimer
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Transaction Detail Viewer ---
const paymentMethodIcon = (method: string) => {
  if (method.toLowerCase().includes('espèces') || method.toLowerCase().includes('cash'))
    return <Banknote size={14} />;
  if (method.toLowerCase().includes('carte') || method.toLowerCase().includes('card'))
    return <CreditCard size={14} />;
  if (
    method.toLowerCase().includes('mobile') ||
    method.toLowerCase().includes('wave') ||
    method.toLowerCase().includes('orange')
  )
    return <Smartphone size={14} />;
  if (method.toLowerCase().includes('offert') || method.toLowerCase().includes('gift'))
    return <Gift size={14} />;
  return <CreditCard size={14} />;
};

export const TransactionDetailModal: React.FC<{
  transaction: Transaction;
  allTransactions: Transaction[];
  onClose: () => void;
  onVoidClick?: (t: Transaction) => void;
  onRefundClick?: (t: Transaction) => void;
  onViewTransaction?: (t: Transaction) => void;
}> = ({ transaction, allTransactions, onClose, onVoidClick, onRefundClick, onViewTransaction }) => {
  const { isMobile } = useMediaQuery();
  useMobileModalA11y(isMobile, onClose);

  const status = getTransactionStatus(transaction, allTransactions);
  const isToday = new Date(transaction.date).toDateString() === new Date().toDateString();
  const showVoid = onVoidClick && transaction.type === 'SALE' && status === 'active' && isToday;
  const showRefund =
    onRefundClick &&
    transaction.type === 'SALE' &&
    status !== 'voided' &&
    status !== 'fully_refunded';
  const originalTransaction = transaction.originalTransactionId
    ? allTransactions.find((t) => t.id === transaction.originalTransactionId)
    : undefined;

  const getCategoryLabel = (key: string) => {
    const v = VOID_CATEGORIES.find((c) => c.key === key);
    if (v) return v.label;
    const r = REFUND_CATEGORIES.find((c) => c.key === key);
    if (r) return r.label;
    return key;
  };

  const serviceItems = transaction.items.filter((i) => i.type === 'SERVICE');
  const productItems = transaction.items.filter((i) => i.type === 'PRODUCT');
  const totalPaid = transaction.payments.reduce((acc, p) => acc + p.amount, 0);
  const change = Math.max(0, totalPaid - transaction.total);
  const totalDiscount = transaction.items.reduce((acc, item) => {
    if (item.originalPrice && item.originalPrice > item.price) {
      return acc + (item.originalPrice - item.price) * item.quantity;
    }
    return acc;
  }, 0);

  const detailContent = (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Date</span>
          <span className="font-medium text-slate-900">
            {new Date(transaction.date).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Transaction</span>
          <span className="font-mono text-xs text-slate-600">
            #{transaction.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Client</span>
          {transaction.clientName ? (
            <span className="font-medium text-slate-900">{transaction.clientName}</span>
          ) : (
            <span className="italic text-slate-400">Client de passage</span>
          )}
        </div>
        {transaction.type !== 'SALE' && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Type</span>
            <span
              className={`font-medium ${transaction.type === 'VOID' ? 'text-red-600' : 'text-orange-600'}`}
            >
              {transaction.type === 'VOID' ? 'Annulation' : 'Remboursement'}
            </span>
          </div>
        )}
        {transaction.reasonCategory && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Motif</span>
            <span className="font-medium text-slate-700">
              {getCategoryLabel(transaction.reasonCategory)}
            </span>
          </div>
        )}
        {transaction.reasonNote && (
          <div className="text-sm mt-2 p-2 bg-white rounded border border-slate-100 text-slate-600 italic">
            {transaction.reasonNote}
          </div>
        )}
        {originalTransaction && onViewTransaction && (
          <button
            onClick={() => onViewTransaction(originalTransaction)}
            className="w-full mt-2 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ExternalLink size={14} /> Voir la transaction originale
          </button>
        )}
      </div>

      {/* Services */}
      {serviceItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scissors size={16} className="text-blue-500" />
            <h4 className="font-bold text-slate-900 text-sm">Services ({serviceItems.length})</h4>
          </div>
          <div className="space-y-2">
            {serviceItems.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                    {item.variantName && (
                      <div className="text-xs text-slate-500">{item.variantName}</div>
                    )}
                    {item.staffName && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                        <User size={12} /> {item.staffName}
                      </div>
                    )}
                    {item.note && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                        <StickyNote size={12} /> {item.note}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-bold text-slate-900 text-sm">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-xs text-slate-400">
                        {item.quantity} x {formatPrice(item.price)}
                      </div>
                    )}
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="text-xs text-red-400 line-through">
                        {formatPrice(item.originalPrice * item.quantity)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      {productItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag size={16} className="text-violet-500" />
            <h4 className="font-bold text-slate-900 text-sm">Produits ({productItems.length})</h4>
          </div>
          <div className="space-y-2">
            {productItems.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                    {item.staffName && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                        <User size={12} /> {item.staffName}
                      </div>
                    )}
                    {item.note && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                        <StickyNote size={12} /> {item.note}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-bold text-slate-900 text-sm">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-xs text-slate-400">
                        {item.quantity} x {formatPrice(item.price)}
                      </div>
                    )}
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="text-xs text-red-400 line-through">
                        {formatPrice(item.originalPrice * item.quantity)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={16} className="text-emerald-500" />
          <h4 className="font-bold text-slate-900 text-sm">Paiements</h4>
        </div>
        <div className="bg-white border border-slate-100 rounded-lg divide-y divide-slate-50">
          {transaction.payments.map((payment, idx) => (
            <div key={idx} className="flex justify-between items-center p-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {paymentMethodIcon(payment.method)}
                <span>{payment.method}</span>
              </div>
              <span className="font-bold text-slate-900 text-sm">
                {formatPrice(payment.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        {totalDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-red-500">Remise totale</span>
            <span className="font-medium text-red-500">-{formatPrice(totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-slate-900">
          <span>Total</span>
          <span>{formatPrice(transaction.total)}</span>
        </div>
        {change > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600">Monnaie rendue</span>
            <span className="font-medium text-emerald-600">{formatPrice(change)}</span>
          </div>
        )}
      </div>

      {/* Void/Refund action buttons */}
      {(showVoid || showRefund) && (
        <div className="flex gap-2 pt-2">
          {showVoid && (
            <button
              onClick={() => onVoidClick?.(transaction)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Ban size={16} /> Annuler
            </button>
          )}
          {showRefund && (
            <button
              onClick={() => onRefundClick?.(transaction)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <RotateCcw size={16} /> Rembourser
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Détails de la transaction"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">Détails de la transaction</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto p-5"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          {detailContent}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">Détails de la transaction</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{detailContent}</div>
      </div>
    </div>
  );
};
