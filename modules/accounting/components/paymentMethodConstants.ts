import { ArrowRightLeft, Banknote, CreditCard, Gift, Wallet } from 'lucide-react';
import type React from 'react';

export const ALL_REVENUE_METHODS = [
  'Espèces',
  'Carte Bancaire',
  'Virement',
  'Carte Cadeau',
  'Autre',
] as const;

export const PAYMENT_METHOD_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  Espèces: Banknote,
  'Carte Bancaire': CreditCard,
  Virement: ArrowRightLeft,
  'Carte Cadeau': Gift,
  Autre: Wallet,
};

export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  Espèces: 'bg-blue-50 text-blue-700',
  'Carte Bancaire': 'bg-blue-50 text-blue-600',
  Virement: 'bg-blue-50 text-blue-500',
  'Carte Cadeau': 'bg-blue-50 text-blue-400',
  Autre: 'bg-slate-50 text-slate-500',
};
