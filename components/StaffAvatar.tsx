import React from 'react';

interface StaffAvatarProps {
  firstName: string;
  lastName: string;
  photoUrl?: string;
  color?: string;
  /** px size — defaults to 24 */
  size?: number;
}

/** Tiny circular avatar: shows photo if available, otherwise colored initials. */
export const StaffAvatar: React.FC<StaffAvatarProps> = ({
  firstName,
  lastName,
  photoUrl,
  color,
  size = 24,
}) => {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fontSize = Math.max(size * 0.4, 9);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  // color can be a Tailwind class string (e.g. "bg-rose-100 text-rose-800") or a hex color
  const isTailwindClass = color && color.startsWith('bg-');

  return (
    <span
      className={`rounded-full flex items-center justify-center shrink-0 font-semibold ${
        isTailwindClass ? color : 'text-white'
      }`}
      style={{
        width: size,
        height: size,
        fontSize,
        ...(!isTailwindClass ? { backgroundColor: color || '#94a3b8' } : {}),
      }}
      aria-label={`${firstName} ${lastName}`}
    >
      {initials}
    </span>
  );
};
