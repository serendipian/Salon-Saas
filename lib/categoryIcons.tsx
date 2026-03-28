import React from 'react';
import {
  Scissors,
  Sparkles,
  Paintbrush,
  Droplets,
  Hand,
  Zap,
  Heart,
  Sun,
  Eye,
  Flower2,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Maps category names (French beauty salon context) to Lucide icons
 * using keyword matching. Falls back to Layers for unknown categories.
 */
const KEYWORD_ICON_MAP: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ['coiff', 'cheveu', 'cheveux', 'hair', 'brushing', 'coupe'], icon: Scissors },
  { keywords: ['color', 'coloration', 'meche', 'mèche', 'teinture', 'balayage'], icon: Droplets },
  { keywords: ['soin', 'visage', 'facial', 'hydrat', 'peel'], icon: Sparkles },
  { keywords: ['manucure', 'pédicure', 'pedicure', 'ongle', 'nail', 'vernis', 'gel'], icon: Paintbrush },
  { keywords: ['maquill', 'makeup', 'teint'], icon: Eye },
  { keywords: ['épil', 'epil', 'wax', 'cire'], icon: Zap },
  { keywords: ['massage', 'relaxa', 'détente', 'detente', 'corps', 'body'], icon: Heart },
  { keywords: ['bronz', 'soleil', 'uv', 'tan'], icon: Sun },
  { keywords: ['cil', 'sourcil', 'lash', 'brow', 'regard', 'extension'], icon: Eye },
  { keywords: ['bien-être', 'bien être', 'spa', 'wellness', 'hammam'], icon: Flower2 },
  { keywords: ['main', 'hand', 'pied', 'foot'], icon: Hand },
];

export function getCategoryIcon(categoryName: string): LucideIcon {
  const lower = categoryName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const { keywords, icon } of KEYWORD_ICON_MAP) {
    for (const kw of keywords) {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(normalizedKw)) return icon;
    }
  }
  return Layers;
}

interface CategoryIconProps {
  categoryName: string;
  size?: number;
  className?: string;
}

/** Renders the appropriate Lucide icon for a service category. */
export const CategoryIcon: React.FC<CategoryIconProps> = ({ categoryName, size = 14, className }) => {
  const Icon = getCategoryIcon(categoryName);
  return <Icon size={size} className={className} />;
};
