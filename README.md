# TicketFlow API

Backend modular para gestionar tickets de soporte, comentarios, usuarios, sesiones y auditoria. El proyecto esta pensado como una API de portfolio con decisiones cercanas a un backend productivo: TypeScript estricto, boundaries por modulo, autenticacion con refresh tokens rotables, RBAC, migraciones, tests y observabilidad con logs, metricas, tracing y alertas.

## Stack

- **Node.js + TypeScript**: runtime simple y tipado estricto para detectar errores temprano.
- **Fastify**: framework HTTP performante, con buen soporte para logging Pino, hooks y TypeScript.
- **Zod**: validacion explicita de payloads, params y query strings en el borde HTTP.
- **PostgreSQL**: base relacional para usuarios, tickets, comentarios, eventos y refresh tokens.
- **Drizzle ORM**: schema tipado, queries explicitas y migraciones versionadas sin esconder SQL.
- **JWT + refresh tokens**: access tokens cortos y sesiones renovables/revocables.
- **bcrypt**: hashing de passwords.
- **Vitest + Faker**: tests de casos de uso con datos realistas y fakes en memoria.
- **Testcontainers + PostgreSQL**: tests de integracion contra una base PostgreSQL real y efimera.
- **Docker Compose**: entorno local reproducible para API, Postgres y observabilidad.
- **Pino + Grafana Alloy + Loki**: logs JSON estructurados, recoleccion de logs Docker y consultas LogQL.
- **Prometheus + prom-client**: metricas RED de HTTP, metricas runtime de Node.js y reglas de alerta.
- **OpenTelemetry + Tempo**: trazas distribuidas exportadas por OTLP HTTP.
- **Grafana**: datasources y alertas provisionadas para logs, metricas y traces.

## Arquitectura

El proyecto usa un **modular monolith** con separacion por dominio:

```txt
src/
  modules/
    auth/
    users/
    tickets/
    comments/
    audit/
  shared/
    config/
    db/
    domain/
    errors/
    http/
    security/
```

Cada modulo se organiza en capas:

- `domain`: tipos, reglas puras y vocabulario del modulo.
- `application`: casos de uso y puertos.
- `infrastructure`: implementaciones Drizzle de repositorios/lookups.
- `routes`: adaptadores HTTP Fastify y validaciones Zod.

Los casos de uso no dependen de Fastify ni de Drizzle. Cuando un modulo necesita leer datos de otro, consume un puerto de lectura dedicado:

- `UserLookup` para permisos/asignaciones.
- `UserAuthLookup` para login, refresh y `/me`.
- `TicketLookup` para comentarios y auditoria.

Esto mantiene los tests simples y evita que los repositorios principales crucen tablas de otros agregados por accidente.

## Dominio

### Roles

- `customer`: crea tickets y comentarios publicos.
- `agent`: gestiona tickets, asignaciones, estados y comentarios internos.
- `admin`: administra usuarios, roles y puede acceder a auditoria.

Las reglas viven en `src/shared/security/permissions.ts`, no dispersas en rutas.

### Tickets

Estados:

- `open`
- `assigned`
- `in_progress`
- `resolved`
- `closed`
- `cancelled`

Prioridades:

- `low`
- `medium`
- `high`
- `critical`

Transiciones permitidas:

- `open -> assigned | cancelled`
- `assigned -> in_progress | cancelled`
- `in_progress -> resolved | cancelled`
- `resolved -> closed`
- `closed` y `cancelled` son finales.

Reglas relevantes:

- Un ticket cerrado o cancelado no puede asignarse.
- Solo `agent` o `admin` pueden asignar tickets.
- El assignee debe ser `agent` o `admin`.
- Solo `agent` o `admin` pueden cambiar estados.
- No se puede mover un ticket a `assigned` o `in_progress` sin usuario asignado.

### Comentarios

Visibilidades:

- `public`: visible para cualquier usuario autenticado que consulte comentarios del ticket.
- `internal`: solo visible para `agent` o `admin`.

Reglas:

