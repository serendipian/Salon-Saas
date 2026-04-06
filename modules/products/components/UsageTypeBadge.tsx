import React from 'react';
import type { UsageType } from '../../../types';

const USAGE_STYLES: Record<UsageType, { label: string; className: string }> = {
  retail: { label: 'Revente', className: 'text-blue-700 bg-blue-50 border-blue-100' },
  internal: { label: 'Interne', className: 'text-violet-700 bg-violet-50 border-violet-100' },
  both: { label: 'Mixte', className: 'text-teal-700 bg-teal-50 border-teal-100' },
};

export const UsageTypeBadge: React.FC<{ usageType: UsageType }> = ({ usageType }) => {
  const style = USAGE_STYLES[usageType] ?? USAGE_STYLES.retail;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${style.className}`}>
      {style.label}
    </span>
  );
};
