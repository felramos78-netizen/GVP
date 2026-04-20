# CLAUDE.md — Sistema Vida (GVP)

Sistema personal de gestión de alimentación, finanzas y stock para uso doméstico en Chile.

## Stack
- **Framework:** Next.js 14 (App Router) + TypeScript
- **DB:** Supabase (PostgreSQL + Auth + RLS)
- **IA:** Google Gemini API (gemini-2.5-flash-lite para análisis, gemini-2.5-flash para agente)
- **Estilo:** Tailwind CSS
- **PWA:** @ducanh2912/next-pwa
- **Deploy:** Vercel (tier gratuito)

## Variables de entorno requeridas
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_ID
GEMINI_API_KEY
NEXT_PUBLIC_APP_URL
AI_DAILY_LIMIT=50
```

## Estructura clave
- `app/api/` — API Routes de Next.js
- `lib/db/` — Queries de Supabase tipadas
- `lib/gemini/` — Cliente y prompts de Gemini
- `components/modules/` — UI por módulo
- `types/database.ts` — Tipos generados desde Supabase schema

## Módulos del sistema
1. **Dashboard** — Resumen de stock, finanzas y planner
2. **Compras** — Importar boletas con IA (foto → JSON → stock/finanzas)
3. **Stock** — Inventario de productos con alertas de mínimo
4. **Finanzas** — Centros de costo, presupuesto mensual, modo Ahorros
5. **Planner** — Plan de comidas semanal
6. **Recetario** — Recetas con ingredientes del stock
7. **Agente** — Asistente IA conversacional con acciones sobre el sistema
8. **Banco** — Integración Fintoc (movimientos bancarios)

## Issues conocidos (pre-existentes, mascarados por ignoreBuildErrors)
- **TS mismatch Supabase**: `SupabaseClient<Database>` (en lib/db/*.ts) vs `SupabaseClient<Database,'public',Schema>` (retornado por createServerClient). Afecta pages que llaman funciones de lib/db. No bloquea build por `ignoreBuildErrors: true`.
- **`any` types** en hooks y componentes — acumulación técnica histórica

## Bugs corregidos (sesión 2026-04-20)
- **[CRÍTICO] `app/api/compras/route.ts`** estaba vacío — implementado completamente (guarda stock, price_history, monthly_budget)
- **[CRÍTICO] `app/api/agente/route.ts:131`** — `generationConfig` duplicado eliminado
- **[MEDIO] `app/api/compras/analizar/route.ts`** — añadido try/catch para JSON.parse inválido (retorna 422)
- **[MEDIO] `next.config.js`** — `allowedOrigins` ahora incluye `NEXT_PUBLIC_APP_URL` para producción

## Convenciones
- Gemini: siempre usar `gemini-2.5-flash-lite` para análisis de imágenes/texto simple; `gemini-2.5-flash` para el agente conversacional
- Supabase: usar `.maybeSingle()` en vez de `.single()` cuando puede no haber resultado
- API Routes: siempre verificar `user` con `supabase.auth.getUser()` al inicio
- Finanzas: gastos se registran en tabla `monthly_budget` con `year_month` = `YYYY-MM`
- Soft delete: productos, recetas y centros de costo usan `is_active: false` en vez de DELETE

## Rama de desarrollo
`claude/cool-cannon-iqc10`
