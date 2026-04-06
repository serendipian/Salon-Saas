import type { Product, ProductCategory, Brand, UsageType } from '../../types';

interface ProductRow {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  usage_type: string;
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
  brands?: { name: string } | null;
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

interface BrandRow {
  id: string;
  salon_id: string;
  name: string;
  supplier_id: string | null;
  color: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  suppliers?: { name: string } | null;
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    categoryId: row.category_id ?? '',
    brandId: row.brand_id ?? undefined,
    brand: row.brands?.name ?? undefined,
    usageType: (row.usage_type as UsageType) ?? 'retail',
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
    brand_id: data.brandId || null,
    usage_type: data.usageType || 'retail',
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

export function toBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    supplierId: row.supplier_id ?? undefined,
    supplierName: row.suppliers?.name ?? undefined,
    color: row.color,
    sortOrder: row.sort_order ?? undefined,
  };
}
