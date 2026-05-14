import { useAuth } from '../context/AuthContext';

/**
 * Returns the active salon's IANA timezone (e.g. `Africa/Casablanca`), with a
 * `Europe/Paris` fallback used when there's no active salon yet (boot) or the
 * row predates the timezone column.
 *
 * Use this everywhere a component decides "what calendar day is this?". For
 * pure helpers see `lib/salonTime.ts`.
 */
export function useSalonTimezone(): string {
  const { activeSalon } = useAuth();
  return activeSalon?.timezone ?? 'Europe/Paris';
}
