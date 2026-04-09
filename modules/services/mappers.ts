import type { Service, ServiceVariant, ServiceCategory } from '../../types';

interface ServiceVariantRow {
  id: string;
  service_id: string;
  salon_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  cost: number;
  additional_cost: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_favorite: boolean;
  favorite_sort_order: number;
}

interface ServiceRow {
  id: string;
  salon_id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  is_favorite: boolean;
  favorite_sort_order: number;
  service_variants?: ServiceVariantRow[];
}

interface ServiceCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toServiceVariant(row: ServiceVariantRow): ServiceVariant {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    price: row.price,
    cost: row.cost,
    additionalCost: row.additional_cost,
    isFavorite: row.is_favorite,
    favoriteSortOrder: row.favorite_sort_order,
  };
}

export function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id ?? '',
    description: row.description ?? '',
    variants: (row.service_variants ?? [])
      .filter(v => !v.deleted_at)
      .map(toServiceVariant),
    active: row.active,
    isFavorite: row.is_favorite,
    favoriteSortOrder: row.favorite_sort_order,
  };
}

export function toServiceInsert(data: Service, salonId: string) {
  return {
    salon_id: salonId,
    name: data.name,
    category_id: data.categoryId || null,
    description: data.description || null,
    active: data.active ?? true,
  };
}

export function toVariantInsert(variant: ServiceVariant, serviceId: string, salonId: string, sortOrder: number) {
  return {
    service_id: serviceId,
    salon_id: salonId,
    name: variant.name,
    duration_minutes: variant.durationMinutes,
    price: variant.price,
    cost: variant.cost,
    additional_cost: variant.additionalCost,
    sort_order: sortOrder,
  };
}

export function toServiceCategory(row: ServiceCategoryRow): ServiceCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon ?? undefined,
    sortOrder: row.sort_order ?? undefined,
  };
}

export function toServiceCategoryInsert(cat: ServiceCategory, salonId: string) {
  return {
    id: cat.id || undefined,
    salon_id: salonId,
    name: cat.name,
    color: cat.color,
    icon: cat.icon ?? null,
    sort_order: cat.sortOrder ?? null,
  };
}
