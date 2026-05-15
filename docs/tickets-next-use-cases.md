# Ticket Use Cases - Implementation Guide

Esta nota describe cómo implementar los próximos casos de uso del módulo `tickets` siguiendo la estructura actual del proyecto.

El objetivo no es agregar lógica en las rutas, sino mantener el patrón actual:

```txt
src/modules/tickets/
  domain/
  application/
  application/ports/
  infrastructure/
  routes/
```

## Estado actual del módulo

Actualmente existen:

- `POST /tickets` para crear tickets.
- `GET /tickets` para listar tickets.
- `CreateTicketUseCase`.
- `ListTicketsUseCase`.
- `TicketRepository` como puerto de aplicación.
- `DrizzleTicketRepository` como implementación de infraestructura.
- `ticket_created` en `ticket_events` al crear un ticket.

La ruta HTTP valida input con Zod y llama al caso de uso. El repositorio Drizzle se encarga de consultar o modificar la base.

## Reglas generales para los próximos casos

Aplicar estas reglas en los tres casos:

- La ruta solo debe validar input, armar el DTO del caso de uso y responder.
- La lógica de negocio debe vivir en un `UseCase`.
- El acceso a DB debe vivir en `DrizzleTicketRepository`.
- Los contratos deben agregarse al puerto `TicketRepository`.
- Los tipos compartidos deben agregarse en `domain/ticket.ts`.
- Los errores de negocio deben usar clases en `shared/errors/application-error.ts`.
- Las operaciones que modifican ticket y crean evento deben usar transacción.
- Después de implementar, correr:

```bash
pnpm lint
pnpm build
```

Si probás contra Docker Compose:

```bash
docker compose --env-file .env.local up -d --build api
pnpm db:migrate
```

## 1. Obtener ticket por ID

### Endpoint esperado

```txt
GET /tickets/:id
```

### Objetivo

Devolver un ticket específico por su `id`.

### Archivos a tocar

- `src/modules/tickets/domain/ticket.ts`
- `src/modules/tickets/application/ports/ticket-repository.ts`
- `src/modules/tickets/application/get-ticket-by-id.use-case.ts`
- `src/modules/tickets/infrastructure/drizzle-ticket.repository.ts`
- `src/modules/tickets/routes/ticket.routes.ts`
- `src/shared/errors/application-error.ts`

### Validaciones HTTP

En la ruta, validar `params` con Zod:

- `id` debe ser UUID válido.
- No aceptar parámetros extra si usás `.strict()`.

Si el `id` no es UUID válido, debe responder `400 validation_error` por el error handler actual.

### Validaciones de negocio

En el caso de uso:

- Buscar el ticket por ID.
- Si no existe, lanzar `NotFoundError`.

Agregar `NotFoundError` en `shared/errors/application-error.ts` con status `404`.

### Repositorio

Agregar al puerto:

```txt
findById(id): Promise<Ticket | null>
```

En Drizzle:

- Consultar `tickets` por `tickets.id`.
- Devolver `Ticket` si existe.
- Devolver `null` si no existe.

### Respuesta esperada

Si existe:

```json
{
  "data": {
    "id": "...",
    "title": "...",
    "description": "...",
    "status": "open",
    "priority": "medium",
    "createdBy": "...",
    "assignedTo": null,
    "createdAt": "...",
    "updatedAt": "...",
    "closedAt": null
  }
}
```

Si no existe:

```json
{
  "error": "NotFoundError",
  "message": "Ticket not found"
}
```

## 2. Asignar ticket

### Endpoint esperado

```txt
PATCH /tickets/:id/assign
```

### Objetivo

Asignar un ticket a un usuario agente o administrador.

Hasta que exista Auth, enviar también `actorId` en el body para representar al usuario que ejecuta la acción.

### Body sugerido

```json
{
  "assignedTo": "uuid-del-agente",
  "actorId": "uuid-del-usuario-que-asigna"
}
```

### Archivos a tocar

- `src/modules/tickets/domain/ticket.ts`
- `src/modules/tickets/application/ports/ticket-repository.ts`
- `src/modules/tickets/application/assign-ticket.use-case.ts`
- `src/modules/tickets/infrastructure/drizzle-ticket.repository.ts`
- `src/modules/tickets/routes/ticket.routes.ts`
- `src/shared/errors/application-error.ts`

### Validaciones HTTP

Validar `params`:

- `id` debe ser UUID válido.

Validar body:

- `assignedTo` debe ser UUID válido.
- `actorId` debe ser UUID válido.
- No aceptar campos extra.

### Validaciones de negocio

En el caso de uso:

- El ticket debe existir.
- El usuario `assignedTo` debe existir.
- `assignedTo` debe tener rol `agent` o `admin`.
- El `actorId` debe existir.
- El `actorId` debe tener rol `agent` o `admin`.
- No permitir asignar tickets con estado `closed` o `cancelled`.

Decisión recomendada:

- Si el ticket está `open`, al asignarlo cambiar `status` a `assigned`.
- Si el ticket ya está `assigned` o `in_progress`, mantener su estado y solo actualizar `assignedTo`.

### Errores esperados

Agregar o reutilizar errores:

- `NotFoundError` para ticket inexistente.
- `NotFoundError` para usuario inexistente, con mensaje claro.
- `ForbiddenError` si `actorId` no puede asignar tickets.
- `ValidationError` o `ConflictError` si `assignedTo` no puede recibir tickets por rol.
- `ConflictError` si el ticket está cerrado o cancelado.

