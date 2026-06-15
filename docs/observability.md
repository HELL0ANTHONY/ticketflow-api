# Observability

La API emite logs JSON estructurados con Fastify/Pino por `stdout`, metricas Prometheus en `/metrics` y trazas distribuidas OpenTelemetry por OTLP HTTP. Docker Compose levanta un stack local con:

- Grafana Alloy como collector.
- Loki como backend de logs.
- Prometheus como backend de metricas y reglas.
- Tempo como backend de trazas.
- Grafana como UI.

## Levantar el stack

```sh
docker compose up -d db tempo api loki alloy prometheus grafana
```

Puertos por defecto:

- API: `http://localhost:3000`
- Loki: `http://localhost:3100`
- Alloy: `http://localhost:12345`
- Prometheus: `http://localhost:9090`
- Tempo: `http://localhost:3200`
- OTLP HTTP: `http://localhost:4318`
- Grafana: `http://localhost:3001`

Grafana queda provisionado con datasources `Loki`, `Prometheus` y `Tempo`, mas alertas administradas como codigo.

El acceso anonimo a Grafana queda desactivado por defecto con `GRAFANA_ANONYMOUS_ENABLED=false`. Para uso local se puede ingresar con usuario `admin` y `GRAFANA_ADMIN_PASSWORD`.

## Logging de la API

Variables relevantes:

- `NODE_ENV`: `development`, `production` o `test`.
- `LOG_LEVEL`: `trace`, `debug`, `info`, `warn`, `error`, `fatal` o `silent`.
- `SERVICE_NAME`: nombre estable del servicio en logs. Default: `ticketflow-api`.

Los logs incluyen:

- `timestamp`
- `level`
- `service`
- `environment`
- request id validado desde `x-request-id` o generado como UUID
- request/response serializers de Fastify
- eventos de auth y errores de aplicación

Los logs redactan campos sensibles como `authorization`, cookies, contraseñas y tokens.

## Metricas

La API expone `/metrics` cuando `METRICS_ENABLED=true`.

Metricas principales:

- `http_server_requests_total`: contador de requests por `method`, `route` y `status_code`.
- `http_server_request_duration_seconds`: histograma de latencia HTTP para calcular p95/p99.
- `http_application_errors_total`: errores de aplicacion por tipo/status.
- `http_auth_failures_total`: fallas `401`/`403` para detectar abuso de auth.
- `nodejs_*`: metricas runtime recolectadas por `prom-client`.

Las labels usan baja cardinalidad. No se etiqueta por user id, request id, email, token ni payload.

Prometheus scrapea la API cada 15s y carga reglas desde `observability/prometheus/alerts.yml`.

## Tracing

`TRACING_ENABLED=true` activa OpenTelemetry antes de importar la app. La API exporta trazas a Tempo con OTLP HTTP usando `OTEL_TRACE_EXPORTER_URL`.

En Docker Compose:

```txt
OTEL_TRACE_EXPORTER_URL=http://tempo:4318/v1/traces
```

La autoinstrumentacion cubre HTTP/Fastify/PG y desactiva `fs` para evitar ruido. `SERVICE_NAME` se usa como nombre estable del servicio.

## Alertas

Hay dos fuentes de alerta:

- Prometheus rules en `observability/prometheus/alerts.yml`.
- Grafana managed alerts provisionadas en `observability/grafana/provisioning/alerting/ticketflow-alerts.yaml`.

Alertas incluidas:

- `TicketFlowHigh5xxRate`: errores 5xx en los ultimos 5 minutos.
- `TicketFlowAuthAbuse`: mas de 20 fallas auth en 5 minutos.
- `TicketFlowHighLatencyP95`: p95 HTTP sobre 1s durante 5 minutos.

Grafana usa Prometheus para 5xx/latencia y Loki para eventos de abuso auth, lo que permite pasar de alerta a logs y trazas sin cambiar de herramienta.

## Consultas útiles en Loki

Logs de la API:

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

Request por id:

```logql
{service="ticketflow-api"} | json | reqId="REQUEST_ID"
```

Eventos de auth para investigar alertas:

```logql
{service="ticketflow-api"} | json | event =~ "auth.*"
```

## Criterio de labels

Loki debe evitar labels de alta cardinalidad. Por eso `request_id`, `route`, `method`, `status_code` y `user_id` se tratan como structured metadata o campos del log, no como labels globales.

Labels usados:

- `service`
- `environment`
- `level`
- `event`
- `collector`
- labels de Docker Compose de baja cardinalidad
