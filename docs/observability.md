# Observability

La API emite logs JSON estructurados con Fastify/Pino por `stdout`. Docker Compose levanta un stack local con:

- Grafana Alloy como collector.
- Loki como backend de logs.
- Grafana como UI.

## Levantar el stack

```sh
docker compose up -d db api loki alloy grafana
```

Puertos por defecto:

- API: `http://localhost:3000`
- Loki: `http://localhost:3100`
- Alloy: `http://localhost:12345`
- Grafana: `http://localhost:3001`

Grafana queda provisionado con el datasource `Loki`.

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

## Criterio de labels

Loki debe evitar labels de alta cardinalidad. Por eso `request_id`, `route`, `method`, `status_code` y `user_id` se tratan como structured metadata o campos del log, no como labels globales.

Labels usados:

- `service`
- `environment`
- `level`
- `event`
- `collector`
- labels de Docker Compose de baja cardinalidad
