// modules/accounting/hooks/useRevenueBreakdown.ts
//
// Revenue-by-X breakdowns extracted out of useAccounting (audit M-9).
//
// Why a separate hook? useAccounting was previously calling useServices,
// useProducts, and useTeam unconditionally inside FinancesLayout, so every
// finances sub-page (Dépenses, Journal, Annulations) paid the cost of the
// service/product/team queries even though only the Vue d'ensemble and
// Revenus tabs actually consume them. Moving those reads here means only
// the two pages that need them mount the heavy queries.
//
// Inputs are the already-filtered current/previous transactions from
// useAccounting via useOutletContext, so this hook does not duplicate the
// transaction query.

import { useMemo } from 'react';
import type { CartItem, Transaction } from '../../../types';
import { useServices } from '../../services/hooks/useServices';
import { useProducts } from '../../products/hooks/useProducts';
import { useTeam } from '../../team/hooks/useTeam';
import { calcBonus, calcCommission } from '../../team/utils';

const UNASSIGNED_KEY = '__unassigned__';

interface ServiceCategoryEntry {
  categoryId: string;
  categoryName: string;
  count: number;
  revenue: number;
  services: { name: string; variantName?: string; count: number; revenue: number }[];
}

interface ProductCategoryEntry {
  categoryId: string;
  categoryName: string;
  count: number;
  revenue: number;
  products: { name: string; count: number; revenue: number }[];
}

interface StaffServiceRow {
  staffId: string | null;
  staffName: string;
  count: number;
  revenue: number;
  avgBasket: number;
  percent: number;
  commission: number;
  bonus: number;
  services: { name: string; variantName?: string; count: number; revenue: number }[];
}

interface StaffProductRow {
  staffId: string | null;
  staffName: string;
  count: number;
  revenue: number;
  percent: number;
}

interface RevenueTotals {
  total: number;
  count: number;
  avgPrice: number;
}

interface PaymentMethodRow {
  method: string;
  amount: number;
  percent: number;
}

interface TopProductRow {
  name: string;
  count: number;
  revenue: number;
}

export interface RevenueBreakdownResult {
  revenueByServiceCategory: ServiceCategoryEntry[];
  revenueByProductCategory: ProductCategoryEntry[];
  revenueByStaffServices: StaffServiceRow[];
  revenueByStaffProducts: StaffProductRow[];
  serviceRevenue: RevenueTotals;
  productRevenue: RevenueTotals;
  prevServiceRevenue: RevenueTotals;
  prevProductRevenue: RevenueTotals;
  paymentMethodBreakdown: PaymentMethodRow[];
  topProducts: TopProductRow[];
}

const computeRevenue = (transactions: Transaction[], type: CartItem['type']): RevenueTotals => {
  let total = 0;
  let count = 0;
  transactions.forEach((t) => {
    t.items.forEach((item) => {
      if (item.type !== type) return;
      total += item.price * (item.quantity || 1);
      count += item.quantity || 1;
    });
  });
  return { total, count, avgPrice: count > 0 ? total / count : 0 };
};