Status sugeridos:

- `404`: recurso inexistente.
- `403`: usuario autenticado/actor sin permiso.
- `409`: acción incompatible con el estado actual del ticket.

### Repositorio

Para implementar limpio, el puerto puede exponer métodos como:

```txt
findById(id): Promise<Ticket | null>
findUserById(id): Promise<UserSummary | null>
assign(input): Promise<Ticket>
```

`UserSummary` puede vivir en el dominio de tickets por ahora como tipo mínimo:

```txt
id
role
```

Más adelante, cuando exista módulo `users`, ese contrato debería moverse o formalizarse mejor.

En Drizzle:

- Hacer la operación en transacción.
- Actualizar `assigned_to`.
- Actualizar `status` a `assigned` solo si corresponde.
- Actualizar `updated_at`.
- Insertar evento `ticket_assigned`.

Metadata sugerida del evento:

```json
{
  "assignedTo": "...",
  "previousAssignedTo": "...",
  "previousStatus": "...",
  "newStatus": "..."
}
```

### Respuesta esperada

```json
{
  "data": {
    "id": "...",
    "assignedTo": "...",
    "status": "assigned"
  }
}
```

Puede devolver el ticket completo, siguiendo el formato actual.

## 3. Cambiar estado del ticket

### Endpoint esperado

```txt
PATCH /tickets/:id/status
```

### Objetivo

Cambiar el estado de un ticket respetando reglas de negocio.

Hasta que exista Auth, enviar `actorId` en el body.

### Body sugerido

```json
{
  "status": "in_progress",
  "actorId": "uuid-del-usuario-que-cambia-el-estado"
}
```

### Archivos a tocar

- `src/modules/tickets/domain/ticket.ts`
- `src/modules/tickets/application/ports/ticket-repository.ts`
- `src/modules/tickets/application/change-ticket-status.use-case.ts`
- `src/modules/tickets/infrastructure/drizzle-ticket.repository.ts`
- `src/modules/tickets/routes/ticket.routes.ts`
- `src/shared/errors/application-error.ts`

### Validaciones HTTP

Validar `params`:

- `id` debe ser UUID válido.

Validar body:

- `status` debe ser uno de:
  - `open`
  - `assigned`
  - `in_progress`
  - `resolved`
  - `closed`
  - `cancelled`
- `actorId` debe ser UUID válido.
- No aceptar campos extra.

### Validaciones de negocio

En el caso de uso:

- El ticket debe existir.
- El `actorId` debe existir.
- Solo `agent` o `admin` pueden cambiar estado por ahora.
- No permitir cambios desde `closed`.
- No permitir cambios desde `cancelled`.
- No permitir volver de `resolved` a `in_progress` si decidís tratar `resolved` como estado casi final.
- No permitir pasar a `assigned` si `assignedTo` es `null`.
- No permitir pasar a `in_progress` si `assignedTo` es `null`.
- Si el nuevo estado es `closed`, setear `closedAt`.
- Si el nuevo estado no es `closed`, no tocar `closedAt` salvo que definas explícitamente reapertura en el futuro.

Regla mínima recomendada de transiciones:

```txt
open -> assigned | cancelled
assigned -> in_progress | cancelled
in_progress -> resolved | cancelled
resolved -> closed
closed -> no permite cambios
cancelled -> no permite cambios
```

Esta regla puede vivir en una función de dominio, por ejemplo:

```txt
canTransitionTicketStatus(from, to): boolean
```

No pongas esa regla directamente en la ruta.

### Errores esperados

- `NotFoundError` si el ticket no existe.
- `NotFoundError` si el actor no existe.
- `ForbiddenError` si el actor no puede cambiar estados.
- `ConflictError` si la transición de estado no está permitida.
- `ConflictError` si se intenta pasar a `assigned` o `in_progress` sin `assignedTo`.

### Repositorio

Agregar al puerto un método de actualización de estado, por ejemplo:

```txt
changeStatus(input): Promise<Ticket>
```

En Drizzle:

- Hacer la operación en transacción.
- Leer el estado actual del ticket.
- Actualizar `status`.
- Actualizar `updated_at`.
- Setear `closed_at` si el nuevo estado es `closed`.
- Insertar evento `ticket_status_changed`.

Metadata sugerida:

```json
{
  "previousStatus": "assigned",
  "newStatus": "in_progress"
}
```

### Respuesta esperada

```json
{
  "data": {
    "id": "...",
    "status": "in_progress",
    "updatedAt": "..."
  }
}
```

Puede devolver el ticket completo, siguiendo el formato actual.

## Orden recomendado de implementación

Implementar en este orden:

1. `GET /tickets/:id`
2. `PATCH /tickets/:id/assign`
3. `PATCH /tickets/:id/status`

Razón:

- Obtener por ID introduce `NotFoundError` y `findById`.
- Asignar reutiliza `findById`, agrega usuarios mínimos y eventos.
- Cambiar estado reutiliza ticket existente, roles y reglas de transición.

## Checklist final por caso

Antes de cerrar cada caso:

- La ruta valida `params`, `body` o `query` con Zod.
- El caso de uso contiene la decisión de negocio.
- El repositorio solo consulta o persiste datos.
- Los errores esperados devuelven `400`, `403`, `404` o `409`, no `500`.
- Las modificaciones con evento usan transacción.
- Se registra evento en `ticket_events` cuando hay cambio importante.
- `pnpm lint` pasa.
- `pnpm build` pasa.
- Probaste con `curl` o herramienta equivalente.
