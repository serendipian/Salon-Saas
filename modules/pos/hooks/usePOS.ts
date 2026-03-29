
import { useState, useMemo } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import { useProducts } from '../../products/hooks/useProducts';
import { useServices } from '../../services/hooks/useServices';
import { useClients } from '../../clients/hooks/useClients';
import { useSettings } from '../../settings/hooks/useSettings';
import { useTeam } from '../../team/hooks/useTeam';
import { CartItem, Client, Service, Product, ServiceVariant, PaymentEntry } from '../../../types';

export type POSViewMode = 'SERVICES' | 'PRODUCTS' | 'HISTORY';

export const usePOS = () => {
  const { transactions, addTransaction } = useTransactions();
  const { salonSettings } = useSettings();

  const { allClients: clients } = useClients();

  const { allServices: services, serviceCategories } = useServices();
  const { products, productCategories } = useProducts();
  const { allStaff } = useTeam();

  const [viewMode, setViewMode] = useState<POSViewMode>('SERVICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

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
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += 1;
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
  };

  // --- Transaction Processing ---

  const processTransaction = async (payments: PaymentEntry[]) => {
    await addTransaction(cart, payments, selectedClient?.id);
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

    // Actions
    addToCart,
    updateCartItem,
    updateQuantity,
    removeFromCart,
    processTransaction
  };
};