# Plan de Evolución — Sistema Vida

**Última actualización:** 2026-04-20  
**Estado del sistema:** Estable · v0.1 · $0/mes  
**Investigación diaria:** No existe (primera evaluación)

---

## Estado Actual

| Módulo | Estado |
|--------|--------|
| Dashboard | ✅ Funcional |
| Productos | ✅ Funcional |
| Stock | ✅ Funcional |
| Planner | ✅ Funcional |
| Recetas | ✅ Funcional |
| Cotización | ✅ Funcional |
| Finanzas | ✅ Funcional (edición de centros, modo Ahorros, sugerencia IA) |
| Aseo | ✅ Funcional |
| Banco/Fintoc | ⚠️ Integración parcial |
| Agente IA | ⚠️ Básico (historial, deshacer) |
| Boleta OCR | ⚠️ En desarrollo |

**Stack:** Next.js 14 · TypeScript · Supabase · Gemini 2.5-flash · Tailwind · Vercel  
**Modelos IA:** gemini-2.5-flash-lite (búsquedas) · gemini-2.5-flash (agente)

---

## 5 Líneas de Desarrollo Paralelas

### L1 · Inteligencia Aumentada del Agente
**Impacto:** 🔴 Alto  
Convertir el agente de reactivo a proactivo: memoria persistente entre sesiones, resúmenes diarios automáticos, alertas inteligentes (stock bajo, presupuesto excedido, patrones de gasto).

### L2 · Captura Automática de Datos
**Impacto:** 🔴 Alto  
Eliminar entrada manual: OCR de boletas completamente funcional, sincronización bancaria real vía Fintoc, lectura automática de precios sin acción del usuario.

### L3 · Nutrición y Salud Personalizada
**Impacto:** 🟠 Medio-Alto  
Cruzar recetas con objetivos corporales del perfil de usuario (peso, meta, nivel de actividad), calcular macros reales consumidos, ajustar plan alimenticio por día de entrenamiento.

### L4 · Movilidad y Acceso Offline
**Impacto:** 🟠 Medio-Alto  
PWA con Service Worker para uso sin internet, notificaciones push nativas, instalación en home screen. Base para futura app Capacitor.

### L5 · Automatización y Reportes
**Impacto:** 🟡 Medio  
Exportación automática a Excel/PDF, reportes mensuales de finanzas, historial comparativo de precios entre períodos, proyección de gastos.

---

## Propuestas por Plazo

### Corto Plazo (0–4 semanas)

| # | Propuesta | Línea | Impacto | Esfuerzo |
|---|-----------|-------|---------|----------|
| C1 | **OCR de Boletas completo**: finalizar extracción de ítems, precios y totales desde foto de boleta. Registrar en stock y finanzas automáticamente. | L2 | Alto | 1–2 sem |
| C2 | **Agente con memoria**: guardar contexto de conversación en Supabase, que el agente recuerde preferencias y decisiones anteriores del usuario. | L1 | Alto | 1 sem |

### Mediano Plazo (1–3 meses)

| # | Propuesta | Línea | Impacto | Esfuerzo |
|---|-----------|-------|---------|----------|
| M1 | **Resumen diario IA**: al abrir el dashboard, el agente analiza stock, finanzas y planner y genera un briefing personalizado del día. | L1 | Alto | 2 sem |
| M2 | **Macros y nutrición**: calcular calorías/proteínas/carbos/grasas de cada receta cruzando con perfil del usuario. Semáforo nutricional en el planner. | L3 | Medio-Alto | 3 sem |
| M3 | **PWA offline**: Service Worker con cache de datos críticos (stock, recetas, planner), notificaciones push para alertas de stock. | L4 | Medio | 2 sem |

### Largo Plazo (3–6 meses)

| # | Propuesta | Línea | Impacto | Esfuerzo |
|---|-----------|-------|---------|----------|
| LP1 | **Sincronización bancaria real**: completar integración Fintoc para importar transacciones y clasificarlas automáticamente en centros de costo. | L2 | Alto | 4 sem |
| LP2 | **Reportes automáticos mensuales**: PDF/Excel con resumen de finanzas, variación de precios, cumplimiento de recetas y métricas de stock. | L5 | Medio | 3 sem |
| LP3 | **Ajuste dinámico por entrenamiento**: integrar calendario de entrenamiento, ajustar macros objetivo y generar plan alimenticio diferenciado por día de la semana. | L3 | Alto | 5 sem |

---

## Matriz Impacto / Esfuerzo

```
IMPACTO
  Alto │ C2  C1  M1       LP1  LP3
       │          M2
 Medio │              M3        LP2
       │
  Bajo │
       └────────────────────────────
         Días  1sem  2sem  1mes  3mes
                         ESFUERZO
```

---

## Próxima Acción Recomendada

**Iniciar C2 (Agente con memoria)** — mayor retorno por esfuerzo: una semana de trabajo, impacto transversal en todos los módulos. El agente contextualizado puede acelerar el uso de todas las demás funcionalidades.

---

## Registro de Evaluaciones

| Fecha | Notas |
|-------|-------|
| 2026-04-20 | Primera evaluación. Sin plan previo. Sistema estable en todos los módulos core. Boleta OCR y Fintoc pendientes de completar. Se definen 5 líneas paralelas de desarrollo. |
