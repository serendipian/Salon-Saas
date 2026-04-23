let _salonCurrency = 'MAD';

export function setSalonCurrency(currency: string) {
  _salonCurrency = currency;
}

export function formatPrice(amount: number, currency = _salonCurrency): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatTicketNumber(n: number): string {
  return `n°${n.toString().padStart(6, '0')}`;
}