export function useRevenueBreakdown(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
): RevenueBreakdownResult {
  const { allServices, serviceCategories } = useServices();
  const { allProducts, productCategories } = useProducts();
  const { allStaff } = useTeam();

  // --- Lookup maps ---
  const serviceCategoryLookup = useMemo(() => {
    const catNameMap = new Map<string, string>();
    (serviceCategories || []).forEach((cat) => catNameMap.set(cat.id, cat.name));
    const lookup = new Map<string, { categoryId: string; categoryName: string }>();
    (allServices || []).forEach((svc) => {
      const entry = {
        categoryId: svc.categoryId || 'uncategorized',
        categoryName: catNameMap.get(svc.categoryId) || 'Non catégorisé',
      };
      lookup.set(svc.id, entry);
      // POS stores variant ID as referenceId, so map each variant ID too
      (svc.variants || []).forEach((v) => lookup.set(v.id, entry));
    });
    return lookup;
  }, [allServices, serviceCategories]);

  const productCategoryLookup = useMemo(() => {
    const catNameMap = new Map<string, string>();
    (productCategories || []).forEach((cat) => catNameMap.set(cat.id, cat.name));
    const lookup = new Map<string, { categoryId: string; categoryName: string }>();
    (allProducts || []).forEach((prod) => {
      lookup.set(prod.id, {
        categoryId: prod.categoryId || 'uncategorized',
        categoryName: catNameMap.get(prod.categoryId) || 'Non catégorisé',
      });
    });
    return lookup;
  }, [allProducts, productCategories]);

  const revenueByServiceCategory = useMemo<ServiceCategoryEntry[]>(() => {
    const map = new Map<string, {
      categoryId: string;
      categoryName: string;
      count: number;
      revenue: number;
      services: Map<string, { name: string; variantName?: string; count: number; revenue: number }>;
    }>();

    currentTransactions.forEach((t) => {
      t.items.forEach((item) => {
        if (item.type !== 'SERVICE') return;
        const lookup = serviceCategoryLookup.get(item.referenceId);
        const catId = lookup?.categoryId || 'uncategorized';
        const catName = lookup?.categoryName || 'Non catégorisé';
        if (!map.has(catId)) {
          map.set(catId, { categoryId: catId, categoryName: catName, count: 0, revenue: 0, services: new Map() });
        }
        const cat = map.get(catId)!;
        cat.count += item.quantity || 1;
        cat.revenue += item.price * (item.quantity || 1);

        const serviceKey = item.referenceId || item.name;
        if (!cat.services.has(serviceKey)) {
          cat.services.set(serviceKey, { name: item.name, variantName: item.variantName, count: 0, revenue: 0 });
        }
        const svc = cat.services.get(serviceKey)!;
        svc.count += item.quantity || 1;
        svc.revenue += item.price * (item.quantity || 1);
      });
    });

    return Array.from(map.values())
      .map((cat) => ({
        ...cat,
        services: Array.from(cat.services.values()).sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [currentTransactions, serviceCategoryLookup]);

  const revenueByProductCategory = useMemo<ProductCategoryEntry[]>(() => {
    const map = new Map<string, {
      categoryId: string;
      categoryName: string;
      count: number;
      revenue: number;
      products: Map<string, { name: string; count: number; revenue: number }>;
    }>();

    currentTransactions.forEach((t) => {
      t.items.forEach((item) => {
        if (item.type !== 'PRODUCT') return;
        const lookup = productCategoryLookup.get(item.referenceId);
        const catId = lookup?.categoryId || 'uncategorized';
        const catName = lookup?.categoryName || 'Non catégorisé';
        if (!map.has(catId)) {
          map.set(catId, { categoryId: catId, categoryName: catName, count: 0, revenue: 0, products: new Map() });
        }
        const cat = map.get(catId)!;
        cat.count += item.quantity || 1;
        cat.revenue += item.price * (item.quantity || 1);

        const prodKey = item.referenceId || item.name;
        if (!cat.products.has(prodKey)) {
          cat.products.set(prodKey, { name: item.name, count: 0, revenue: 0 });
        }
        const prod = cat.products.get(prodKey)!;
        prod.count += item.quantity || 1;
        prod.revenue += item.price * (item.quantity || 1);
      });
    });

    return Array.from(map.values())
      .map((cat) => ({
        ...cat,
        products: Array.from(cat.products.values()).sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [currentTransactions, productCategoryLookup]);

  const revenueByStaffServices = useMemo<StaffServiceRow[]>(() => {
    const map = new Map<string, {
      staffId: string | null;
      staffName: string;
      count: number;
      revenue: number;
      services: Map<string, { name: string; variantName?: string; count: number; revenue: number }>;
    }>();

    currentTransactions.forEach((t) => {
      t.items.forEach((item) => {
        if (item.type !== 'SERVICE') return;
        const key = item.staffId || UNASSIGNED_KEY;
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) {
          map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0, services: new Map() });
        }
        const row = map.get(key)!;
        const qty = item.quantity || 1;
        row.count += qty;
        row.revenue += item.price * qty;

        const svcKey = item.referenceId || item.name;
        if (!row.services.has(svcKey)) {
          row.services.set(svcKey, { name: item.name, variantName: item.variantName, count: 0, revenue: 0 });
        }
        const svc = row.services.get(svcKey)!;
        svc.count += qty;
        svc.revenue += item.price * qty;
      });
    });

    const staffMap = new Map(allStaff.map((s) => [s.id, s]));
    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

    return rows.map((r) => {
      const staff = r.staffId ? staffMap.get(r.staffId) : undefined;
      const commission = staff ? calcCommission(r.revenue, staff.commissionRate) : 0;
      const bonus = staff ? calcBonus(r.revenue, staff.bonusTiers) : 0;
      return {
        staffId: r.staffId,
        staffName: r.staffName,
        count: r.count,
        revenue: r.revenue,
        avgBasket: r.count > 0 ? r.revenue / r.count : 0,
        percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
        commission,
        bonus,
        services: Array.from(r.services.values()).sort((a, b) => b.revenue - a.revenue),
      };
    });
  }, [currentTransactions, allStaff]);

  const revenueByStaffProducts = useMemo<StaffProductRow[]>(() => {
    const map = new Map<string, { staffId: string | null; staffName: string; count: number; revenue: number }>();
    currentTransactions.forEach((t) => {
      t.items.forEach((item) => {
        if (item.type !== 'PRODUCT') return;
        const key = item.staffId || UNASSIGNED_KEY;
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) {
          map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0 });
        }
        const row = map.get(key)!;
        row.count += item.quantity || 1;
        row.revenue += item.price * (item.quantity || 1);
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map((r) => ({
      ...r,
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [currentTransactions]);

  const serviceRevenue = useMemo(() => computeRevenue(currentTransactions, 'SERVICE'), [currentTransactions]);
  const productRevenue = useMemo(() => computeRevenue(currentTransactions, 'PRODUCT'), [currentTransactions]);
  const prevServiceRevenue = useMemo(() => computeRevenue(previousTransactions, 'SERVICE'), [previousTransactions]);
  const prevProductRevenue = useMemo(() => computeRevenue(previousTransactions, 'PRODUCT'), [previousTransactions]);

  const paymentMethodBreakdown = useMemo<PaymentMethodRow[]>(() => {
    const map = new Map<string, number>();
    currentTransactions.forEach((t) => {
      (t.payments || []).forEach((p) => {
        map.set(p.method, (map.get(p.method) || 0) + p.amount);
      });
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([method, amount]) => ({ method, amount, percent: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [currentTransactions]);

  const topProducts = useMemo<TopProductRow[]>(() => {
    const productSales: Record<string, TopProductRow> = {};
    currentTransactions.forEach((t) => {
      t.items.forEach((i) => {
        if (i.type !== 'PRODUCT') return;
        const key = i.referenceId || i.name;
        if (!productSales[key]) productSales[key] = { name: i.name, count: 0, revenue: 0 };
        productSales[key].count += i.quantity || 1;
        productSales[key].revenue += i.price * (i.quantity || 1);
      });
    });
    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [currentTransactions]);

  return {
    revenueByServiceCategory,
    revenueByProductCategory,
    revenueByStaffServices,
    revenueByStaffProducts,
    serviceRevenue,
    productRevenue,
    prevServiceRevenue,
    prevProductRevenue,
    paymentMethodBreakdown,
    topProducts,
  };
}
