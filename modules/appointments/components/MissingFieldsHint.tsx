import { useEffect, useRef } from 'react';
import { humanizeMissing } from '../utils/missingFields';
import type { MissingField } from '../utils/missingFields';

interface Props {
  missingFields: MissingField[];
  pulseTrigger?: number;
  className?: string;
}

export default function MissingFieldsHint({
  missingFields,
  pulseTrigger = 0,
  className = '',
}: Props) {
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (pulseTrigger === 0) return;
    const el = ref.current;
    if (!el) return;
    el.classList.add('animate-pulse');
    const timer = setTimeout(() => el.classList.remove('animate-pulse'), 1000);
    return () => clearTimeout(timer);
  }, [pulseTrigger]);

  if (missingFields.length === 0) return null;

  return (
    <p ref={ref} className={`text-xs text-amber-700 text-center ${className}`}>
      Encore requis : <strong>{humanizeMissing(missingFields)}</strong>
    </p>
  );
}
