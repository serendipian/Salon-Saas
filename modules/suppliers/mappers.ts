import type { Supplier, SupplierCategory } from '../../types';

interface SupplierRow {
  id: string;
  salon_id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string | null;
  address: string | null;
  category_id: string | null;
  payment_terms: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface SupplierCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
    categoryId: row.category_id,
    paymentTerms: row.payment_terms ?? undefined,
    active: row.active,
    notes: row.notes ?? undefined,
  };
}

export function toSupplierInsert(data: Supplier, salonId: string) {
  return {
    id: data.id || undefined,
    salon_id: salonId,
    name: data.name,
    contact_name: data.contactName,
    email: data.email,
    phone: data.phone,
    website: data.website ?? null,
    address: data.address ?? null,
    category_id: data.categoryId ?? null,
    payment_terms: data.paymentTerms ?? null,
    active: data.active ?? true,
    notes: data.notes ?? null,
  };
}

export function toSupplierCategory(row: SupplierCategoryRow): SupplierCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order ?? undefined,
  };
}
