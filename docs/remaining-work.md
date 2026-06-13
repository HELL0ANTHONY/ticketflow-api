# Remaining Work

Esta lista mantiene solo pendientes reales. Las decisiones ya implementadas estan documentadas en el README y en documentos especificos.

## Prioridad recomendada

1. Agregar CI.
2. Publicar documentacion OpenAPI o coleccion HTTP.
3. Ampliar matriz de integracion HTTP.
4. Ampliar matriz de repositorios Drizzle.
5. Evaluar mejoras productivas de auth y observabilidad.

## CI

Agregar GitHub Actions para:

- Instalar dependencias con pnpm.
- Ejecutar `pnpm lint`.
- Ejecutar `pnpm build`.
- Ejecutar `pnpm test:run`.
- Ejecutar tests de integracion con Docker disponible para Testcontainers.
- Publicar reporte de coverage si se decide usarlo como requisito de calidad.

## Tests de integracion

Estado: cubierto en su base.

La suite ya incluye:

- Flujos HTTP reales con Fastify `app.inject()`.
- Registro y lectura de usuario autenticado.
- Ruta protegida sin token.
- Flujo principal de tickets: crear, asignar, cambiar estado, comentar y leer auditoria.
- Repositorios Drizzle contra PostgreSQL real con Testcontainers.
- Migraciones ejecutadas antes de la suite de integracion.

Pendiente para ampliar:

- Contratos de response/error por endpoint.
- Headers de auth invalidos y expirados.
- Permisos `401`/`403` por rol en todos los endpoints protegidos.
- Refresh token rotado y reuse detection desde HTTP.
- `logout` y `logout-all` desde HTTP.
- Lookups Drizzle (`UserLookup`, `UserAuthLookup`, `TicketLookup`).
- Filtros menos frecuentes de tickets, usuarios y auditoria.

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
