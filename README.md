# Sistema Vida

Sistema personal de gestión de alimentación, finanzas y stock.

**Stack:** Next.js 14 · TypeScript · Supabase · Gemini API · Tailwind CSS · Vercel  
**Costo mensual: $0** — 100% en tiers gratuitos.

---

## Prerequisitos

- Node.js 18 o superior (`node --version`)
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Cuenta en [Google AI Studio](https://aistudio.google.com) para la API key de Gemini (gratuita)
- Cuenta en [Vercel](https://vercel.com) para el deploy (gratuita)
- Cuenta en [GitHub](https://github.com) para el repositorio (gratuita)

---

## Instalación local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Elegir región: **South America (São Paulo)** para menor latencia desde Chile
3. Esperar que el proyecto se inicialice (~2 minutos)
4. Ir a **SQL Editor** → pegar y ejecutar el contenido de `supabase-schema.sql`
5. Ir a **Settings → API** → copiar:
   - `Project URL`
   - `anon public key`
   - `service_role key`

### 3. Obtener API key de Gemini

1. Ir a [aistudio.google.com](https://aistudio.google.com)
2. **Get API key** → **Create API key**
3. Copiar la clave (empieza con `AIzaSy...`)
4. **No requiere tarjeta de crédito**
5. Límite gratuito: **1.500 requests/día** con Gemini 2.0 Flash

### 4. Configurar variables de entorno

Editar `.env.local` con tus credenciales reales:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_PROJECT_ID=xxxxxxxxxxxx

# Gemini
GEMINI_API_KEY=AIzaSy...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
AI_DAILY_LIMIT=50
```

> ⚠️ **Nunca subas `.env.local` al repositorio.** Está en `.gitignore`.

### 5. Generar tipos TypeScript desde Supabase

```bash
npm run db:types
```

Esto actualiza `types/database.ts` con el esquema real de tu base de datos. Repetir cada vez que modifiques el esquema.

### 6. Correr en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

---

## Deploy en Vercel

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "feat: initial setup"
git branch -M main
git remote add origin https://github.com/tu-usuario/sistema-vida.git
git push -u origin main
```

### 2. Conectar con Vercel

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repositorio de GitHub
3. En **Environment Variables**, agregar todas las variables de `.env.local`
4. **Deploy**

Vercel detecta Next.js automáticamente. Cada push a `main` despliega automáticamente.

### 3. Configurar Supabase Auth para producción

En Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://tu-proyecto.vercel.app`
- **Redirect URLs:** `https://tu-proyecto.vercel.app/api/auth/callback`

---

## Estructura del proyecto

```
sistema-vida/
├── app/
│   ├── (auth)/          # Rutas públicas (login, onboarding)
│   ├── (app)/           # Rutas protegidas (dashboard, productos, etc.)
│   └── api/             # API Routes serverless
├── components/
│   ├── ui/              # Componentes base sin lógica
│   └── modules/         # Componentes con lógica de negocio
├── lib/
│   ├── supabase/        # Clientes Supabase (browser + server)
│   ├── gemini/          # IA: cliente, prompts, rate limiter
│   ├── db/              # Queries de base de datos
│   └── utils/           # Formatters, lógica compartida
├── hooks/               # React hooks con TanStack Query
├── types/               # TypeScript types (generados desde Supabase)
└── supabase-schema.sql  # SQL completo del esquema
```

---

## Módulos disponibles

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/dashboard` | Métricas, semana actual, alertas de stock |
| Productos | `/productos` | Base de datos con fichas, historial de precios y compras |
| Stock | `/stock` | Inventario, confirmación de compras, historial |
| Planner | `/planner` | Calendario mensual y semanal generado desde el stock |
| Recetas | `/recetas` | Recetario con ingredientes cruzados contra stock |
| Cotización | `/cotizacion` | Comparativa de precios entre proveedores |
| Finanzas | `/finanzas` | Centros de costo y presupuesto mensual |
| Aseo | `/aseo` | Actividades de higiene con registro histórico |

---

## IA de búsqueda de precios

El sistema usa **Gemini 2.0 Flash** con Google Search integrado para buscar precios actuales en Líder, Tottus y Jumbo.

### Uso
1. Ir a la ficha de cualquier producto → **Buscar precios con IA**
2. O desde Cotización → **Actualizar precios con IA** (busca todos los de la cotización)

### Límites (free tier)
- Gemini 2.0 Flash: 1.500 requests/día
- Límite configurado en el sistema: 50 búsquedas/día (ajustable en `.env.local` con `AI_DAILY_LIMIT`)
- El sistema muestra cuántas búsquedas quedan en el día

### Cómo funciona
```
Usuario presiona "Buscar precios"
→ POST /api/ai/search-prices
→ rate-limiter verifica límite diario (tabla ai_usage)
→ Gemini busca en Google: "pechuga pollo precio Líder Chile"
→ Extrae precio, disponibilidad y nivel de confianza
→ Guarda en price_history con source='ai_search'
→ UI actualiza sparklines y tabla de cotización
```

---

## Flujo principal: Cotización → Stock → Planner

```
1. Cotización
   └─ Agrega productos → compara precios → "Enviar a compra pendiente"

2. Stock → Compra pendiente
   └─ Marca ítems recibidos → "Confirmar compra"
   └─ Se crea purchase_order + purchase_items
   └─ Se registra price_history (source='purchase')
   └─ Se actualiza stock (current_qty aumenta)

3. Planner
   └─ Lee stock actualizado
   └─ Marca comidas en verde/rojo según ingredientes disponibles
   └─ Genera lista de compras automáticamente si faltan ingredientes
```

---

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Verificar tipos TypeScript
npm run type-check

# Regenerar tipos desde Supabase
npm run db:types
```

---

## Tiers gratuitos usados

| Servicio | Límite free | Uso estimado |
|----------|-------------|--------------|
| Supabase | 500 MB DB · 5 GB bandwidth | < 10 MB/mes |
| Vercel | 100 GB bandwidth · funciones ilimitadas | < 1 GB/mes |
| Gemini API | 1.500 req/día · 1M tokens/día | ~20 req/semana |
| GitHub | Repositorios privados ilimitados | — |

**Costo mensual total: $0**

---

## Notas de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en API Routes del servidor, nunca llega al cliente.
- `GEMINI_API_KEY` igual — solo server-side.
- Row Level Security (RLS) activo en todas las tablas: cada usuario solo ve sus datos.
- Magic link de Supabase como método de login: sin contraseñas que gestionar.

---

## Próximas iteraciones sugeridas

- [ ] Integración con Fintoc para conectar cuentas bancarias a centros de costo
- [ ] Notificaciones push cuando stock llega al mínimo
- [ ] Exportación del historial a Excel
- [ ] Modo offline con Service Worker
- [ ] App móvil con Capacitor (usa el mismo codebase Next.js)
- [ ] Ajuste automático de macros según día de entrenamiento (con IA)
