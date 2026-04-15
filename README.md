# Lumiere Beauty SaaS

Salon management SaaS for beauty salons (Moroccan/French market). React 19 + TypeScript + Vite + Supabase + Stripe.

## Stack

- React 19 + TypeScript 5.8 (strict)
- Vite 6, Tailwind CSS 4
- Supabase (Postgres 15, Auth, Realtime, Storage)
- TanStack Query, React Router 7, Recharts 3, Zod
- Stripe (Checkout + Customer Portal + webhooks)
- Google Gemini API (service description generation)
- Sentry (error reporting)

## Prerequisites

- Node.js 20+
- A Supabase project (`npx supabase` for local; or remote)
- Optional: Stripe account (for billing), Gemini API key, Sentry DSN

## Setup

```bash
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY at minimum
npm run dev          # http://localhost:3000
```

## Environment variables

See `.env.example`. Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Everything else is optional and gracefully no-ops when blank.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Biome lint check |
| `npm run lint:fix` | Biome lint with auto-fix |
| `npm run format` | Biome format |
| `npm test` | Vitest unit tests (single run) |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:start` | Start local Supabase (Docker required) |
| `npm run db:stop` | Stop local Supabase |
| `npm run db:reset` | Drop + recreate local DB from migrations + seed |
| `npm run db:types` | Regenerate `lib/database.types.ts` from local DB |
| `npm run db:migration <name>` | Create a new migration file |

To regenerate types against the **remote** project (no Docker):

```bash
npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
```

## Deployment

Hosted on Vercel. `vercel.json` configures SPA rewrites and security headers (HSTS, CSP, X-Frame-Options, etc.). Push to `main` triggers production deploy; PR branches get preview deploys.

Edge functions live in `supabase/functions/`. Deploy with:

```bash
npx supabase functions deploy <name> --no-verify-jwt --use-api
```

All four functions (`create-checkout-session`, `create-portal-session`, `stripe-webhook`, `expire-trials`) authenticate internally and must be deployed with `--no-verify-jwt`.

## Architecture

See `CLAUDE.md` for module layout, RLS model, billing flow, and per-module conventions.

## Contributing

CI gates every PR on lint + typecheck + test + build + `npm audit`. Strict TS is on; new code must pass `npx tsc --noEmit`.
