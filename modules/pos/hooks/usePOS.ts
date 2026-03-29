
import { useState, useMemo } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import { useProducts } from '../../products/hooks/useProducts';
import { useServices } from '../../services/hooks/useServices';
import { useClients } from '../../clients/hooks/useClients';
import { useSettings } from '../../settings/hooks/useSettings';
import { useTeam } from '../../team/hooks/useTeam';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { CartItem, Client, Service, Product, ServiceVariant, PaymentEntry, Appointment } from '../../../types';

export type POSViewMode = 'SERVICES' | 'PRODUCTS' | 'HISTORY' | 'APPOINTMENTS';

export const usePOS = () => {
  const { transactions, addTransaction } = useTransactions();
  const { salonSettings } = useSettings();

  const { allClients: clients } = useClients();

  const { allServices: services, serviceCategories } = useServices();
  const { products, productCategories } = useProducts();
  const { allStaff } = useTeam();
  const { allAppointments } = useAppointments();

  const [viewMode, setViewMode] = useState<POSViewMode>('SERVICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);

  // --- Cart Actions ---

  const addToCart = (item: CartItem) => {
    const itemWithMeta = {
        ...item,
        originalPrice: item.price // Store reference for discounts
    };

    const existingItemIndex = cart.findIndex(
      i => i.referenceId === item.referenceId && i.variantName === item.variantName && i.staffId === item.staffId
    );

    if (existingItemIndex >= 0) {
      const newCart = cart.map((item, i) =>
        i === existingItemIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
      setCart(newCart);
    } else {
      setCart([...cart, itemWithMeta]);
    }
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCart(cart.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedClient(null);
    setLinkedAppointmentId(null);
  };

  // --- Transaction Processing ---

  const processTransaction = async (payments: PaymentEntry[]) => {
    await addTransaction(cart, payments, selectedClient?.id, linkedAppointmentId ?? undefined);
    clearCart();
    setViewMode('HISTORY');
  };

  // --- Filtering & Derived State ---

  const filteredItems = useMemo(() => {
    if (viewMode === 'SERVICES') {
      return services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || s.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    } else if (viewMode === 'PRODUCTS') {
      return products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    }
    return [];
  }, [viewMode, searchTerm, selectedCategory, services, products]);

  const pendingAppointments = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    return allAppointments
      .filter(a => {
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
      ? allAppointments.filter(a => a.groupId === appointment.groupId && a.status === 'SCHEDULED')
      : [appointment];

    // Clear current cart and set client
    setCart([]);
    const client = clients.find(c => c.id === appointment.clientId);
    setSelectedClient(client ?? null);
    setLinkedAppointmentId(appointment.id);

    // Convert each appointment in the group to a cart item
    const cartItems: CartItem[] = groupAppointments.map(appt => ({
      id: crypto.randomUUID(),
      referenceId: appt.serviceId,
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
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = (salonSettings.vatRate || 20) / 100;
    const tax = subtotal * taxRate / (1 + taxRate);
    return { subtotal, tax, total: subtotal, vatRate: salonSettings.vatRate || 20 };
  }, [cart, salonSettings.vatRate]);

  return {
    // State
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory,
    selectedClient, setSelectedClient,
    cart,

    // Data
    services, serviceCategories,
    products, productCategories,
    clients, allStaff,
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
  };
};
