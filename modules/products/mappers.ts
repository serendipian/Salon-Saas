import type { Product, ProductCategory } from '../../types';

interface ProductRow {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  sku: string | null;
  barcode: string | null;
  stock: number;
  supplier_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  suppliers?: { name: string } | null;
}

interface ProductCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    categoryId: row.category_id ?? '',
    price: row.price,
    cost: row.cost,
    sku: row.sku ?? '',
    barcode: row.barcode ?? undefined,
    stock: row.stock,
    supplierId: row.supplier_id ?? undefined,
    supplier: row.suppliers?.name ?? undefined,
    active: row.active,
  };
}

export function toProductInsert(data: Product, salonId: string, supplierId?: string | null) {
  return {
    salon_id: salonId,
    name: data.name,
    description: data.description || null,
    category_id: data.categoryId || null,
    price: data.price ?? 0,
    cost: data.cost ?? 0,
    sku: data.sku || null,
    barcode: data.barcode || null,
    stock: data.stock ?? 0,
    supplier_id: supplierId !== undefined ? supplierId : (data.supplierId ?? null),
    active: data.active ?? true,
  };
}

export function toProductCategory(row: ProductCategoryRow): ProductCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order ?? undefined,
  };
}

export function toProductCategoryInsert(cat: ProductCategory, salonId: string) {
  return {
    id: cat.id || undefined,
    salon_id: salonId,
    name: cat.name,
    color: cat.color,
    sort_order: cat.sortOrder ?? null,
  };
}
