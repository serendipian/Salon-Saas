import type React from 'react';

interface AuthShellProps {
  /** Headline shown on the form side, in display serif */
  headline: string;
  /** Smaller line below headline */
  subhead?: string;
  /** Optional small label above headline (e.g. "Espace professionnel") */
  kicker?: string;
  /** Form content slot */
  children: React.ReactNode;
  /** Optional footer slot rendered below the form (links, switch-mode CTA) */
  footer?: React.ReactNode;
}

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?auto=format&fit=crop&w=1600&q=80',
];

export const AuthShell: React.FC<AuthShellProps> = ({
  headline,
  subhead,
  kicker,
  children,
  footer,
}) => {
  return (
    <div
      className="auth-root min-h-screen w-full overflow-hidden bg-[var(--auth-cream)] text-[var(--auth-ink)]"
      style={{
        // @ts-expect-error CSS custom prop
        '--auth-ink': '#0e0c0b',
      }}
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ─────────────── HERO (left) ─────────────── */}
        <aside className="relative isolate hidden overflow-hidden lg:block" aria-hidden="true">
          {/* Fallback gradient — visible if images fail */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(120% 90% at 30% 20%, #2a1a22 0%, #15090f 55%, #0a0405 100%)',
            }}
          />

          {/* Image carousel */}
          <div className="absolute inset-0">
            {HERO_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className="auth-hero-img absolute inset-0 h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
          </div>

          {/* Editorial scrims */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(8,5,4,0.55) 0%, rgba(8,5,4,0.20) 35%, rgba(8,5,4,0.45) 75%, rgba(8,5,4,0.85) 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-70"
            style={{
              background:
                'radial-gradient(60% 40% at 70% 30%, rgba(255,210,170,0.35), transparent 70%)',
            }}
          />

          {/* Centered wordmark + slogan — only text on the hero */}
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
            <div className="auth-rise" style={{ ['--d' as string]: '120ms' }}>
              <h2 className="auth-display text-[64px] font-light italic leading-none text-white">
                BeautyFlow
              </h2>
              <div className="mx-auto mt-5 h-px w-16 bg-white/35" />
              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.42em] text-white/70">
                Beauty Salon Management App
              </p>
            </div>
          </div>
        </aside>

        {/* ─────────────── FORM (right) ─────────────── */}
        <main className="relative flex min-h-[100dvh] flex-col bg-[var(--auth-ivory)]">
          {/* Mobile cinematic hero — only visible <lg */}
          <div className="auth-mobile-hero relative w-full overflow-hidden lg:hidden">
            {/* Fallback gradient */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 30% 20%, #2a1a22 0%, #15090f 55%, #0a0405 100%)',
              }}
            />
            {/* Image carousel */}
            {HERO_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className="auth-hero-img absolute inset-0 h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
            {/* Editorial scrims */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(8,5,4,0.55) 0%, rgba(8,5,4,0.18) 30%, rgba(8,5,4,0.35) 70%, var(--auth-ivory) 100%)',
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-70"
              style={{
                background:
                  'radial-gradient(60% 40% at 70% 30%, rgba(255,210,170,0.35), transparent 70%)',
              }}
            />

            {/* Centered wordmark + slogan — only text on the hero */}
            <div
              className="auth-rise relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center"
              style={{
                ['--d' as string]: '120ms',
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              }}
            >
              <h2 className="auth-display text-[44px] font-light italic leading-none text-white">
                BeautyFlow
              </h2>
              <div className="mx-auto mt-4 h-px w-12 bg-white/35" />
              <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.4em] text-white/70">
                Beauty Salon Management App
              </p>
            </div>

            {/* Curved transition into the form */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
              style={{
                background: 'var(--auth-ivory)',
                borderRadius: '28px 28px 0 0',
              }}
            />
          </div>

          {/* Subtle paper grain overlay */}
          <div className="auth-grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />

          {/* Decorative gold corner ornament (top-right) */}
          <svg
            role="presentation"
            aria-hidden
            className="pointer-events-none absolute right-8 top-8 hidden h-14 w-14 text-[var(--auth-rose)]/30 lg:block"
            viewBox="0 0 56 56"
            fill="none"
          >
            <path d="M1 1H20" stroke="currentColor" strokeWidth="1" />
            <path d="M1 1V20" stroke="currentColor" strokeWidth="1" />
            <circle cx="1" cy="1" r="2" fill="currentColor" />
          </svg>

          {/* Decorative gold corner ornament (bottom-left) */}
          <svg
            role="presentation"
            aria-hidden
            className="pointer-events-none absolute bottom-8 left-8 hidden h-14 w-14 text-[var(--auth-rose)]/30 lg:block"
            viewBox="0 0 56 56"
            fill="none"
          >
            <path d="M55 55H36" stroke="currentColor" strokeWidth="1" />
            <path d="M55 55V36" stroke="currentColor" strokeWidth="1" />
            <circle cx="55" cy="55" r="2" fill="currentColor" />
          </svg>

          <div
            className="relative z-10 flex flex-1 items-center justify-center px-6 sm:px-12"
            style={{
              paddingTop: '32px',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
            }}
          >
            <div className="w-full max-w-[440px]">
              {kicker && (
                <p
                  className="auth-rise mb-5 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.32em] text-[var(--auth-rose-deep)]"
                  style={{ ['--d' as string]: '80ms' }}
                >
                  <span className="inline-block h-px w-6 bg-[var(--auth-rose-deep)]/60" />
                  {kicker}
                </p>
              )}

              <h1
                className="auth-rise auth-display font-light leading-[1.04] text-[var(--auth-ink)]"
                style={{
                  ['--d' as string]: '160ms',
                  fontSize: 'clamp(32px, 7vw, 46px)',
                }}
              >
                {headline}
              </h1>

              {subhead && (
                <p
                  className="auth-rise mt-3 max-w-md text-[15px] leading-relaxed text-[var(--auth-ink-soft)]/80"
                  style={{ ['--d' as string]: '240ms' }}
                >
                  {subhead}
                </p>
              )}

              <div className="auth-rise mt-9" style={{ ['--d' as string]: '320ms' }}>
                {children}
              </div>

              {footer && (
                <div
                  className="auth-rise mt-8 border-t border-[var(--auth-line)] pt-6 text-sm text-[var(--auth-ink-soft)]/80"
                  style={{ ['--d' as string]: '480ms' }}
                >
                  {footer}
                </div>
              )}
            </div>
          </div>

          {/* Bottom-right legal/version line — extra editorial polish */}
          <div className="relative z-10 hidden items-center justify-between px-12 pb-6 text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--auth-ink-soft)]/45 lg:flex">
            <span>&copy; BeautyFlow &mdash; Beauty Salon Management App</span>
            <span>v.2026</span>
          </div>
        </main>
      </div>
    </div>
  );
};
