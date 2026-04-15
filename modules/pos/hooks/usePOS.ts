import { useEffect, useMemo, useRef, useState } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import type {
  Appointment,
  CartItem,
  Client,
  PaymentEntry,
} from '../../../types';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useProducts } from '../../products/hooks/useProducts';
import { useServices } from '../../services/hooks/useServices';
import { useSettings } from '../../settings/hooks/useSettings';
import { useTeam } from '../../team/hooks/useTeam';

export type POSViewMode = 'SERVICES' | 'PRODUCTS' | 'APPOINTMENTS';

export const usePOS = () => {
  const posRange = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const {
    transactions,
    addTransaction,
    voidTransaction,
    refundTransaction,
    isVoiding,
    isRefunding,
  } = useTransactions(posRange);
  const { salonSettings } = useSettings();

  const { allClients: clients } = useClients();

  const { allServices: services, serviceCategories, favorites } = useServices();
  const { products, productCategories } = useProducts();
  const { allStaff } = useTeam();
  const { allAppointments } = useAppointments();

  const [viewMode, setViewMode] = useState<POSViewMode>('SERVICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);

  // Refs for stable access in async callbacks (avoids stale closures)
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const selectedClientRef = useRef(selectedClient);
  selectedClientRef.current = selectedClient;
  const linkedAppointmentIdRef = useRef(linkedAppointmentId);
  linkedAppointmentIdRef.current = linkedAppointmentId;

  // Default to FAVORITES filter when favorites exist and on SERVICES view
  const hasDefaultedToFavorites = useRef(false);
  useEffect(() => {
    if (!hasDefaultedToFavorites.current && favorites.length > 0 && viewMode === 'SERVICES') {
      setSelectedCategory('FAVORITES');
      hasDefaultedToFavorites.current = true;
    }
  }, [favorites, viewMode]);

  // --- Cart Actions ---

  const addToCart = (item: CartItem) => {
    const itemWithMeta = {
      ...item,
      originalPrice: item.originalPrice ?? item.price, // Store reference for discounts
    };

    setCart((prev) => {
      // Pack items always append (never merge) to preserve pro-rata pricing
      if (item.packId) {
        return [...prev, itemWithMeta];
      }

      const existingItemIndex = prev.findIndex(
        (i) =>
          i.referenceId === item.referenceId && i.variantName === item.variantName && !i.packId,
      );

      if (existingItemIndex >= 0) {
        return prev.map((existing, i) =>
          i === existingItemIndex ? { ...existing, quantity: existing.quantity + 1 } : existing,
        );
      }
      return [...prev, itemWithMeta];
    });
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedClient(null);
    setLinkedAppointmentId(null);
  };

  // --- Transaction Processing ---

  const processTransaction = async (payments: PaymentEntry[]) => {
    // Read from refs to avoid stale closures (realtime events can cause re-renders)
    await addTransaction(
      cartRef.current,
      payments,
      selectedClientRef.current?.id,
      linkedAppointmentIdRef.current ?? undefined,
    );
    clearCart();
  };

  // --- Filtering & Derived State ---

  const filteredItems = useMemo(() => {
    if (viewMode === 'SERVICES') {
      if (selectedCategory === 'FAVORITES') {
        // POSCatalog renders favorites directly from the favorites list (unified sort order)
        return [];
      }
      return services.filter((s) => {
        if (!s.active || s.variants.length === 0) return false;
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || s.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    } else if (viewMode === 'PRODUCTS') {
      return products.filter((p) => {
        if (p.usageType === 'internal') return false;
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    }
    return [];
  }, [viewMode, searchTerm, selectedCategory, services, products]);

  const pendingAppointments = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).toISOString();

    return allAppointments
      .filter((a) => {
        if (a.status !== 'SCHEDULED') return false;
        // Today's appointments OR overdue from previous days
        return a.date < tomorrowStart;
      })
      .sort((a, b) => {
        const aIsOverdue = a.date < todayStart;
        const bIsOverdue = b.date < todayStart;
        // Overdue first, then by scheduled time
        if (aIsOverdue && !bIsOverdue) return -1;
        if (!aIsOverdue && bIsOverdue) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [allAppointments]);

  // --- Import Appointment ---

  const importAppointment = (appointment: Appointment) => {
    // Find all appointments in the same group (or just this one if no group)
    const groupAppointments = appointment.groupId
      ? allAppointments.filter((a) => a.groupId === appointment.groupId && a.status === 'SCHEDULED')
      : [appointment];

    // Clear current cart and set client
    setCart([]);
    const client = clients.find((c) => c.id === appointment.clientId);
    setSelectedClient(client ?? null);
    setLinkedAppointmentId(appointment.id);

    // Convert each appointment in the group to a cart item
    const cartItems: CartItem[] = groupAppointments.map((appt) => ({
      id: crypto.randomUUID(),
      referenceId: appt.variantId || appt.serviceId,
      type: 'SERVICE' as const,
      name: appt.serviceName,
      variantName: appt.variantName || undefined,
      price: appt.price,
      originalPrice: appt.price,
      quantity: 1,
      staffId: appt.staffId || undefined,
      staffName: appt.staffName || undefined,
    }));

    setCart(cartItems);
    setViewMode('SERVICES');
  };

  const totals = useMemo(() => {
    const subtotal =
      Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    const taxRate = (salonSettings.vatRate || 20) / 100;
    const tax = (subtotal * taxRate) / (1 + taxRate);
    return { subtotal, tax, total: subtotal, vatRate: salonSettings.vatRate || 20 };
  }, [cart, salonSettings.vatRate]);

  return {
    // State
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedClient,
    setSelectedClient,
    cart,

    // Data
    services,
    serviceCategories,
    favorites,
    products,
    productCategories,
    clients,
    allStaff,
    transactions,
    filteredItems,
    totals,
    pendingAppointments,
    linkedAppointmentId,

    // Actions
    addToCart,
    updateCartItem,
    updateQuantity,
    removeFromCart,
    processTransaction,
    importAppointment,
    voidTransaction,
    refundTransaction,
    isVoiding,
    isRefunding,
  };
};
