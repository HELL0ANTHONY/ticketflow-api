# TicketFlow API

Un backend para gestionar tickets internos de soporte, incidencias o solicitudes.

**Ejemplo de dominio**:

Un usuario crea un ticket. Un agente lo toma, lo cambia de estado, comenta avances, lo resuelve o lo cierra. Cada cambio importante queda auditado y puede disparar eventos internos.

## Stack recomendado

```txt
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Docker + Docker Compose
- JWT
- Migrations
- Tests de integración
- GitHub Actions
- Logs estructurados con Pino
```

> [!important] Express vs. Fastify
>
> Entre Express y Fastify, para este proyecto elegiría Fastify, porque ya viene muy alineado con APIs modernas: validación por schema, buen rendimiento, logging con Pino y una estructura más ordenada.

## Qué arquitectura podrías practicar

Este proyecto es ideal para una arquitectura tipo:

Modular Monolith + Clean Architecture

No necesitas microservicios todavía. Podés organizar el backend por módulos de negocio, pero separando responsabilidades.

Ejemplo:

```txt
src/
modules/
auth/
application/
domain/
infrastructure/
routes/

    users/
      application/
      domain/
      infrastructure/
      routes/

    tickets/
      application/
      domain/
      infrastructure/
      routes/

    comments/
      application/
      domain/
      infrastructure/
      routes/

    audit/
      application/
      domain/
      infrastructure/
      routes/

shared/
db/
http/
errors/
logger/
config/
security/

main.ts
```

Esto encaja con lo que venías preguntando: no separar solo por controllers, routes, services, sino por propósito del negocio.

**Ese estilo suele llamarse**:

- feature-based architecture
- domain-based structure
- modular architecture
- vertical slice architecture
- o, si separás bien dominio/aplicación/infraestructura, Clean Architecture o Hexagonal Architecture

## Módulos del proyecto

Podrías tener estos módulos:

### 1. Auth

Responsabilidades:

Registro de usuarios
Login
JWT
Hash de password
Middleware de autenticación
Roles básicos

Roles:

admin
agent
customer

### 2. Users

Responsabilidades:

Crear usuarios
Listar usuarios
Obtener perfil
Cambiar rol, solo admin

### 3. Tickets

Responsabilidades:

Crear ticket
Listar tickets
Buscar por estado, prioridad, usuario o agente
Asignar ticket
Cambiar estado
Cerrar ticket

Estados posibles:

open
assigned
in_progress
resolved
closed
cancelled

Prioridades:

low
medium
high
critical

### 4. Comments

Responsabilidades:

Agregar comentarios a un ticket
Listar comentarios
Diferenciar comentarios públicos e internos

Ejemplo:

customer puede ver comentarios públicos
agent/admin puede ver comentarios internos

### 5. Audit Log

Cada acción importante debería generar un registro:

ticket_created
ticket_assigned
ticket_status_changed
comment_added
ticket_closed

Esto suma mucho porque te obliga a pensar en arquitectura y trazabilidad.

## Modelo de base de datos inicial

Tablas principales:

users
tickets
ticket_comments
ticket_events
refresh_tokens

Ejemplo conceptual:

users

- id
- name
- email
- password_hash
- role
- created_at

tickets

- id
- title
- description
- status
- priority
- created_by
- assigned_to
- created_at
- updated_at
- closed_at

ticket_comments

- id
- ticket_id
- author_id
- body
- visibility
- created_at

ticket_events

- id
- ticket_id
- actor_id
- event_type
- metadata
- created_at
  Endpoints posibles
  POST /auth/register
  POST /auth/login
  GET /me

GET /users
GET /users/:id

POST /tickets
GET /tickets
GET /tickets/:id
PATCH /tickets/:id/assign
PATCH /tickets/:id/status
DELETE /tickets/:id

POST /tickets/:id/comments
GET /tickets/:id/comments

GET /tickets/:id/events

## Docker Compose

Tu docker-compose.yml podría levantar:

api
postgres
test-db

Después podrías sumar opcionalmente:

pgadmin
worker

Una versión inicial profesional sería:

api -> Node + Fastify + TS
db -> PostgreSQL
test-db -> PostgreSQL separado para tests de integración
Parte interesante de arquitectura

Para que no sea solo CRUD, agregaría estas reglas:

