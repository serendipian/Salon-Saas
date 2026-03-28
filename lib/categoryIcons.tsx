import React from 'react';
import { Icon as IconifyIcon } from '@iconify/react';
import type { IconifyIcon as IconifyIconData } from '@iconify/types';
import {
  Scissors,
  Sparkles,
  Droplets,
  Zap,
  Heart,
  Sun,
  Eye,
  Flower2,
  Layers,
  SprayCan,
  Crown,
  Gem,
  Feather,
  Shell,
  Ribbon,
  Star,
  Palette,
  Flame,
  Wind,
  Bath,
  ShowerHead,
  WandSparkles,
  HandHeart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Offline-bundled @iconify icons (Icon Park Outline for beauty, Phosphor for extras)
import combIcon from '@iconify-icons/icon-park-outline/comb';
import nailPolishIcon from '@iconify-icons/icon-park-outline/nail-polish';
import hairDryerIcon from '@iconify-icons/icon-park-outline/hair-dryer';
import lipstickIcon from '@iconify-icons/icon-park-outline/lipstick';
import mascaraIcon from '@iconify-icons/icon-park-outline/mascara';
import perfumeIcon from '@iconify-icons/icon-park-outline/perfume';
import cosmeticBrushIcon from '@iconify-icons/icon-park-outline/cosmetic-brush';
import facialCleanserIcon from '@iconify-icons/icon-park-outline/facial-cleanser';
import eyebrowIcon from '@iconify-icons/icon-park-outline/eyebrow';
import lotionIcon from '@iconify-icons/icon-park-outline/lotion';
import mirrorIcon from '@iconify-icons/icon-park-outline/mirror';
import handCreamIcon from '@iconify-icons/icon-park-outline/hand-cream';
import towelIcon from '@iconify-icons/icon-park-outline/towel';
import faceMaskIcon from '@iconify-icons/ph/face-mask';
import spaIcon from '@iconify-icons/mdi/spa';

// ── Icon registry ──────────────────────────────────────────────
// Each entry is either a Lucide component or an @iconify data object.

type IconEntry =
  | { type: 'lucide'; component: LucideIcon }
  | { type: 'iconify'; data: IconifyIconData };

const ICON_REGISTRY: Record<string, IconEntry> = {
  // Beauty-specific (@iconify — Icon Park Outline / Phosphor / MDI)
  Comb:           { type: 'iconify', data: combIcon },
  NailPolish:     { type: 'iconify', data: nailPolishIcon },
  HairDryer:      { type: 'iconify', data: hairDryerIcon },
  Lipstick:       { type: 'iconify', data: lipstickIcon },
  Mascara:        { type: 'iconify', data: mascaraIcon },
  Perfume:        { type: 'iconify', data: perfumeIcon },
  CosmeticBrush:  { type: 'iconify', data: cosmeticBrushIcon },
  FacialCleanser: { type: 'iconify', data: facialCleanserIcon },
  Eyebrow:        { type: 'iconify', data: eyebrowIcon },
  Lotion:         { type: 'iconify', data: lotionIcon },
  Mirror:         { type: 'iconify', data: mirrorIcon },
  HandCream:      { type: 'iconify', data: handCreamIcon },
  Towel:          { type: 'iconify', data: towelIcon },
  FaceMask:       { type: 'iconify', data: faceMaskIcon },
  Spa:            { type: 'iconify', data: spaIcon },
  // General (Lucide)
  Scissors:       { type: 'lucide', component: Scissors },
  Sparkles:       { type: 'lucide', component: Sparkles },
  Droplets:       { type: 'lucide', component: Droplets },
  Zap:            { type: 'lucide', component: Zap },
  Heart:          { type: 'lucide', component: Heart },
  Sun:            { type: 'lucide', component: Sun },
  Eye:            { type: 'lucide', component: Eye },
  Flower2:        { type: 'lucide', component: Flower2 },
  Layers:         { type: 'lucide', component: Layers },
  SprayCan:       { type: 'lucide', component: SprayCan },
  Crown:          { type: 'lucide', component: Crown },
  Gem:            { type: 'lucide', component: Gem },
  Feather:        { type: 'lucide', component: Feather },
  Shell:          { type: 'lucide', component: Shell },
  Ribbon:         { type: 'lucide', component: Ribbon },
  Star:           { type: 'lucide', component: Star },
  Palette:        { type: 'lucide', component: Palette },
  Flame:          { type: 'lucide', component: Flame },
  Wind:           { type: 'lucide', component: Wind },
  Bath:           { type: 'lucide', component: Bath },
  ShowerHead:     { type: 'lucide', component: ShowerHead },
  WandSparkles:   { type: 'lucide', component: WandSparkles },
  HandHeart:      { type: 'lucide', component: HandHeart },
};

// ── Render helper ──────────────────────────────────────────────

function renderIcon(entry: IconEntry, size: number, className?: string) {
  if (entry.type === 'lucide') {
    const LucideComp = entry.component;
    return <LucideComp size={size} className={className} />;
  }
  return <IconifyIcon icon={entry.data} width={size} height={size} className={className} />;
}

// ── Curated picker list ────────────────────────────────────────

/** Curated list for the picker, in a meaningful order for a beauty salon. */
export const ICON_PICKER_LIST: Array<{ name: string; label: string }> = [
  // Hair & styling
  { name: 'Comb', label: 'Cheveux' },
  { name: 'Scissors', label: 'Coupe' },
  { name: 'HairDryer', label: 'Brushing' },
  { name: 'Droplets', label: 'Coloration' },
  { name: 'SprayCan', label: 'Laque' },
  // Nails
  { name: 'NailPolish', label: 'Ongles' },
  { name: 'Gem', label: 'Manucure' },
  // Face & skin
  { name: 'FacialCleanser', label: 'Soins visage' },
  { name: 'FaceMask', label: 'Masque' },
  { name: 'CosmeticBrush', label: 'Maquillage' },
  { name: 'Lipstick', label: 'Lèvres' },
  { name: 'Mascara', label: 'Regard' },
  { name: 'Eyebrow', label: 'Sourcils' },
  { name: 'Palette', label: 'Palette' },
  // Body & wellness
  { name: 'Zap', label: 'Épilation' },
  { name: 'Heart', label: 'Massage' },
  { name: 'Spa', label: 'Spa' },
  { name: 'HandCream', label: 'Bien-être' },
  { name: 'Bath', label: 'Hammam' },
  { name: 'Towel', label: 'Serviette' },
  { name: 'Lotion', label: 'Corps' },
  // Products & fragrance
  { name: 'Perfume', label: 'Parfum' },
  { name: 'Mirror', label: 'Miroir' },
  // General
  { name: 'Sun', label: 'Bronzage' },
  { name: 'Flame', label: 'Énergie' },
  { name: 'Crown', label: 'Premium' },
  { name: 'Ribbon', label: 'Événement' },
  { name: 'Star', label: 'Étoile' },
  { name: 'Sparkles', label: 'Éclat' },
  { name: 'Feather', label: 'Douceur' },
  { name: 'Shell', label: 'Nature' },
  { name: 'Wind', label: 'Détente' },
  { name: 'Layers', label: 'Autre' },
];

// ── Keyword fallback (for categories without a stored icon) ────

const KEYWORD_ICON_MAP: Array<{ keywords: string[]; iconName: string }> = [
  { keywords: ['coiff', 'cheveu', 'cheveux', 'hair', 'coupe'], iconName: 'Comb' },
  { keywords: ['brushing', 'lissage', 'seche'], iconName: 'HairDryer' },
  { keywords: ['color', 'coloration', 'meche', 'mèche', 'teinture', 'balayage'], iconName: 'Droplets' },
  { keywords: ['soin', 'visage', 'facial', 'hydrat', 'peel'], iconName: 'FacialCleanser' },
  { keywords: ['manucure', 'pédicure', 'pedicure', 'ongle', 'nail', 'vernis', 'gel'], iconName: 'NailPolish' },
  { keywords: ['maquill', 'makeup', 'teint'], iconName: 'CosmeticBrush' },
  { keywords: ['lèvre', 'levre', 'lip'], iconName: 'Lipstick' },
  { keywords: ['épil', 'epil', 'wax', 'cire'], iconName: 'Zap' },
  { keywords: ['massage', 'relaxa', 'détente', 'detente', 'corps', 'body'], iconName: 'Heart' },
  { keywords: ['bronz', 'soleil', 'uv', 'tan'], iconName: 'Sun' },
  { keywords: ['cil', 'sourcil', 'lash', 'brow', 'regard', 'extension'], iconName: 'Mascara' },
  { keywords: ['bien-être', 'bien être', 'spa', 'wellness', 'hammam'], iconName: 'Spa' },
];

function guessIconName(categoryName: string): string {
  const lower = categoryName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const { keywords, iconName } of KEYWORD_ICON_MAP) {
    for (const kw of keywords) {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(normalizedKw)) return iconName;
    }
  }
  return 'Layers';
}

