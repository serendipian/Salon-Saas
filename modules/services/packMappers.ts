import type { Pack, PackGroup, PackItem } from '../../types';

// Row shape returned by supabase query with joins
export interface PackRow {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  is_favorite: boolean;
  favorite_sort_order: number | null;
  sort_order: number;
  pack_group_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  pack_items: PackItemRow[];
}

export interface PackGroupRow {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PackItemRow {
  id: string;
  pack_id: string;
  salon_id: string;
  service_id: string;
  service_variant_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  services: { name: string } | null;
  service_variants: {
    name: string;
    price: number;
    duration_minutes: number;
    deleted_at: string | null;
  } | null;
}

export function toPackItem(row: PackItemRow): PackItem {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceVariantId: row.service_variant_id,
    serviceName: row.services?.name ?? '',
    variantName: row.service_variants?.name ?? '',
    originalPrice: row.service_variants?.price ?? 0,
    durationMinutes: row.service_variants?.duration_minutes ?? 0,
    sortOrder: row.sort_order,
    isDeleted: row.service_variants?.deleted_at != null,
  };
}

export function toPack(row: PackRow): Pack {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: row.price,
    active: row.active,
    isFavorite: row.is_favorite,
    favoriteSortOrder: row.favorite_sort_order,
    sortOrder: row.sort_order,
    groupId: row.pack_group_id,
    items: (row.pack_items ?? []).map(toPackItem).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function toPackGroup(row: PackGroupRow): PackGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    color: row.color,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
  };
}