## Reglas de negocio

Un ticket cerrado no puede volver a in_progress.
Solo un agent o admin puede asignar tickets.
Un customer solo puede ver sus propios tickets.
Un agent puede ver tickets asignados a él.
Un admin puede ver todos.
Cada cambio de estado debe generar un evento de auditoría.

Esto te obliga a separar lógica de negocio de la capa HTTP.

## Patrón recomendado: Use Cases

Ejemplo:

CreateTicketUseCase
AssignTicketUseCase
ChangeTicketStatusUseCase
AddTicketCommentUseCase
ListTicketsUseCase
LoginUserUseCase

La ruta HTTP no debería tener la lógica principal.

Ejemplo conceptual:

```js
fastify.post("/tickets", async (request, reply) => {
  const result = await createTicketUseCase.execute({
    title: request.body.title,
    description: request.body.description,
    userId: request.user.id,
  });

  return reply.code(201).send(result);
});
```

La lógica real vive en el caso de uso.

Patrón extra recomendado: Outbox Pattern

Cuando tengas la base funcionando, podés agregar algo más avanzado:

ticket_events_outbox

Cada vez que ocurre algo importante, guardás un evento en la DB:

TicketCreated
TicketAssigned
TicketResolved

Luego un worker lee esos eventos y los procesa.

Por ejemplo:

Enviar email
Crear notificación
Actualizar métricas

Esto te permite practicar una idea cercana a arquitectura event-driven sin meter Kafka, RabbitMQ o AWS desde el principio.

Roadmap por etapas
Etapa 1 — Base del proyecto
Node + TS
Fastify
Dockerfile
Docker Compose
PostgreSQL
Healthcheck

Resultado:

GET /health
Etapa 2 — Base de datos
Conexión a PostgreSQL
Migrations
Tabla users
Tabla tickets

Podrías usar:

Prisma
Drizzle
Knex
node-postgres puro

Para aprender más SQL real, yo usaría node-postgres + migrations SQL o Drizzle. Prisma es cómodo, pero oculta bastante SQL.

Etapa 3 — Auth
Register
Login
Password hashing
JWT
Middleware de autenticación
Roles
Etapa 4 — Tickets
Crear ticket
Listar tickets
Ver detalle
Cambiar estado
Asignar ticket
Validaciones de negocio
Etapa 5 — Comments + Audit
Comentarios por ticket
Eventos de auditoría
Historial del ticket

Esta parte hace que el proyecto empiece a parecer profesional.

Etapa 6 — Tests

Tests de integración para:

POST /auth/login
POST /tickets
PATCH /tickets/:id/status
GET /tickets/:id/events

Usaría una DB separada en Docker para tests.

Etapa 7 — GitHub Actions

Pipeline:

npm ci
npm run lint
npm run typecheck
npm test
docker build
Etapa 8 — Logs estructurados

Con Fastify + Pino:

{
"level": "info",
"requestId": "abc-123",
"userId": "user-1",
"ticketId": "ticket-9",
"event": "ticket_status_changed"
}
Nombre técnico del proyecto para CV / GitHub

Podrías presentarlo así:

TicketFlow API — Modular backend for ticket management built with Node.js, TypeScript, Fastify, PostgreSQL and Docker. Includes JWT authentication, role-based access control, integration tests, structured logging and CI pipeline.

En español:

TicketFlow API — Backend modular para gestión de tickets construido con Node.js, TypeScript, Fastify, PostgreSQL y Docker. Incluye autenticación JWT, control de acceso por roles, tests de integración, logs estructurados y pipeline CI.

Mi recomendación concreta

Haría este proyecto:

Backend de Tickets con arquitectura modular

Con estas decisiones:

Framework: Fastify
DB: PostgreSQL
Lenguaje: TypeScript
Arquitectura: Modular Monolith + Clean Architecture
ORM/query: Drizzle o node-postgres
Auth: JWT
Testing: Vitest o Jest + Supertest/Inject de Fastify
Logs: Pino
Infra local: Docker Compose
CI: GitHub Actions

Y evitaría arrancar con microservicios, colas, Kubernetes o AWS. Primero haría un backend sólido, bien testeado, dockerizado y con buena separación interna. Después podés evolucionarlo agregando worker, outbox pattern, notificaciones y métricas.
