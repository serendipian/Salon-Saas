let _salonCurrency = 'MAD';

export function setSalonCurrency(currency: string) {
  _salonCurrency = currency;
}

export function formatPrice(amount: number, currency = _salonCurrency): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}
