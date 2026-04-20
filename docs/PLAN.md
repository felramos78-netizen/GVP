# Plan de Acción — Sistema Vida (VidaOS)

> **Última actualización:** 2026-04-20  
> **Estado del sistema:** Activo — stack Next.js 14 + Supabase + Gemini AI  
> **Rama activa de desarrollo:** `claude/elegant-maxwell-TkHvt`

---

## Evaluación del Estado Actual

### Fortalezas
- Arquitectura limpia con separación de módulos por dominio
- Integración AI funcional (Gemini 2.5 Flash Lite + Google Search)
- Cero costo de infraestructura (Vercel + Supabase + Gemini free tier)
- Seguridad sólida: RLS en todas las tablas, auth sin contraseña
- Foco de mercado claro: usuario chileno con supermercados locales

### Brechas Identificadas
- Sin modo offline / PWA limitada
- Agente AI reactivo (no proactivo ni conversacional)
- Tracking nutricional superficial (sin macros/micros)
- Sin notificaciones push para alertas críticas de stock
- Fintoc integrado pero sin categorización automática
- Sin soporte multi-usuario / hogar compartido
- Sin reportes exportables completos

---

## Las 5 Líneas de Desarrollo Paralelo

```
LÍNEA 1 — Experiencia Móvil & PWA        [Corto Plazo]
LÍNEA 2 — Agente AI Proactivo            [Corto/Mediano Plazo]
LÍNEA 3 — Inteligencia Financiera        [Mediano Plazo]
LÍNEA 4 — Nutrición & Salud Avanzada     [Mediano Plazo]
LÍNEA 5 — Expansión de Plataforma        [Largo Plazo]
```

Cada línea es independiente y puede avanzar en paralelo sin bloquear a las otras.

---

## Matriz de Propuestas

| # | Propuesta | Línea | Plazo | Impacto | Esfuerzo | Ratio I/E |
|---|-----------|-------|-------|---------|----------|-----------|
| P1 | PWA + Push Notifications | L1 | Corto | Alto | Bajo | ★★★★★ |
| P2 | Agente AI Conversacional v2 | L2 | Corto | Alto | Medio | ★★★★ |
| P3 | Categorización Financiera Automática (Fintoc) | L3 | Mediano | Alto | Medio | ★★★★ |
| P4 | Tracking de Macronutrientes | L4 | Mediano | Alto | Medio | ★★★★ |
| P5 | App Móvil Nativa (Capacitor) | L5 | Largo | Muy Alto | Alto | ★★★ |

---

## Detalle por Línea

---

### LÍNEA 1 — Experiencia Móvil & PWA
**Plazo:** Corto (0–4 semanas)  
**Impacto:** Alto | **Esfuerzo:** Bajo

#### Propuesta P1: PWA + Push Notifications de Stock
**Descripción:** Convertir la app en una Progressive Web App instalable con notificaciones push nativas para alertas de stock bajo y recordatorios de planificación semanal.

**Componentes:**
- `manifest.json` + Service Worker para instalación offline
- Web Push API con Supabase Edge Functions como trigger
- Pantalla de suscripción a notificaciones en `/dashboard`
- Alertas configurables: stock bajo, planer de la semana sin completar, presupuesto superado

**Archivos clave:**
- `public/manifest.json` (nuevo)
- `public/sw.js` (nuevo — Service Worker)
- `app/api/notifications/` (nuevo endpoint)
- `components/modules/dashboard/` (agregar UI de alertas)

**Métricas de éxito:** App instalable en móvil, ≥1 notificación push funcional en 7 días

**Estado:** ⬜ Pendiente

---

### LÍNEA 2 — Agente AI Proactivo
**Plazo:** Corto–Mediano (2–6 semanas)  
**Impacto:** Alto | **Esfuerzo:** Medio

#### Propuesta P2: Agente AI Conversacional v2
**Descripción:** Evolucionar el agente actual de reactivo a proactivo. El agente debe poder iniciar conversaciones, ofrecer sugerencias contextuales diarias, y ejecutar flujos completos (ej: "armar la semana de comidas con lo que hay en stock").

**Componentes:**
- Historial de conversación persistente en Supabase (`agent_conversations`)
- Acciones expandidas: crear meal plan, agregar compra, actualizar stock, modificar presupuesto
- Sugerencias diarias basadas en stock actual + presupuesto + historial
- UI mejorada con estado de "pensando", acciones en curso, confirmaciones
- Gemini 2.5 Flash con system prompt contextual enriquecido

**Archivos clave:**
- `app/api/agente/route.ts` (ampliar acciones)
- `components/modules/agente/` (UI conversacional)
- Nueva tabla `agent_conversations` en Supabase

**Métricas de éxito:** Agente puede ejecutar ≥5 acciones distintas sin intervención manual

**Estado:** ⬜ Pendiente

---

### LÍNEA 3 — Inteligencia Financiera
**Plazo:** Mediano (4–10 semanas)  
**Impacto:** Alto | **Esfuerzo:** Medio

#### Propuesta P3: Categorización Financiera Automática + Reportes
**Descripción:** Completar la integración Fintoc para que las transacciones bancarias se categorizan automáticamente por centro de costo usando AI, y generar reportes mensuales exportables con tendencias.

