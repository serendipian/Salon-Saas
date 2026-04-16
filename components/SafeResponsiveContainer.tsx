import type React from 'react';
import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from 'react';

// Drop-in replacement for recharts' ResponsiveContainer that avoids the
// dev-mode "width(-1) and height(-1)" warning. recharts' own container
// starts its internal size state at -1 and logs the warning on its first
// render — we sidestep that by measuring the parent ourselves and passing
// explicit pixel width/height directly to the chart child (BarChart, AreaChart, etc.).
type ResponsiveChartChild = React.ReactElement<{ width?: number; height?: number }>;

interface Props {
  children: ResponsiveChartChild;
  className?: string;
  style?: React.CSSProperties;
  // Accepted for call-site compatibility with recharts' ResponsiveContainer.
  // Width/height are derived from the parent container via ResizeObserver.
  width?: string | number;
  height?: string | number;
  minWidth?: number;
  minHeight?: number;
  aspect?: number;
}

export const SafeResponsiveContainer: React.FC<Props> = ({ children, className, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const child = Children.only(children);

  return (
    <div ref={ref} className={className} style={{ width: '100%', height: '100%', ...style }}>
      {size.width > 0 && size.height > 0 && isValidElement(child)
        ? cloneElement(child, { width: size.width, height: size.height })
        : null}
    </div>
  );
};
