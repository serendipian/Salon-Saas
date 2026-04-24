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

// Machine-readable exception prefixes raised by RPC functions (ERRCODE P0001).
// RPCs use "PREFIX:human-readable" so clients can map to a specific French message.
const KNOWN_MESSAGE_PREFIXES: Array<[string, string]> = [
  ['APPT_COMPLETED:', 'Impossible de modifier un rendez-vous terminé'],
  ['APPT_ALREADY_CANCELLED:', 'Ce rendez-vous est déjà annulé'],
];

function matchKnownMessage(error: unknown): string | undefined {
  // PostgrestError is a plain object with a `.message` field, not an Error instance,
  // so we can't rely on `instanceof Error` — just duck-type the message string.
  if (!error || typeof error !== 'object') return undefined;
  const msg = (error as { message?: unknown }).message;
  if (typeof msg !== 'string') return undefined;
  for (const [prefix, mapped] of KNOWN_MESSAGE_PREFIXES) {
    if (msg.includes(prefix)) return mapped;
  }
  return undefined;
}

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

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg.includes('401') || msg.includes('JWTExpired') || msg.includes('JWT expired');
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

      const matchedMessage = matchKnownMessage(error);

      if (isTimeoutError(error)) {
        message = TIMEOUT_MESSAGE;
      } else if (isAuthError(error)) {
        message = 'Session expirée, veuillez réessayer';
      } else if (isNetworkError(error)) {
        message = 'Problème de connexion, veuillez réessayer';
      } else if (matchedMessage) {
        message = matchedMessage;
      } else {
        const code = getErrorCode(error);
        message = (code && KNOWN_ERRORS[code]) || fallbackMessage;
      }

      addToast({ type: 'error', message });

      const code = getErrorCode(error);
      const isExpected =
        isTimeoutError(error) ||
        isAuthError(error) ||
        isNetworkError(error) ||
        !!matchedMessage ||
        (code && code in KNOWN_ERRORS);
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
