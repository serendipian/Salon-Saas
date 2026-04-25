import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface GoogleSignInButtonProps {
  /** Redirect destination after successful auth (path, e.g. "/dashboard") */
  redirect?: string | null;
  /** Override label — defaults to "Continuer avec Google" */
  label?: string;
  onError?: (message: string) => void;
}

/** Official multicolor Google "G" logo (Material guidelines). */
const GoogleLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    role="presentation"
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 18 18"
    className="shrink-0"
  >
    <path
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  redirect,
  label = 'Continuer avec Google',
  onError,
}) => {
  const { signInWithGoogle } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (isPending) return;
    setIsPending(true);
    const { error } = await signInWithGoogle(redirect);
    if (error) {
      onError?.(error);
      setIsPending(false);
    }
    // On success, browser navigates away to Google's OAuth flow — no need to clear pending.
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={label}
      className="auth-google"
    >
      {isPending ? <Loader2 size={18} className="animate-spin" /> : <GoogleLogo size={18} />}
      <span>{label}</span>
    </button>
  );
};

interface AuthDividerProps {
  label?: string;
}

export const AuthDivider: React.FC<AuthDividerProps> = ({ label = 'ou' }) => (
  <div className="auth-divider">
    <span>{label}</span>
  </div>
);
