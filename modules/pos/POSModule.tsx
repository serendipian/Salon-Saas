import { History } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../context/MediaQueryContext';
import { usePermissions } from '../../hooks/usePermissions';
import type {
  CartItem,
  FavoriteItem,
  Pack,
  PaymentEntry,
  Product,
  Service,
  ServiceVariant,
  Transaction,
} from '../../types';
import { usePacks } from '../services/hooks/usePacks';
import { expandPack } from '../services/utils/packExpansion';
import { CartBottomSheet } from './components/CartBottomSheet';
import { MiniCartBar } from './components/MiniCartBar';
import { PaymentModal } from './components/PaymentModal';
import { POSCart } from './components/POSCart';
import { POSCatalog } from './components/POSCatalog';
import {
  ItemEditorModal,
  ReceiptModal,
  ServiceVariantModal,
  TransactionDetailModal,
} from './components/POSModals';
import { RefundModal } from './components/RefundModal';
import { TransactionSuccessModal } from './components/TransactionSuccessModal';
import { VoidModal } from './components/VoidModal';
import { usePOS } from './hooks/usePOS';

export const POSModule: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedClient,
    setSelectedClient,
    cart,
    services,
    serviceCategories,
    favorites,
    productCategories,
    transactions,
    clients,
    allStaff,
    filteredItems,
    totals,
    addToCart,
    updateCartItem,
    updateQuantity,
    removeFromCart,
    processTransaction,
    pendingAppointments,
    linkedAppointmentId,
    importAppointment,
    voidTransaction: doVoid,
    refundTransaction: doRefund,
    isVoiding,
    isRefunding,
  } = usePOS();

  const { validPacks } = usePacks();

  // Merge pack favorites into the favorites list
  const allFavorites = useMemo(() => {
    const packFavs: FavoriteItem[] = validPacks
      .filter((p) => p.isFavorite)
      .map((p) => ({ type: 'pack' as const, pack: p, sortOrder: p.favoriteSortOrder ?? 0 }));
    return [...favorites, ...packFavs].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [favorites, validPacks]);

  // Auth & Permissions
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canVoid = can('void', 'pos');
  const canRefund = can('refund', 'pos');
  const navigate = useNavigate();
  // Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [variantModalData, setVariantModalData] = useState<{ service: Service } | null>(null);
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const { isMobile } = useMediaQuery();
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Handlers
  const handleServiceClick = (service: Service) => {
    if (service.variants.length === 0) return;
    if (service.variants.length > 1) {
      setVariantModalData({ service });
    } else {
      addVariantToCart(service.variants[0], service.name);
    }
  };

  const addVariantToCart = (variant: ServiceVariant, serviceName: string) => {
    addToCart({
      id: crypto.randomUUID(),
      referenceId: variant.id,
      type: 'SERVICE',
      name: serviceName,
      variantName: variant.name,
      price: variant.price,
      originalPrice: variant.price,
      cost: variant.cost,
      quantity: 1,
    });
    setVariantModalData(null);
  };

  const handlePackClick = (pack: Pack) => {
    const items = expandPack(pack);
    items.forEach((item) => addToCart(item));
  };

  const handleProductClick = (product: Product) => {
    addToCart({
      id: crypto.randomUUID(),
      referenceId: product.id,
      type: 'PRODUCT',
      name: product.name,
      price: product.price,
      originalPrice: product.price,
      quantity: 1,
    });
  };

  const handleCompletePayment = async (payments: PaymentEntry[]) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const tx = await processTransaction(payments);
      setShowPaymentModal(false);
      setSuccessTx(tx);
    } catch {
      // Error toast is handled by the mutation's onError callback
      // Keep modal open so user can retry
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidConfirm = async (reasonCategory: string, reasonNote: string) => {
    if (!voidTarget) return;
    try {
      await doVoid(voidTarget.id, reasonCategory, reasonNote);
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
      await doRefund(refundTarget.id, items, payments, reasonCategory, reasonNote, restock);
      setRefundTarget(null);
      setDetailTransaction(null);
    } catch {
      // Error toast handled by mutation onError
    }
  };

  return (
    <div className="w-full flex flex-col gap-4" style={isMobile ? { height: '100%' } : {}}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Caisse</h1>
        <button
          onClick={() => navigate('/pos/historique')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-sm"
        >
          <History size={16} />
          Historique
        </button>
      </div>

      <div
        className={`flex w-full bg-slate-100 overflow-hidden ${isMobile ? 'flex-col flex-1 min-h-0' : 'h-[calc(100vh-10rem)] rounded-xl border border-slate-200 shadow-sm'}`}
      >
        <POSCatalog
          viewMode={viewMode}
          setViewMode={setViewMode}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          serviceCategories={serviceCategories}
          productCategories={productCategories}
          filteredItems={filteredItems}
          onServiceClick={handleServiceClick}
          onProductClick={handleProductClick}
          pendingAppointments={pendingAppointments}
          onImportAppointment={importAppointment}
          linkedAppointmentId={linkedAppointmentId}
          favorites={allFavorites}
          onAddToCart={addToCart}
          packs={validPacks}
          onPackClick={handlePackClick}
        />

        {/* Desktop: sidebar cart */}
        {!isMobile && (
          <POSCart
            cart={cart}
            clients={clients}
            selectedClient={selectedClient}
            onSelectClient={setSelectedClient}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onEditItem={setEditingItem}
            onUpdateCartItem={updateCartItem}
            allStaff={allStaff}
            services={services}
            totals={totals}
            onCheckout={() => {
              if (successTx !== null) return;
              setShowPaymentModal(true);
            }}
          />
        )}

        {/* Mobile: mini cart bar + bottom sheet */}
        {isMobile && (
          <>
            <MiniCartBar
              itemCount={cart.length}
              total={totals.total}
              onOpen={() => setIsCartOpen(true)}
            />
            <CartBottomSheet
              isOpen={isCartOpen}
              onClose={() => setIsCartOpen(false)}
              cart={cart}
              clients={clients}
              selectedClient={selectedClient}
              onSelectClient={setSelectedClient}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onEditItem={(item) => {
                setEditingItem(item);
                setIsCartOpen(false);
              }}
              onUpdateCartItem={updateCartItem}
              allStaff={allStaff}
              services={services}
              totals={totals}
              onCheckout={() => {
              if (successTx !== null) return;
              setShowPaymentModal(true);
            }}
            />
          </>
        )}

        {/* Modals (shared between mobile and desktop) */}
        {showPaymentModal && (
          <PaymentModal
            total={totals.total}
            cart={cart}
            onClose={() => setShowPaymentModal(false)}
            onComplete={handleCompletePayment}
            isProcessing={isProcessing}
          />
        )}

        {editingItem && (
          <ItemEditorModal
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={(updated) =>
              updateCartItem(updated.id, {
                price: updated.price,
                quantity: updated.quantity,
                note: updated.note,
                originalPrice: updated.originalPrice,
              })
            }
          />
        )}

        {variantModalData && (
          <ServiceVariantModal
            service={variantModalData.service}
            onClose={() => setVariantModalData(null)}
            onSelect={(variant) => addVariantToCart(variant, variantModalData.service.name)}
          />
        )}

        {receiptTransaction && (
          <ReceiptModal
            transaction={receiptTransaction}
            allTransactions={transactions}
            onClose={() => setReceiptTransaction(null)}
          />
        )}

        <TransactionSuccessModal tx={successTx} onClose={() => setSuccessTx(null)} />

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
    </div>
  );
};
