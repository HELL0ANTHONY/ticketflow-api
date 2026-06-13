# Remaining Work

Esta lista mantiene solo pendientes reales. Las decisiones ya implementadas estan documentadas en el README y en documentos especificos.

## Prioridad recomendada

1. Agregar CI.
2. Agregar tests de integracion HTTP.
3. Agregar tests de repositorios Drizzle con PostgreSQL real.
4. Publicar documentacion OpenAPI o coleccion HTTP.
5. Evaluar mejoras productivas de auth y observabilidad.

## CI

Agregar GitHub Actions para:

- Instalar dependencias con pnpm.
- Ejecutar `pnpm lint`.
- Ejecutar `pnpm build`.
- Ejecutar `pnpm test:run`.
- Levantar PostgreSQL para tests de integracion cuando existan.

## Tests de integracion

La suite actual cubre casos de uso por modulo. Falta cubrir:

- Flujos HTTP completos con Fastify.
- Contratos de response/error por endpoint.
- Headers de auth ausentes, invalidos y expirados.
- Permisos `401`/`403` por rol.
- Repositorios Drizzle contra PostgreSQL real usando Testcontainers.

Casos criticos:

- Registro, login, refresh, logout y logout-all.
- Refresh token rotado y reuse detection.
- Cambio de rol solo por admin.
- Creacion, asignacion y cambio de estado de tickets.
- Comentarios publicos e internos.
- Lectura de eventos de auditoria.

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
