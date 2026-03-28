import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useFormatPrice() {
  const { activeSalon } = useAuth();
  const currency = activeSalon?.currency ?? 'MAD';

  return useCallback(
    (amount: number) =>
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount),
    [currency]
  );
}
