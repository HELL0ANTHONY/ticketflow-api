# Remaining Work

Esta lista mantiene solo pendientes reales. Las decisiones ya implementadas estan documentadas en el README y en documentos especificos.

## Prioridad recomendada

1. Agregar CI.
2. Publicar documentacion OpenAPI o coleccion HTTP.
3. Agregar casos borde adicionales de integracion segun evolucione la API.
4. Evaluar mejoras productivas de auth y observabilidad.

## CI

Agregar GitHub Actions para:

- Instalar dependencias con pnpm.
- Ejecutar `pnpm lint`.
- Ejecutar `pnpm build`.
- Ejecutar `pnpm test:run`.
- Ejecutar tests de integracion con Docker disponible para Testcontainers.
- Publicar reporte de coverage si se decide usarlo como requisito de calidad.

## Tests de integracion

Estado: cubierto y ampliado.

La suite ya incluye:

- Flujos HTTP reales con Fastify `app.inject()`.
- Registro y lectura de usuario autenticado.
- Ruta protegida sin token.
- Validacion de payloads invalidos.
- Refresh token rotado, rechazo de reuse detection y revocacion de sesiones.
- `logout` y `logout-all` desde HTTP.
- Permisos `401`/`403` representativos por rol.
- Usuarios: listado filtrado por rol y cambio de rol por admin.
- Tickets: crear, obtener, listar por prioridad/estado, asignar y cambiar estado.
- Comentarios: visibilidad publica para customers e interna para support.
- Auditoria: lectura y filtros por ticket/event type.
- Repositorios y lookups Drizzle contra PostgreSQL real con Testcontainers.
- Usuarios: crear, detectar duplicados, buscar, listar, cambiar rol y lookups.
- Tickets: crear, buscar, filtrar, cerrar y lookup.
- Comentarios: crear, filtrar internos/publicos y emitir eventos.
- Auth: tokens activos, expirados, revocados y revocacion global por usuario.
- Auditoria: filtros por ticket, actor, tipo y rango de fechas.
- Migraciones ejecutadas antes de la suite de integracion.

Pendiente eventual:

- Contratos de response/error exhaustivos por endpoint si la API se estabiliza como contrato publico.
- Headers de auth expirados con control explicito del tiempo del token.
- Casos borde nuevos cuando se agreguen endpoints, filtros o reglas.

## API Documentation

Agregar una fuente consumible por herramientas:

- OpenAPI.
- Coleccion HTTP.
- Ejemplos `curl` versionados.

Debe documentar:

- Endpoints.
- Payloads.
- Responses.
- Errores.
- Headers de auth.
- Roles y permisos.

## Auth

Pendientes opcionales si se apunta a produccion real:

- Evaluar una libreria JWT mantenida.
- Mover rate limit de memoria a Redis u otro store compartido.
- Agregar invalidacion centralizada de access tokens si aparece ese requisito.

## Observability

La base de logs esta cubierta con Pino, Alloy, Loki y Grafana.

Pendiente opcional:

- Agregar metricas Prometheus.
- Agregar tracing distribuido con OpenTelemetry y Tempo.
- Definir alertas en Grafana/Loki para errores 5xx, abuso de auth y degradacion de latencia.