function resolveIconName(categoryName: string, storedIconName?: string): string {
  if (storedIconName && ICON_REGISTRY[storedIconName]) return storedIconName;
  return guessIconName(categoryName);
}

// ── <CategoryIcon> component ───────────────────────────────────

interface CategoryIconProps {
  categoryName: string;
  iconName?: string;
  size?: number;
  className?: string;
}

/** Renders the appropriate icon for a service category. */
export const CategoryIcon: React.FC<CategoryIconProps> = ({ categoryName, iconName, size = 14, className }) => {
  const name = resolveIconName(categoryName, iconName);
  const entry = ICON_REGISTRY[name] ?? ICON_REGISTRY['Layers'];
  return renderIcon(entry, size, className);
};

// ── <RegistryIcon> — render any icon by registry name ──────────

interface RegistryIconProps {
  name: string;
  size?: number;
  className?: string;
}

/** Renders an icon from the registry by its name key. Used by IconPicker. */
export const RegistryIcon: React.FC<RegistryIconProps> = ({ name, size = 18, className }) => {
  const entry = ICON_REGISTRY[name];
  if (!entry) return null;
  return renderIcon(entry, size, className);
};

/** Check if a name exists in the registry. */
export function hasIcon(name: string): boolean {
  return name in ICON_REGISTRY;
}
