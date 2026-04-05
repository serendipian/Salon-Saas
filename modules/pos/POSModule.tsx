
import React, { useState } from 'react';
import { usePOS } from './hooks/usePOS';
import { POSCatalog } from './components/POSCatalog';
import { POSCart } from './components/POSCart';
import { PaymentModal } from './components/PaymentModal';
import { ItemEditorModal, ServiceVariantModal, ReceiptModal } from './components/POSModals';
import { Service, Product, ServiceVariant, Transaction, CartItem, PaymentEntry } from '../../types';
import { useMediaQuery } from '../../context/MediaQueryContext';
import { MiniCartBar } from './components/MiniCartBar';
import { CartBottomSheet } from './components/CartBottomSheet';

export const POSModule: React.FC = () => {
  const {
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory,
    selectedClient, setSelectedClient,
    cart,
    services, serviceCategories,
    products, productCategories,
    transactions,
    clients, allStaff,
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
  } = usePOS();

  // Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [variantModalData, setVariantModalData] = useState<{service: Service} | null>(null);
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
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
      quantity: 1
    });
    setVariantModalData(null);
  };

  const handleProductClick = (product: Product) => {
    addToCart({
      id: crypto.randomUUID(),
      referenceId: product.id,
      type: 'PRODUCT',
      name: product.name,
      price: product.price,
      originalPrice: product.price,
      quantity: 1
    });
  };

  const handleCompletePayment = async (payments: PaymentEntry[]) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await processTransaction(payments);
      setShowPaymentModal(false);
    } catch {
      // Error toast is handled by the mutation's onError callback
      // Keep modal open so user can retry
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`flex w-full bg-slate-100 overflow-hidden ${isMobile ? 'flex-col h-full' : 'h-[calc(100vh-6rem)] rounded-xl border border-slate-200 shadow-sm'}`}>

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
        transactions={transactions}
        onServiceClick={handleServiceClick}
        onProductClick={handleProductClick}
        onReceiptClick={setReceiptTransaction}
        pendingAppointments={pendingAppointments}
        onImportAppointment={importAppointment}
        linkedAppointmentId={linkedAppointmentId}
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
          totals={totals}
          onCheckout={() => setShowPaymentModal(true)}
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
            onEditItem={(item) => { setEditingItem(item); setIsCartOpen(false); }}
            onUpdateCartItem={updateCartItem}
            allStaff={allStaff}
            totals={totals}
            onCheckout={() => setShowPaymentModal(true)}
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
          onSave={(updated) => updateCartItem(updated.id, {
            price: updated.price,
            quantity: updated.quantity,
            note: updated.note,
            originalPrice: updated.originalPrice,
          })}
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
          onClose={() => setReceiptTransaction(null)}
        />
      )}
    </div>
  );
};
