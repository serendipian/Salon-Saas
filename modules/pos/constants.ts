export const VOID_CATEGORIES = [
  { key: 'entry_mistake', label: 'Erreur de saisie' },
  { key: 'client_cancelled', label: 'Client annulé' },
  { key: 'duplicate', label: 'Doublon' },
  { key: 'other', label: 'Autre' },
] as const;

export const REFUND_CATEGORIES = [
  { key: 'service_quality', label: 'Insatisfaction service' },
  { key: 'defective_product', label: 'Produit défectueux' },
  { key: 'product_return', label: 'Produit retourné' },
  { key: 'billing_error', label: 'Erreur de facturation' },
  { key: 'goodwill', label: 'Geste commercial' },
  { key: 'other', label: 'Autre' },
] as const;

export type VoidCategoryKey = (typeof VOID_CATEGORIES)[number]['key'];
export type RefundCategoryKey = (typeof REFUND_CATEGORIES)[number]['key'];

// Short labels for payment methods (used on dense surfaces where the full label
// would overflow). Full labels are authored by PaymentModal.
export const PAYMENT_METHOD_SHORT: Record<string, string> = {
  'Carte Bancaire': 'Carte',
  'Carte Cadeau': 'Cadeau',
  Virement: 'Virement',
};
