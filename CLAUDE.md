# GVP — Gestión de Vida Personal

Sistema personal de gestión de alimentación, finanzas e inventario. PWA construida con Next.js 14, TypeScript, Supabase y Gemini AI, orientada al mercado chileno.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS 3 |
| Estado | TanStack Query 5 (server state), Zustand 4 (client state) |
| Backend | Next.js API Routes (serverless) |
| Base de datos | Supabase (PostgreSQL + Auth + RLS) |
| IA | Gemini API — `gemini-2.5-flash` (agente), `gemini-2.5-flash-lite` (precios/sugerencias) |
| Banco | Fintoc SDK (integración bancaria Chile) |
| PWA | @ducanh2912/next-pwa + Service Worker |
| Deploy | Vercel (gratis) |

---

## Estructura de directorios

```
app/
  (auth)/login/          # Login con magic link (OTP Supabase)
  (app)/                 # Layout protegido con Sidebar + Header + BottomNav
    dashboard/           # Métricas: finanzas, stock, semana alimentaria
    productos/           # Catálogo con historial de precios y búsqueda IA
    stock/               # Inventario: cantidades, mínimos, vencimientos
    cotizacion/          # Comparador de precios entre proveedores
    planner/             # Planificador mensual de comidas
    recetas/             # Recetario con ingredientes y macros
    compras/             # Órdenes de compra, proveedores, importar boletas
    finanzas/            # Centros de costo, presupuesto mensual, mantención
    banco/               # Importar cartolas PDF, clasificar movimientos
    aseo/                # Tareas de limpieza con frecuencia y registro
  api/
    agente/              # Asistente IA conversacional con herramientas
    ai/                  # Endpoints IA: búsqueda precios, parseo boletas
    banco/               # Importar cartola (PDF→JSON via Gemini)
    compras/             # CRUD órdenes de compra
    finanzas/            # CRUD centros de costo y presupuesto
    fintoc/              # Integración Fintoc (conexión bancaria)
    meal-plan/           # Generación de plan semanal
    products/            # CRUD productos
    recipes/             # CRUD recetas
    stock/               # CRUD inventario
    suppliers/           # CRUD proveedores

components/
  ui/                    # Botones, Badge, Modal, Spinner, etc.
  modules/               # Componentes por feature (dashboard, stock, etc.)
  providers/             # QueryProvider, etc.

lib/
  supabase/              # Clientes browser/server de Supabase
  db/                    # Queries: products.ts, stock.ts, meal-plan.ts, users.ts
  gemini/
    client.ts            # Singleton genAI + modelos getPriceSearchModel/getSuggestModel
    rate-limiter.ts      # Control de uso diario (tabla ai_usage, límite 50/día)
    price-search.ts      # Lógica de búsqueda de precios con Google Search
    prompts.ts           # Prompts centralizados
  fintoc/client.ts       # Inicialización Fintoc SDK
  utils/
    formatters.ts        # CLP, fechas, cantidades
    meal-checker.ts      # Disponibilidad de recetas según stock
    stock-logic.ts       # Algoritmos de inventario

hooks/                   # TanStack Query hooks: useProducts, useStock, useMealPlan, etc.
types/database.ts        # Tipos auto-generados desde Supabase
supabase-schema.sql      # Schema inicial completo
supabase-migrations/     # Migraciones incrementales (001, 002, 003)
```

---

## Base de datos — tablas principales

| Tabla | Propósito |
|-------|-----------|
| `users` | Perfil: nombre, ingresos, ciudad, mascotas, preferencias |
| `products` | Catálogo con categoría, tipo, unidad, shelf_life |
| `stock` | Inventario: current_qty, min_qty, expiry_date |
| `suppliers` | Proveedores globales y personalizados por usuario |
| `product_suppliers` | M2M producto-proveedor con URL |
| `price_history` | Historial de precios (manual/ai_search/purchase) |
| `purchase_orders` | Órdenes de compra (draft→pending→confirmed→cancelled) |
| `purchase_items` | Líneas de cada orden |
| `recipes` | Recetas con macros y tiempo de prep |
| `recipe_ingredients` | Ingredientes de cada receta |
| `meal_plan` | Planificación diaria (desayuno/almuerzo/cena/snack) |
| `cost_centers` | Centros de costo (gasto_fijo/variable/ahorro/meta) |
| `monthly_budget` | Presupuesto por centro y mes |
| `cleaning_tasks` | Tareas de aseo con frecuencia |
| `task_log` | Historial de ejecución de tareas de aseo |
| `ai_usage` | Contador diario de uso IA por usuario |
| `bank_connections` | Conexiones Fintoc |
| `bank_accounts` | Cuentas bancarias del usuario |
| `bank_transactions` | Movimientos con clasificación y supplier_id |
| `provider_aliases` | Alias de texto para mapear movimientos a proveedores |
| `mantencion_entries` | Abonos de mantención/pensión (migration 002) |
| `agent_conversations` | Historial de chat con el agente IA (migration 003) |
| `bug_reports` | Bugs reportados vía agente (migration 003) |

RLS habilitado en todas las tablas — cada usuario ve solo sus datos.

---

## Variables de entorno requeridas

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_ID
GEMINI_API_KEY
NEXT_PUBLIC_APP_URL
AI_DAILY_LIMIT=50         # Límite diario de búsquedas IA (default: 50)
```

---

## Comandos de desarrollo

```bash
npm run dev          # Servidor de desarrollo (puerto 3000)
npm run build        # Build de producción
npm run type-check   # Verificación TypeScript (sin ignorar errores)
npm run db:types     # Regenerar tipos desde Supabase
```

> `next.config.js` tiene `ignoreBuildErrors: true` y `eslint: { ignoreDuringBuilds: true }` — usar `npm run type-check` para verificar tipos.

---

## Modelos Gemini en uso

| Modelo | Uso |
|--------|-----|
| `gemini-2.5-flash` | Agente conversacional (`/api/agente`) |
| `gemini-2.5-flash-lite` | Búsqueda de precios con Google Search, sugerencias |

Rate limit: 50 req/día por usuario (configurable via `AI_DAILY_LIMIT`). Si falla la consulta a `ai_usage`, se permite el request para no bloquear al usuario.

---

## Migraciones SQL

Aplicar en orden después del schema base:

```
supabase-schema.sql                          # Schema inicial
supabase-migrations/001_bank_provider_crossref.sql  # Aliases de proveedores bancarios
supabase-migrations/002_mantencion.sql       # Tabla mantencion_entries
supabase-migrations/003_agente_tables.sql    # agent_conversations + bug_reports
```

---

## Rama de desarrollo activa

`claude/hopeful-lamport-vrmaL` — hacer push siempre a esta rama.

---

## Notas de arquitectura

- **Auth**: Supabase magic link (OTP email). Middleware refresca sesión en cada request.
- **Server vs Client**: Server Components para carga inicial, Client Components con TanStack Query para interacciones.
- **Soft delete**: Productos y centros de costo usan flag `is_active` en lugar de borrar.
- **Compra confirmada**: flujo transaccional: order → items → price_history → stock update.
- **Agente IA**: usa `<ACTION>{...}</ACTION>` en la respuesta para proponer acciones que requieren aprobación del usuario antes de ejecutarse.
- **No hay tests**: sin Jest/Vitest configurados. Verificar con `type-check` + prueba manual.
