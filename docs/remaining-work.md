# Remaining Work

Esta nota lista las tareas pendientes principales para llevar la API a un estado más completo y consistente.

## Prioridad recomendada

1. Agregar migrations e índices mínimos.
2. Agregar tests de integración para flujos principales.
3. Configurar CI.
4. Documentar la API.
5. Endurecer Auth y RBAC.

## 1. Tests

Agregar cobertura en tres niveles:

- Unit tests para casos de uso de `auth`, `users`, `tickets`, `comments` y `audit`.
- Integration tests HTTP con Fastify.
- Integration tests contra PostgreSQL para repositorios Drizzle.

Casos críticos a cubrir:

- Registro y login.
- Login inválido.
- Refresh token válido.
- Refresh token rotado.
- Logout.
- Permisos por rol.
- Cambio de rol solo por admin.
- Creación de tickets.
- Asignación de tickets.
- Cambio de estado de tickets.
- Comentarios públicos.
- Comentarios internos visibles solo para agent/admin.
- Lectura de eventos de audit.

## 2. Auth aplicado al resto de módulos

Auth ya se aplica en los módulos principales. Los endpoints que antes recibían identificadores de usuario en body o query ahora usan el usuario autenticado.

Estado actual:

- `POST /tickets`: usa el usuario autenticado como `createdBy`.
- `PATCH /tickets/:id/assign`: usa el usuario autenticado como `actorId`.
- `PATCH /tickets/:id/status`: usa el usuario autenticado como `actorId`.
- `POST /tickets/:id/comments`: usa el usuario autenticado como `authorId`.
- `GET /tickets/:id/comments`: usa el usuario autenticado para decidir visibilidad.
- `PATCH /users/:id/role`: usa el usuario autenticado para validar si es admin.
- `GET /audit/events` y `GET /tickets/:id/events`: requieren rol `admin` o `agent`.

## 3. Middleware o plugin de Auth

Centralizar la lectura y validación del token.

Objetivo:

- Evitar llamadas manuales repetidas a `getAuthenticatedUser(request)`.
- Decorar el request con el usuario autenticado.
- Tener helpers reutilizables para permisos.

Ejemplos de helpers:

```ts
requireAuth(request);
requireRole(request, ["admin"]);
requireRole(request, ["admin", "agent"]);
```

## 4. RBAC consistente

Definir reglas de permisos en un lugar claro.

Roles actuales:

- `customer`
- `agent`
- `admin`

Reglas sugeridas:

- `customer`: crear tickets, ver sus propios tickets y crear comentarios públicos.
- `agent`: tomar tickets, asignar tickets, cambiar estados y ver comentarios internos.
- `admin`: administrar usuarios, cambiar roles y acceder a todo.

Evitar que las reglas queden duplicadas o dispersas en muchos casos de uso.

## 5. Modelo de repositorios

Los módulos ya no deberían consultar tablas de otros módulos directamente desde sus repositorios principales.

Decisión aplicada:

- `users` expone puertos de lectura como `UserLookup` y `UserAuthLookup`.
- `tickets` expone `TicketLookup`.
- `comments`, `tickets`, `audit` y `auth` dependen de esos puertos cuando necesitan datos de otros módulos.
- Los repositorios principales se concentran en su propio agregado o tabla principal.

Esto mejora la separación y deja los casos de uso listos para tests unitarios con mocks simples.

Tests sugeridos para esta decisión:

- Mockear `UserLookup` en `AssignTicketUseCase` y `ChangeTicketStatusUseCase`.
- Mockear `TicketLookup` y `UserLookup` en `AddCommentUseCase` y `ListCommentsUseCase`.
- Mockear `TicketLookup` en `ListTicketAuditEventsUseCase`.
- Mockear `UserAuthLookup` en login, refresh y `/me`.

## 6. Hardening de Auth

Mejoras pendientes:

- Detectar reuse de refresh tokens.
- Revocar todos los refresh tokens de un usuario.
- Definir una password policy más clara.
- Agregar rate limiting en login/register.
- Evitar mensajes demasiado específicos en auth.
- Evaluar una librería JWT mantenida si el proyecto apunta a producción real.

## 7. Documentación de API

Agregar documentación para:

- Endpoints.
- Payloads.
- Responses.
- Errores.
- Headers de auth.
- Roles y permisos.

Opciones:

- OpenAPI.
- Colección HTTP.
- Ejemplos `curl` en README.

## 8. Migrations e índices

Revisar el schema y agregar índices útiles.

Índices sugeridos:

- `refresh_tokens.token_hash`.
- `ticket_events.ticket_id`.
- `ticket_events.actor_id`.
- `ticket_events.event_type`.
- `ticket_comments.ticket_id`.
- `tickets.status`.
- `tickets.priority`.
- `tickets.created_by`.
- `tickets.assigned_to`.

También revisar constraints adicionales según reglas de negocio.

## 9. CI

Agregar GitHub Actions para:

- Instalar dependencias.
- Ejecutar `pnpm lint`.
- Ejecutar `pnpm build`.
- Ejecutar tests.
- Levantar PostgreSQL para integration tests cuando corresponda.

## 10. Logs y observabilidad

Fastify ya usa Pino, pero falta definir:

- Request id.
- Logs de errores de auth sin exponer secretos.
- Logs de eventos importantes.
- Formato estable para producción.
- Nivel de logs por ambiente.
