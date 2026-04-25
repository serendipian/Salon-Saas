import type React from 'react';
import { useEffect, useState } from 'react';

interface AuthShellProps {
  /** Editorial eyebrow shown over the hero (e.g. "Bienvenue / 01") */
  eyebrow?: string;
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

const QUOTES = [
  { fr: 'L’art du soin, sublimé.' },
  { fr: 'Chaque cliente, une œuvre.' },
  { fr: 'La beauté, en toute lumière.' },
];

export const AuthShell: React.FC<AuthShellProps> = ({
  eyebrow,
  headline,
  subhead,
  kicker,
  children,
  footer,
}) => {
  // Live local time in Casablanca for the editorial caption.
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Casablanca',
      }).format(new Date());
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);

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

          {/* Top frame: wordmark + frame number */}
          <div className="relative z-10 flex items-start justify-between px-12 pt-12">
            <div className="auth-rise" style={{ ['--d' as string]: '120ms' }}>
              <div className="flex items-baseline gap-3 text-white">
                <span className="auth-display text-3xl italic leading-none">BeautyFlow</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/70">
                  Salon Management
                </span>
              </div>
              <div className="mt-1 h-px w-24 bg-white/30" />
            </div>

            <div
              className="auth-rise text-right text-[10px] font-medium uppercase tracking-[0.32em] text-white/60"
              style={{ ['--d' as string]: '220ms' }}
            >
              <div>{eyebrow ?? '01 — Accès'}</div>
              <div className="mt-1 text-white/40">MMXXVI</div>
            </div>
          </div>

          {/* Vertical text spine on far left edge */}
          <div className="pointer-events-none absolute left-6 top-1/2 z-10 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180">
            <span className="text-[10px] font-medium uppercase tracking-[0.5em] text-white/40">
              Beauty Salon Management App
            </span>
          </div>

          {/* Center: rotating editorial quote */}
          <div className="relative z-10 flex h-[calc(100vh-13rem)] items-end px-12 pb-4">
            <div className="relative w-full max-w-xl">
              {QUOTES.map((q, i) => (
                <div
                  key={q.fr}
                  className="auth-quote absolute inset-x-0 bottom-0"
                  style={{ ['--d' as string]: `${i * 6}s` }}
                >
                  <p className="auth-display text-[44px] font-light leading-[1.05] text-white sm:text-[52px]">
                    &ldquo;{q.fr}&rdquo;
                  </p>
                </div>
              ))}
              {/* Spacer to give the absolutely-positioned quote a height target */}
              <div className="invisible">
                <p className="auth-display text-[44px] leading-[1.05] sm:text-[52px]">
                  &ldquo;{QUOTES[0].fr}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Bottom caption: live time + carousel dots */}
          <div className="relative z-10 flex items-center justify-between px-12 pb-12">
            <div
              className="auth-rise flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/65"
              style={{ ['--d' as string]: '320ms' }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--auth-rose)] shadow-[0_0_12px_2px_rgba(179,72,104,0.6)]" />
              Casablanca &middot; {now}
            </div>
            <div
              className="auth-rise flex gap-1.5"
              style={{ ['--d' as string]: '380ms' }}
              aria-hidden
            >
              <span className="h-1 w-8 rounded-full bg-white/70" />
              <span className="h-1 w-8 rounded-full bg-white/25" />
              <span className="h-1 w-8 rounded-full bg-white/25" />
            </div>
          </div>
        </aside>

        {/* ─────────────── FORM (right) ─────────────── */}
        <main className="relative flex min-h-screen flex-col bg-[var(--auth-ivory)]">
          {/* Mobile hero strip — only visible <lg */}
          <div className="relative h-44 w-full overflow-hidden lg:hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 30% 20%, #2a1a22 0%, #15090f 55%, #0a0405 100%)',
              }}
            />
            {HERO_IMAGES.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                className="auth-hero-img absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(8,5,4,0.45) 0%, rgba(8,5,4,0.30) 50%, rgba(247,242,234,1) 100%)',
              }}
            />
            <div className="relative z-10 flex items-center justify-between px-6 pt-6">
              <span className="auth-display text-2xl italic text-white">BeautyFlow</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/70">
                Salon Management
              </span>
            </div>
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

          <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
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
                className="auth-rise auth-display text-[40px] font-light leading-[1.04] text-[var(--auth-ink)] sm:text-[46px]"
                style={{ ['--d' as string]: '160ms' }}
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