- Cualquier usuario autenticado puede crear comentarios publicos.
- Solo `agent` o `admin` pueden crear y ver comentarios internos.
- El ticket y el autor deben existir.

### Auditoria

Eventos soportados:

- `ticket_created`
- `ticket_assigned`
- `ticket_status_changed`
- `comment_added`
- `ticket_closed`

La lectura de eventos requiere `agent` o `admin`.

## Validaciones

Las rutas validan entradas con Zod:

- UUIDs en params (`:id`, `actorId`, `ticketId`, etc.).
- Emails validos en auth.
- Password entre 8 y 72 caracteres, con al menos una letra y un numero.
- Nombre de usuario entre 5 y 50 caracteres.
- Titulo de ticket entre 1 y 200 caracteres.
- Descripcion y comentarios entre 1 y 4000 caracteres.
- Enums estrictos para roles, estados, prioridades, visibilidad y tipos de evento.
- Query params de auditoria con fechas coercionadas y rango `from <= to`.
- Objetos `.strict()`: campos extra en payloads no son aceptados.

Errores de aplicacion usan clases compartidas (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`) y el error handler evita exponer stack traces al cliente.

## Autenticacion y sesiones

Endpoints principales:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /me`

Decisiones:

- Passwords hasheadas con bcrypt.
- Access token JWT firmado con `JWT_ACCESS_TOKEN_SECRET`.
- Refresh tokens aleatorios, almacenados solo como hash SHA-256.
- Refresh token rotation: cada refresh revoca el token anterior y crea uno nuevo.
- Reuse detection: si se reutiliza un refresh token revocado, se revocan todas las sesiones del usuario.
- Rate limit en memoria para login/register: 10 requests por minuto por IP.
- Mensajes de auth invalidos son genericos.

## API

Todas las rutas protegidas usan:

```http
Authorization: Bearer <access-token>
```

Las respuestas exitosas devuelven el recurso dentro de `data`, salvo `204 No Content`.

### Healthcheck

```http
GET /healtcheck
```

> Nota: la ruta actual conserva el nombre existente `/healtcheck`.

### Auth

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
GET /me
```

Ejemplo:

```sh
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ana@example.com",
    "name": "Ana Admin",
    "password": "secret123"
  }'
```

### Tickets

```http
POST /tickets
GET /tickets
GET /tickets?priority=high&status=open
GET /tickets/:id
PATCH /tickets/:id/assign
PATCH /tickets/:id/status
```

Crear ticket:

```sh
curl -s -X POST http://localhost:3000/tickets \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "No puedo iniciar sesion",
    "description": "El usuario ve un error al intentar iniciar sesion.",
    "priority": "high"
  }'
```

Asignar ticket:

```sh
curl -s -X PATCH http://localhost:3000/tickets/$TICKET_ID/assign \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "assignedTo": "'$AGENT_ID'" }'
```

Cambiar estado:

```sh
curl -s -X PATCH http://localhost:3000/tickets/$TICKET_ID/status \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress" }'
```

### Comments

```http
POST /tickets/:id/comments
GET /tickets/:id/comments
```

Crear comentario interno:

```sh
curl -s -X POST http://localhost:3000/tickets/$TICKET_ID/comments \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "El agente esta revisando logs internos.",
    "visibility": "internal"
  }'
