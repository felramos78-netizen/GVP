# GDV (Gestión de Vida) — Project Context

> Context document for Claude Code sessions. Keep this current as the codebase evolves.

## Identity & goals

- **Product**: personal life-management system covering food/stock, finances, activities, planning, bank import, and an AI assistant.
- **Original name**: "Sistema Vida" (still the `package.json` name and README title). Rebranded to **GDV** in the UI (`components/modules/layout/Sidebar.tsx`).
- **Primary user / product owner**: Felipe (solo builder, also the only end user).
- **Hard constraint**: $0/month. Every tech choice is evaluated against free tiers.
- **Locale**: Chilean — `es-CL` voice, CLP pricing, Chilean supermarket data (Líder, Tottus, Jumbo, Feria).
- **Repo**: https://github.com/felramos78-netizen/GVP
- **Live**: https://gvp-gamma.vercel.app
- **Supabase project ID**: `gcuqfkhbncbwiayifmkd`

## Stack

- **Framework**: Next.js 14.2.5 (App Router) + TypeScript 5.5 + React 18.3
- **DB/Auth**: Supabase (`@supabase/ssr` 0.4, `@supabase/supabase-js` 2.44), magic-link auth, RLS on all tables
- **AI**: Google Gemini via `@google/generative-ai` 0.15. Model used: `gemini-2.5-flash-lite` (`lib/gemini/client.ts`). README still says "Gemini 2.0 Flash" — stale, code is source of truth.
- **UI**: Tailwind CSS 3.4, Recharts 2.12, custom components (no external UI kit)
- **State/data**: Zustand 4.5 + TanStack Query 5.51
- **Excel/CSV**: `xlsx` 0.18 for bank statement parsing
- **Dates**: `date-fns` 3.6 + `date-fns-tz` 3.1
- **Deploy**: Vercel; env vars in both `.env.local` and the Vercel dashboard
- **Dev environment**: GitHub Codespaces (preferred over the earlier ZIP + PowerShell/CMD workflow)

## App routes

- **`app/(auth)/`** — public: `login/`, `onboarding/` (conversational Gemini flow that generates the user profile).
- **`app/(app)/`** — protected, sidebar-linked: `dashboard`, `finanzas`, `banco`, `stock`, `compras`, `aseo` (UI label is "Actividades" but the route path is still `/aseo`), `planner`, `recetas`, `cotizacion`, plus `productos`.
- **`app/api/`** — serverless endpoints:
  - `agente/` (chat + `historial/` + `deshacer/` for undo)
  - `ai/` (`boleta/` receipt vision, `onboarding/`, `search-prices/`, `suggest/`)
  - `auth/` (Supabase callback)
  - `banco/` (Excel import + Gemini classification)
  - `compras/` (`analizar/` = receipt photo ingestion)
  - `finanzas/`, `fintoc/connect/`, `fintoc/sync/`, `meal-plan/`, `price-history/`, `products/`, `recipes/`, `stock/`

## Middleware & auth (`middleware.ts`)

- Supabase SSR cookie refresh on every request.
- Public paths: `/login`, `/onboarding`. `/api/auth` also bypassed.
- Unauthed hitting anything else → `/login`. Authed hitting `/login` → `/dashboard`. Root `/` redirects based on auth.
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image extensions.

## Mesa de Ayuda — floating AI agent (`components/modules/agente/AgenteWidget.tsx`)

- Floating widget (not a sidebar item) rendered across the whole app.
- Tabs: `chat` + `historial`. Random `SESSION_ID` per page load scopes undo.
- **Voice off by default** (`voiceEnabled=false`). Web Speech API: `SpeechRecognition` for input (es-CL), `speechSynthesis` for output (strips emojis, 150-char cap).
- **Approval flow**: agent returns `pending_action`; user approves → re-POSTs with `approved_action`. Can also reject.
- **Undo**: `POST /api/agente/deshacer` with `session_id` reverses the last executed tool.
- **Function calling — 12 tools** declared in `app/api/agente/route.ts`:
  - Stock: `consultar_stock`, `actualizar_stock`, `crear_producto`, `consultar_historial_compras`
  - Finanzas: `consultar_finanzas`, `crear_centro_costo`
  - Planner: `agregar_al_planner`, `consultar_planner`
  - Recetas: `crear_receta`, `consultar_recetas`, `sugerir_recetas_con_stock`
  - Meta: `reportar_bug`

## Key modules

