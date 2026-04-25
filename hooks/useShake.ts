import { useCallback, useRef } from 'react';

/**
 * Triggers the shake animation on a target element by toggling
 * `data-shake="true"` for 800ms. The element must be rendered and have its
 * ref attached. Subsequent calls within the active window are debounced.
 */
export function useShake() {
  const activeUntilRef = useRef(0);

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const now = Date.now();
    if (now < activeUntilRef.current) return;
    activeUntilRef.current = now + 800;
    el.setAttribute('data-shake', 'true');
    setTimeout(() => {
      el.removeAttribute('data-shake');
    }, 800);
  }, []);
}