**Componentes:**
- Webhook Fintoc → Supabase para sincronización automática de movimientos
- Gemini clasifica cada transacción al centro de costo correspondiente
- Dashboard financiero con gráficos de tendencia (Recharts ya disponible)
- Export a Excel mejorado con gráficos incrustados
- Comparativa mes-a-mes con alertas de desviación de presupuesto

**Archivos clave:**
- `app/api/fintoc/` (webhook receiver + auto-categorización)
- `app/api/finanzas/` (reportes agregados)
- `components/modules/finanzas/` (gráficos de tendencia)
- `lib/fintoc/client.ts` (ampliar con webhooks)

**Métricas de éxito:** ≥80% de transacciones bancarias categorizadas automáticamente sin intervención

**Estado:** ⬜ Pendiente

---

### LÍNEA 4 — Nutrición & Salud Avanzada
**Plazo:** Mediano (4–12 semanas)  
**Impacto:** Alto | **Esfuerzo:** Medio

#### Propuesta P4: Tracking de Macronutrientes + Objetivos de Salud
**Descripción:** Agregar base de datos nutricional a los productos y recetas para calcular macros/micros diarios. Integrar con el perfil del usuario (peso, objetivos) para recomendaciones personalizadas.

**Componentes:**
- Enriquecer tabla `products` con columnas: `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`
- API de búsqueda nutricional (Open Food Facts API — gratuita) para auto-completar
- Dashboard nutricional en `/planner` con semáforo de macros del día
- Objetivos configurables por usuario (volumen, definición, mantenimiento)
- Gemini sugiere ajustes al meal plan basado en déficit/superávit calórico

**Archivos clave:**
- `supabase-schema.sql` (migración: columnas nutricionales)
- `app/api/recipes/` (cálculo nutricional agregado)
- `components/modules/planner/` (dashboard nutricional)
- `lib/db/products.ts` (queries nutricionales)

**Métricas de éxito:** Ver macros totales del día desde el planner en ≤2 clics

**Estado:** ⬜ Pendiente

---

### LÍNEA 5 — Expansión de Plataforma
**Plazo:** Largo (3–6+ meses)  
**Impacto:** Muy Alto | **Esfuerzo:** Alto

#### Propuesta P5: App Móvil Nativa con Capacitor + Multi-Hogar
**Descripción:** Empaquetar la PWA como app nativa iOS/Android usando Capacitor (reutilización 95% del código). Agregar soporte para hogares compartidos donde múltiples usuarios ven el mismo stock y finanzas.

**Componentes:**
- Capacitor wrapper con plugins nativos (cámara para boletas, notificaciones nativas)
- Schema multi-tenant: tabla `households` + `household_members`
- Permisos por rol: admin (configura), miembro (registra compras/consumo), visor
- Sincronización en tiempo real con Supabase Realtime entre miembros
- App Store + Google Play deployment pipeline

**Archivos clave:**
- `capacitor.config.ts` (nuevo)
- `supabase-schema.sql` (migración: households + roles)
- Middleware de tenant routing
- `app/api/*` (scope por household_id en lugar de user_id)

**Métricas de éxito:** App instalada desde App Store con ≥2 usuarios en el mismo hogar sincronizados

**Estado:** ⬜ Pendiente

---

## Roadmap Visual

```
Semana  →  1   2   3   4   5   6   7   8   9  10  11  12  13+
───────────────────────────────────────────────────────────────
L1 PWA      [P1: PWA + Push ─────────────]
L2 Agente       [P2: Agente v2 ──────────────────]
L3 Finanzas              [P3: Fintoc Auto ──────────────────]
L4 Nutrición             [P4: Macros ─────────────────────────]
L5 Plataforma                              [P5: Capacitor ───────────────→]
```

---

## Criterios de Priorización

Para decidir qué iniciar primero dentro de cada línea, aplicar:

1. **Impacto por usuario** — ¿Cuántos flujos diarios mejora?
2. **Esfuerzo de implementación** — Horas estimadas de desarrollo
3. **Dependencias técnicas** — ¿Requiere cambios de schema/infraestructura?
4. **Reversibilidad** — ¿Es fácil de revertir si falla?

**Orden de inicio recomendado:** P1 → P2 → P3 (en paralelo con P4) → P5

---

## Registro de Cambios

| Fecha | Acción | Detalles |
|-------|--------|---------|
| 2026-04-20 | Plan inicial creado | Primera evaluación del sistema. Sin planes previos encontrados. 5 líneas definidas. |

---

## Investigación Diaria

### 2026-04-20
**Sistema evaluado:** VidaOS — gestión personal de alimentación, finanzas y stock  
**Rama:** `claude/elegant-maxwell-TkHvt`  
**Hallazgos:**
- No existían documentos de planificación previos
- Último trabajo: módulo Finanzas con edición de centros de costo y sugerencia IA en compras
- Gemini migrado a versión estable `2.5-flash-lite` (1000 RPD)
- Fintoc integrado pero sin categorización automática activa
- README menciona 6 items en backlog pero sin priorización ni roadmap formal

**Decisión:** Crear estructura de planificación en `docs/PLAN.md` con 5 líneas de desarrollo paralelo priorizadas por ratio impacto/esfuerzo.