```

### Users

```http
GET /users
GET /users?role=agent
GET /users/:id
PATCH /users/:id/role
```

Cambiar rol:

```sh
curl -s -X PATCH http://localhost:3000/users/$USER_ID/role \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "role": "agent" }'
```

### Audit

```http
GET /audit/events
GET /audit/events?ticketId=<uuid>&eventType=ticket_assigned
GET /audit/events?from=2026-01-01&to=2026-01-31
GET /tickets/:id/events
```

## Base de datos

Tablas:

- `users`
- `tickets`
- `ticket_comments`
- `ticket_events`
- `refresh_tokens`

Indices relevantes:

- refresh tokens por hash y user id.
- tickets por status, priority, created_by y assigned_to.
- comments por ticket id.
- audit events por ticket id, actor id y event type.

Comandos:

```sh
pnpm db:generate
pnpm db:migrate
```

## Entorno local

Requisitos:

- Node.js compatible con el proyecto.
- pnpm 11.
- Docker y Docker Compose.

Instalar dependencias:

```sh
pnpm install
```

Levantar API + Postgres:

```sh
docker compose up -d db api
```

Levantar stack completo:

```sh
docker compose up -d db api loki alloy grafana
```

Verificar:

```sh
curl http://localhost:3000/healtcheck
```

Puertos por defecto:

- API: `3000`
- PostgreSQL: `5432`
- Loki: `3100`
- Alloy: `12345`
- Grafana: `3001`
- Prometheus: `9090`
- Tempo: `3200`
- OTLP HTTP: `4318`

## Variables de entorno

Principales:

- `API_PORT`: puerto HTTP de la API. Default local: `3000`.
- `DATABASE_URL`: connection string de PostgreSQL.
- `JWT_ACCESS_TOKEN_SECRET`: secreto HS256, minimo 32 caracteres.
- `ACCESS_TOKEN_EXPIRES_IN_SECONDS`: default `900`.
- `REFRESH_TOKEN_EXPIRES_IN_DAYS`: default `30`.
- `NODE_ENV`: `development`, `production` o `test`.
- `LOG_LEVEL`: `trace`, `debug`, `info`, `warn`, `error`, `fatal` o `silent`.
- `SERVICE_NAME`: default `ticketflow-api`.
- `METRICS_ENABLED`: expone `/metrics`. Default `true`.
- `TRACING_ENABLED`: activa OpenTelemetry. En Docker Compose queda activo por defecto.
- `OTEL_TRACE_EXPORTER_URL`: endpoint OTLP HTTP. En Compose: `http://tempo:4318/v1/traces`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: usados por Docker Compose.
- `GRAFANA_PORT`: default `3001`.
- `GRAFANA_ADMIN_PASSWORD`: default local `admin`.
- `GRAFANA_ANONYMOUS_ENABLED`: default `false`.

## Tests y calidad

```sh
pnpm lint
pnpm build
pnpm test:run
pnpm test:coverage
```

Cobertura actual:

- Tests unitarios de casos de uso para `auth`, `users`, `tickets`, `comments` y `audit`.
- Repositorios/lookups fake en memoria para validar reglas sin depender de Postgres.
- Tests HTTP de integracion con `app.inject()` de Fastify para auth, users, tickets, comments y audit.
- Cobertura HTTP de validacion, autenticacion, permisos, rotacion/reuso de refresh tokens, logout/logout-all, filtros y visibilidad de comentarios internos.
- Tests de repositorios y lookups Drizzle contra PostgreSQL real con Testcontainers.
- Cobertura Drizzle de conflictos, cambios de rol, filtros de usuarios/tickets/auditoria, lookups, comentarios, eventos y refresh tokens expirados/revocados.
- Migraciones ejecutadas contra la base efimera antes de correr integracion.

Pendiente recomendado:

- CI con lint, build, tests y Postgres de integracion.
- Publicar documentacion OpenAPI o coleccion HTTP.
- Agregar casos borde adicionales segun evolucione la API.

## Observabilidad

La API emite logs JSON con Pino/Fastify, metricas Prometheus en `/metrics` y trazas OpenTelemetry por OTLP HTTP. Docker Compose levanta Loki, Grafana Alloy, Prometheus, Tempo y Grafana.

Datasources provisionados en Grafana:

- Loki para logs.
- Prometheus para metricas y alertas.
- Tempo para trazas.

Alertas provisionadas:

- Errores 5xx.
- Abuso de auth desde eventos Loki.
- Degradacion de latencia p95.

Consultar logs:

```logql
{service="ticketflow-api"}
```

Errores:

```logql
{service="ticketflow-api", level="error"}
```

Eventos de auth:

```logql
{service="ticketflow-api"} | json | event =~ "auth.*"
```

Mas detalle en [docs/observability.md](docs/observability.md).

## Documentacion adicional

- [Observability](docs/observability.md)
- [Remaining work](docs/remaining-work.md)
