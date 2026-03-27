import React, { createContext, useCallback, useContext, useReducer, useRef } from 'react';

// --- Types ---

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

export interface AddToastInput {
  type: ToastType;
  message: string;
  duration?: number;
}

// --- State & Actions ---

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

const MAX_VISIBLE = 3;
const MAX_QUEUE = 10;

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD': {
      const updated = [...state.toasts, action.toast];
      if (updated.length > MAX_VISIBLE + MAX_QUEUE) {
        updated.splice(MAX_VISIBLE, 1);
      }
      return { toasts: updated };
    }
    case 'REMOVE':
      return { toasts: state.toasts.filter(t => t.id !== action.id) };
    default:
      return state;
  }
}

// --- Contexts ---

const ToastDispatchContext = createContext<{
  addToast: (input: AddToastInput) => void;
  removeToast: (id: string) => void;
} | null>(null);

const ToastStateContext = createContext<ToastState>({ toasts: [] });

// --- Provider ---

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 5000,
  error: 0,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    dispatch({ type: 'REMOVE', id });
  }, []);

  const addToast = useCallback((input: AddToastInput) => {
    const id = crypto.randomUUID();
    const duration = input.duration ?? DEFAULT_DURATIONS[input.type];
    const toast: Toast = { id, type: input.type, message: input.message, duration };

    dispatch({ type: 'ADD', toast });

    if (duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        dispatch({ type: 'REMOVE', id });
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, []);

  const dispatchValue = useRef({ addToast, removeToast }).current;

  return (
    <ToastDispatchContext.Provider value={dispatchValue}>
      <ToastStateContext.Provider value={state}>
        {children}
      </ToastStateContext.Provider>
    </ToastDispatchContext.Provider>
  );
};

// --- Hooks ---

export const useToast = () => {
  const ctx = useContext(ToastDispatchContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const useToastState = () => {
  return useContext(ToastStateContext);
};
