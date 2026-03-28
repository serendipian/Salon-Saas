import React, { forwardRef } from 'react';

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
}

/** Flowing hair silhouette — represents coiffure/cheveux */
export const HairIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Head outline */}
      <circle cx="12" cy="9" r="4" />
      {/* Hair flowing from top */}
      <path d="M8 7c0-3 1.5-5 4-5s4 2 4 5" />
      {/* Long flowing hair strands */}
      <path d="M7.5 9c-1.5 1-2.5 3-2.5 5.5 0 2 .5 3.5 1 4.5" />
      <path d="M16.5 9c1.5 1 2.5 3 2.5 5.5 0 2-.5 3.5-1 4.5" />
      <path d="M9 11c-1 1.5-1.5 3.5-1 6" />
      <path d="M15 11c1 1.5 1.5 3.5 1 6" />
    </svg>
  ),
);
HairIcon.displayName = 'HairIcon';

/** Nail polish bottle — represents manucure/ongles */
export const NailPolishIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Bottle cap */}
      <rect x="10" y="2" width="4" height="4" rx="0.5" />
      {/* Brush handle */}
      <line x1="12" y1="6" x2="12" y2="9" />
      {/* Bottle body */}
      <path d="M8 9h8l-1 12H9L8 9z" />
      {/* Bottle highlight */}
      <path d="M10 12v5" />
    </svg>
  ),
);
NailPolishIcon.displayName = 'NailPolishIcon';

/** Hair dryer — represents brushing/styling */
export const HairDryerIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Dryer body (barrel) */}
      <path d="M6 8h8a4 4 0 0 1 0 8H6V8z" />
      {/* Nozzle */}
      <path d="M2 10h4v4H2z" />
      {/* Handle */}
      <path d="M14 16l2 5h-4l2-5" />
      {/* Air lines */}
      <line x1="18" y1="10" x2="21" y2="10" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="18" y1="14" x2="21" y2="14" />
    </svg>
  ),
);
HairDryerIcon.displayName = 'HairDryerIcon';

/** Lips — represents makeup/beauty */
export const LipsIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Upper lip */}
      <path d="M4 13c0-3 3.5-5 5.5-5 1 0 1.5.5 2.5.5s1.5-.5 2.5-.5c2 0 5.5 2 5.5 5" />
      {/* Lower lip */}
      <path d="M4 13c0 3 3.5 5 8 5s8-2 8-5" />
      {/* Cupid's bow */}
      <path d="M9.5 11l2.5-1 2.5 1" />
    </svg>
  ),
);
LipsIcon.displayName = 'LipsIcon';