- **Compras** (`components/modules/compras/ComprasClient.tsx`) — photo of a boleta → Gemini Vision (`/api/compras/analizar`) → auto-creates products, bumps stock, logs expense against a cost center, suggests recipes.
- **Banco** (`components/modules/banco/BancoClient.tsx`) — file input accepts `.xlsx/.xls/.csv`, parsed with `XLSX.utils.sheet_to_json`. Transactions sent to Gemini for classification against the user's cost centers.
- **Fintoc** — scoped out (paid plan required for live mode). Legacy code still present at `lib/fintoc/client.ts` and `app/api/fintoc/{connect,sync}/`, not wired into UI.

## Gemini layer (`lib/gemini/`)

- `client.ts` — singleton `GoogleGenerativeAI`, throws if `GEMINI_API_KEY` missing. Two factories: price-search (Google Search tool enabled, temp 0.1) and suggest (temp 0.7).
- `rate-limiter.ts` — `checkAndIncrement(userId)` against an `ai_usage` table keyed by `user_id + date`. Default 50/day via `AI_DAILY_LIMIT` env (conservative vs. the 1,500/day free-tier ceiling). **Fails open** on query errors ("no bloquear al usuario"). `getUsage()` exposes remaining count for the UI.
- `prompts.ts` — system prompts.
- `price-search.ts` — batched multi-supplier price search in a single Gemini call.

## Database

⚠️ **Committed schema gap**: `supabase-schema.sql` currently contains only `users` and `suppliers` (seeded with Líder/Tottus/Jumbo/Feria). All other tables exist in the live Supabase project but are **not** tracked in this file.

Tables referenced throughout the code but missing from the committed SQL:
`ai_usage`, `price_history`, `purchase_orders`, `purchase_items`, `stock`/`products`, `meal_plan`, `recipes`, `cost_centers`, `agent_conversations`, `bug_reports`, `bank_connections`, `bank_accounts`, `bank_transactions`.

The last four (`agent_conversations`, `bug_reports`, `bank_*`) are the tables Felipe flagged as **pending SQL execution** in Supabase.

**RLS rule**: every browser-side insert must include `user_id` or it hits a 403.

## Data layer

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — SSR server client + `createAdminClient()` (service role, server-only)
- `lib/db/` — query helpers: `meal-plan.ts`, `products.ts`, `stock.ts`, `users.ts`
- `hooks/` — TanStack Query wrappers: `useMealPlan`, `usePendingPurchase` (reads sessionStorage written by cotizador), `usePriceHistory`, `useProducts`, `useStock`
- `types/database.ts` — generated via `npm run db:types` (Supabase CLI)

## Layout & navigation

- `components/modules/layout/Sidebar.tsx` — fixed 224px left sidebar, 9 nav items with emoji icons, "v0.1.0 · Zero cost" footer.
- `components/modules/layout/Header.tsx` — top bar.
- **Mobile responsive bottom nav is not yet built** — only `md:hidden` usage in the repo is inside the agent widget.

## Config quirks

- `next.config.js`: `typescript.ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true` — known workaround for Vercel blockers. Supabase client is often cast as `any` for the same reason.
- `images.remotePatterns` whitelists `**.supabase.co` plus the three supermarket domains.
- `experimental.serverActions.allowedOrigins: ['localhost:3000']` — dev only.
- **Required env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`, `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`, `AI_DAILY_LIMIT`.

## Operational principles & learnings

- **RLS everywhere** — any insert from the browser must carry `user_id`.
- **Gemini quota is a recurring real blocker**. Daily limit has been hit multiple times; key rotation via `aistudio.google.com` is operational knowledge, not one-time setup.
- **Rate limiter fails open by design** — availability prioritized over strict enforcement.
- **Felipe explicitly does not want to apply code manually** ("esto es lo que no quiero hacer"). Default to commit + push directly on the designated development branch.
- **UX commitments**: voice off by default, mobile-first intent, trustworthy AI UX via approval + undo.
- **TypeScript build errors** are currently suppressed at the Next.js level; treat this as a known debt rather than a signal to relax local type quality.

## On-deck / unfinished

1. Commit the missing table DDL (`agent_conversations`, `bug_reports`, `bank_connections`, `bank_accounts`, `bank_transactions`, plus the already-live tables) into `supabase-schema.sql` and execute in Supabase.
2. Mobile responsive layout with bottom navigation bar (no component exists yet).
3. Rotate in a fresh Gemini API key.
4. Decide fate of `/aseo` route path vs. the "Actividades" UI rename (cosmetic mismatch).
5. Decide fate of `lib/fintoc/` and `app/api/fintoc/*` — remove or keep dormant for a potential paid-plan revisit.
6. Update README to reflect the actual Gemini model in use (`gemini-2.5-flash-lite`).

## Workflow

- Develop on the branch specified by the current task instructions; never push to `main` without explicit permission.
- Commit messages follow the repo's existing style (`feat:`, `fix:`, `chore:` prefixes; Spanish descriptions are fine and match history).
- Do not create pull requests unless explicitly asked.
