import { useEffect, useMemo, useRef, useState } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import type { Appointment, CartItem, Client, PaymentEntry, Transaction } from '../../../types';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useProducts } from '../../products/hooks/useProducts';
import { useServices } from '../../services/hooks/useServices';
import { useSettings } from '../../settings/hooks/useSettings';
import { useTeam } from '../../team/hooks/useTeam';
import {
  type AppointmentFilters,
  filterAppointmentGroups,
  groupAppointments,
} from '../utils/groupAndFilterAppointments';

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

  const [viewMode, setViewModeRaw] = useState<POSViewMode>('SERVICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
  const [rawStaffFilter, setRawStaffFilter] = useState<string>('ALL');
  const [rawCategoryFilter, setRawCategoryFilter] = useState<string>('ALL');
  const [appointmentStatusFilter, setAppointmentStatusFilter] =
    useState<AppointmentFilters['status']>('ALL');

  // Refs for stable access in async callbacks (avoids stale closures)
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const selectedClientRef = useRef(selectedClient);
  selectedClientRef.current = selectedClient;
  const linkedAppointmentIdRef = useRef(linkedAppointmentId);
  linkedAppointmentIdRef.current = linkedAppointmentId;

  // Default to FAVORITES every time the user enters the SERVICES tab from a
  // different tab. The guard on `viewMode !== 'SERVICES'` matters because
  // importAppointment also calls setViewMode('SERVICES') to snap back — and
  // we don't want to blow away a category the cashier just picked.
  const setViewMode = (mode: POSViewMode) => {
    if (mode === 'SERVICES' && viewMode !== 'SERVICES' && favorites.length > 0) {
      setSelectedCategory('FAVORITES');
    }
    setViewModeRaw(mode);
  };

  // Initial mount lands on SERVICES; apply the same default on first render
  // once favorites have loaded.
  const hasAppliedInitialFavorites = useRef(false);
  useEffect(() => {
    if (!hasAppliedInitialFavorites.current && favorites.length > 0 && viewMode === 'SERVICES') {
      setSelectedCategory('FAVORITES');
      hasAppliedInitialFavorites.current = true;
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

  const processTransaction = async (payments: PaymentEntry[]): Promise<Transaction> => {
    // Read from refs to avoid stale closures (realtime events can cause re-renders)
    const tx = await addTransaction(
      cartRef.current,
      payments,
      selectedClientRef.current?.id,
      linkedAppointmentIdRef.current ?? undefined,
    );
    clearCart();
    return tx;
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
        if (a.status !== 'SCHEDULED' && a.status !== 'IN_PROGRESS') return false;
        // Today only — past-day overdues are stale data, not billable work
        return a.date >= todayStart && a.date < tomorrowStart;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allAppointments]);

  const pendingAppointmentGroups = useMemo(
    () => groupAppointments(pendingAppointments),
    [pendingAppointments],
  );

  const availableAppointmentStaff = useMemo(() => {
    const ids = new Set<string>();
    for (const group of pendingAppointmentGroups) {
      for (const appt of group) ids.add(appt.staffId);
    }
    return allStaff.filter((s) => s.active && !s.deletedAt && ids.has(s.id));
  }, [pendingAppointmentGroups, allStaff]);

  const availableAppointmentCategories = useMemo(() => {
    const serviceCategoryById = new Map(services.map((s) => [s.id, s.categoryId]));
    const ids = new Set<string>();
    for (const group of pendingAppointmentGroups) {
      for (const appt of group) {
        const catId = serviceCategoryById.get(appt.serviceId);
        if (catId) ids.add(catId);
      }
    }
    return serviceCategories.filter((c) => ids.has(c.id));
  }, [pendingAppointmentGroups, services, serviceCategories]);

  // Effective values fall back to 'ALL' when the raw selection no longer
  // appears in the available options. This keeps render coherent in the same
  // frame when, e.g., a category is deleted while active.
  const appointmentStaffFilter =
    rawStaffFilter === 'ALL' ||
    availableAppointmentStaff.some((s) => s.id === rawStaffFilter)
      ? rawStaffFilter
      : 'ALL';

  const appointmentCategoryFilter =
    rawCategoryFilter === 'ALL' ||
    availableAppointmentCategories.some((c) => c.id === rawCategoryFilter)
      ? rawCategoryFilter
      : 'ALL';

  const filteredPendingAppointmentGroups = useMemo(
    () =>
      filterAppointmentGroups(
        pendingAppointmentGroups,
        {
          staffId: appointmentStaffFilter,
          categoryId: appointmentCategoryFilter,
          status: appointmentStatusFilter,
        },
        services,
      ),
    [
      pendingAppointmentGroups,
      appointmentStaffFilter,
      appointmentCategoryFilter,
      appointmentStatusFilter,
      services,
    ],
  );

  // State hygiene: keep raw state in sync with effective on next tick, so
  // subsequent interactions start from a clean slate.
  useEffect(() => {
    if (
      rawStaffFilter !== 'ALL' &&
      !availableAppointmentStaff.some((s) => s.id === rawStaffFilter)
    ) {
      setRawStaffFilter('ALL');
    }
  }, [availableAppointmentStaff, rawStaffFilter]);

  useEffect(() => {
    if (
      rawCategoryFilter !== 'ALL' &&
      !availableAppointmentCategories.some((c) => c.id === rawCategoryFilter)
    ) {
      setRawCategoryFilter('ALL');
    }
  }, [availableAppointmentCategories, rawCategoryFilter]);

  const setAppointmentStaffFilter = setRawStaffFilter;
  const setAppointmentCategoryFilter = setRawCategoryFilter;

  const resetAppointmentFilters = () => {
    setRawStaffFilter('ALL');
    setRawCategoryFilter('ALL');
    setAppointmentStatusFilter('ALL');
  };

  // --- Import Appointment ---

  const importAppointment = (appointment: Appointment) => {
    // Billable-active = SCHEDULED or IN_PROGRESS. Matches both the pending pool
    // filter above and the create_transaction RPC's validation. CANCELLED /
    // COMPLETED / NO_SHOW siblings must not enter the cart.
    const groupAppointments = appointment.groupId
      ? allAppointments.filter(
          (a) =>
            a.groupId === appointment.groupId &&
            (a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS'),
        )
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
    pendingAppointmentGroups,
    filteredPendingAppointmentGroups,
    availableAppointmentStaff,
    availableAppointmentCategories,
    appointmentStaffFilter,
    appointmentCategoryFilter,
    appointmentStatusFilter,
    setAppointmentStaffFilter,
    setAppointmentCategoryFilter,
    setAppointmentStatusFilter,
    resetAppointmentFilters,
    linkedAppointmentId,

    // Actions
    addToCart,
    updateCartItem,
    updateQuantity,
    removeFromCart,
    clearCart,
    processTransaction,
    importAppointment,
    voidTransaction,
    refundTransaction,
    isVoiding,
    isRefunding,
  };
};
