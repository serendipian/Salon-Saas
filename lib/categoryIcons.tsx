import React from 'react';
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
  Brush,
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
import { HairIcon, NailPolishIcon, HairDryerIcon, LipsIcon } from './beautyIcons';

// ── Icon registry: name → component ────────────────────────────
// Includes both Lucide icons and custom beauty SVGs.
// Custom icons match the LucideIcon interface (forwardRef + size/className).

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  // Custom beauty icons
  Hair: HairIcon as unknown as LucideIcon,
  NailPolish: NailPolishIcon as unknown as LucideIcon,
  HairDryer: HairDryerIcon as unknown as LucideIcon,
  Lips: LipsIcon as unknown as LucideIcon,
  // Lucide icons
  Brush,
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
};

/** Curated list for the picker, in a meaningful order for a beauty salon. */
export const ICON_PICKER_LIST: Array<{ name: string; label: string }> = [
  { name: 'Hair', label: 'Cheveux' },
  { name: 'Scissors', label: 'Coupe' },
  { name: 'HairDryer', label: 'Brushing' },
  { name: 'Droplets', label: 'Coloration' },
  { name: 'SprayCan', label: 'Laque' },
  { name: 'Brush', label: 'Brosse' },
  { name: 'NailPolish', label: 'Ongles' },
  { name: 'Gem', label: 'Manucure' },
  { name: 'Sparkles', label: 'Soins' },
  { name: 'WandSparkles', label: 'Beauté' },
  { name: 'Lips', label: 'Lèvres' },
  { name: 'Palette', label: 'Maquillage' },
  { name: 'Eye', label: 'Regard' },
  { name: 'Zap', label: 'Épilation' },
  { name: 'Heart', label: 'Massage' },
  { name: 'HandHeart', label: 'Bien-être' },
  { name: 'Flower2', label: 'Spa' },
  { name: 'Bath', label: 'Hammam' },
  { name: 'ShowerHead', label: 'Douche' },
  { name: 'Sun', label: 'Bronzage' },
  { name: 'Flame', label: 'Énergie' },
  { name: 'Crown', label: 'Premium' },
  { name: 'Ribbon', label: 'Événement' },
  { name: 'Star', label: 'Étoile' },
  { name: 'Feather', label: 'Douceur' },
  { name: 'Shell', label: 'Nature' },
  { name: 'Wind', label: 'Détente' },
  { name: 'Layers', label: 'Autre' },
];

// ── Keyword fallback (for categories without a stored icon) ────

const KEYWORD_ICON_MAP: Array<{ keywords: string[]; iconName: string }> = [
  { keywords: ['coiff', 'cheveu', 'cheveux', 'hair', 'coupe'], iconName: 'Hair' },
  { keywords: ['brushing', 'lissage', 'seche'], iconName: 'HairDryer' },
  { keywords: ['color', 'coloration', 'meche', 'mèche', 'teinture', 'balayage'], iconName: 'Droplets' },
  { keywords: ['soin', 'visage', 'facial', 'hydrat', 'peel'], iconName: 'Sparkles' },
  { keywords: ['manucure', 'pédicure', 'pedicure', 'ongle', 'nail', 'vernis', 'gel'], iconName: 'NailPolish' },
  { keywords: ['maquill', 'makeup', 'teint'], iconName: 'Palette' },
  { keywords: ['lèvre', 'levre', 'lip'], iconName: 'Lips' },
  { keywords: ['épil', 'epil', 'wax', 'cire'], iconName: 'Zap' },
  { keywords: ['massage', 'relaxa', 'détente', 'detente', 'corps', 'body'], iconName: 'Heart' },
  { keywords: ['bronz', 'soleil', 'uv', 'tan'], iconName: 'Sun' },
  { keywords: ['cil', 'sourcil', 'lash', 'brow', 'regard', 'extension'], iconName: 'Eye' },
  { keywords: ['bien-être', 'bien être', 'spa', 'wellness', 'hammam'], iconName: 'Flower2' },
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

/** Resolve the icon component for a category.
 *  Priority: stored icon name → keyword fallback → Layers */
export function getCategoryIcon(categoryName: string, storedIconName?: string): LucideIcon {
  if (storedIconName && ICON_REGISTRY[storedIconName]) {
    return ICON_REGISTRY[storedIconName];
  }
  const guessed = guessIconName(categoryName);
  return ICON_REGISTRY[guessed] ?? Layers;
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
  const Icon = getCategoryIcon(categoryName, iconName);
  return <Icon size={size} className={className} />;
};
