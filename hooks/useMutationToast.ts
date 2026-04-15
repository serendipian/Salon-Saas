// hooks/useMutationToast.ts
import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { TimeoutError } from '../lib/mutations';
import { Sentry } from '../lib/sentry';

// Known Supabase / PostgREST error codes
const KNOWN_ERRORS: Record<string, string> = {
  '42501': "Vous n'avez pas les droits pour cette action",
  '23505': 'Cet élément existe déjà',
  '23503': 'Cet élément est référencé ailleurs et ne peut pas être modifié',
  '23P01': 'Ce créneau est déjà occupé',
};

const TIMEOUT_MESSAGE =
  "Connexion instable. Votre demande n'est peut-être pas arrivée — vérifiez avant de réessayer.";

function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof Error && error.message.includes('La requête a expiré')) return true;
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true;
  if (error instanceof Error && error.message.includes('NetworkError')) return true;
  return false;
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function useMutationToast() {
  const { addToast } = useToast();

  const toastOnError = useCallback(
    (fallbackMessage: string) => (error: unknown) => {
      let message: string;

      if (isTimeoutError(error)) {
        message = TIMEOUT_MESSAGE;
      } else if (isNetworkError(error)) {
        message = 'Problème de connexion, veuillez réessayer';
      } else {
        const code = getErrorCode(error);
        message = (code && KNOWN_ERRORS[code]) || fallbackMessage;
      }

      addToast({ type: 'error', message });

      const code = getErrorCode(error);
      const isExpected =
        isTimeoutError(error) || isNetworkError(error) || (code && code in KNOWN_ERRORS);
      if (!isExpected) {
        Sentry.captureException(error, {
          tags: { source: 'mutation' },
          extra: { fallbackMessage },
        });
      }
    },
    [addToast],
  );

  const toastOnSuccess = useCallback(
    (message: string) => () => {
      addToast({ type: 'success', message });
    },
    [addToast],
  );

  return { toastOnError, toastOnSuccess };
}
