import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const [expanded, setExpanded] = useState(false);
  const touchStartY = useRef(0);
  const currentDelta = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset expanded state when closed
  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    currentDelta.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - touchStartY.current;
    currentDelta.current = delta;
    // Only apply visual transform for downward drag
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = currentDelta.current;

    // Reset visual transform
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }

    if (delta > 100) {
      // Dragged down significantly — close and reset
      setExpanded(false);
      onClose();
    } else if (delta < -50 && !expanded) {
      // Dragged up significantly — expand
      setExpanded(true);
    }

    currentDelta.current = 0;
  }, [expanded, onClose]);

  if (!isOpen) return null;

  const sheetHeight = expanded ? '90dvh' : '50dvh';

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 'var(--z-modal, 60)' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl flex flex-col transition-[height] duration-300 ease-out"
        style={{ height: sheetHeight }}
      >
        {/* Drag handle area */}
        <div
          className="flex items-center justify-center py-3 cursor-grab shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Optional title */}
        {title && (
          <h3 className="text-base font-semibold text-slate-900 px-5 pb-3 shrink-0">
            {title}
          </h3>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
