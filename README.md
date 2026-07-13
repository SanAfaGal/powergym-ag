# PowerGym AG

Panel administrativo para la gestión de un gimnasio: clientes, planes de
membresía, suscripciones y pagos, cuentas bancarias, staff y un dashboard
de indicadores.

Construido con [Next.js](https://nextjs.org) (App Router) y
[Supabase](https://supabase.com) (Postgres, Auth, RLS). La lógica de
negocio vive en la base de datos (RPCs de Postgres) y en `src/modules/*`;
ver [`CLAUDE.md`](./CLAUDE.md) para el detalle de arquitectura y
convenciones del proyecto.

## Stack

- **Next.js 16** (App Router, Server Components + Server Actions)
- **Supabase**: Postgres, Auth, Row-Level Security
- **TypeScript**, **Tailwind CSS v4**, `shadcn`/`@base-ui` primitives
- **react-hook-form** + **zod** para formularios
- **pgTAP** para tests de base de datos, **Playwright** para e2e

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io) (versión fijada en `packageManager`)
- [Docker](https://www.docker.com) (para correr Supabase localmente)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (instalado como dev dependency, se invoca vía `pnpm`)

## Empezar

```bash
pnpm install

# Levanta Postgres/Auth/Storage local en Docker
pnpm db:start

# Aplica todas las migraciones y carga supabase/seed.sql
pnpm db:reset

pnpm dev
```

La app queda en [http://localhost:3000](http://localhost:3000). Las
credenciales de los usuarios sembrados por `supabase/seed.sql` están
documentadas en ese mismo archivo (y en `tests/e2e/auth.spec.ts`).

### Variables de entorno

Copiá `.env.local.example` a `.env.local`. Los valores por defecto ya
apuntan a la instancia local de Supabase levantada por `pnpm db:start`
(las claves las imprime ese mismo comando).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | ESLint |
| `pnpm db:start` / `pnpm db:stop` | Levanta/detiene Supabase local (Docker) |
| `pnpm db:reset` | Re-aplica migraciones + `seed.sql` contra la BD local |
| `pnpm db:test` | Corre los tests pgTAP en `supabase/tests/database/` |
| `pnpm test:e2e` | Corre los tests Playwright (levanta `pnpm dev` automáticamente si hace falta) |

## Base de datos

- `supabase/migrations/` — migraciones secuenciales, numeradas y con un
  cambio lógico por archivo. Nunca se editan las ya aplicadas; los
  cambios de esquema van en una migración nueva.
- `supabase/schema.dbml` — snapshot del esquema, mantenido a mano. Ver
  [dbdiagram.io](https://dbdiagram.io) (pegar el archivo) para
  visualizarlo.
- `supabase/tests/database/` — tests pgTAP, numerados para corresponder
  aproximadamente con las migraciones.
- `supabase/seed.sql` — datos de desarrollo local únicamente.

Las reglas de negocio (invariantes, validaciones, transiciones de
estado) viven como funciones/RPCs de Postgres, no en el código TypeScript
— son la fuente de verdad, con RLS como capa de autorización.

## Estructura del proyecto

```
src/
  app/(dashboard)/    # Rutas (App Router), delgadas — llaman a los módulos
  modules/            # Lógica de negocio por dominio (schema/queries/actions/components)
  components/ui/      # Primitivas shadcn, sin lógica de negocio
  components/shared/  # Composición reusable entre módulos
  components/layout/  # Chrome de la app (sidebar, header)
  lib/                # Clientes de Supabase, utilidades
supabase/
  migrations/         # Esquema y RPCs
  tests/database/     # Tests pgTAP
tests/e2e/             # Tests Playwright
```

Ver [`CLAUDE.md`](./CLAUDE.md) para el patrón exacto de cada módulo,
convenciones de server actions, y capas de autenticación.

## Despliegue

Configurado para [Netlify](https://www.netlify.com) vía
[`netlify.toml`](./netlify.toml) (`@netlify/plugin-nextjs`). Requiere las
mismas variables de entorno que en local, apuntando al proyecto de
Supabase en producción.
