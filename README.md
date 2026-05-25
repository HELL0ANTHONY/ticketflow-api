# ticketflow-api

- docker compose up -d --build api levanta correctamente.
- docker compose ps api muestra el contenedor Up.
- GET http://127.0.0.1:3000/healtcheck responde {"status":"ok"}

  Endpoints:

  POST /tickets
  GET /tickets
  GET /tickets?priority=high&status=open

  POST /tickets usa el usuario autenticado como creador:

curl -s -X POST http://127.0.0.1:3000/tickets \
 -H "Authorization: Bearer $ACCESS_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"title": "No puedo iniciar sesión",
"description": "El usuario ve un error al intentar iniciar sesión.",
"priority": "high"
}'

curl -s http://127.0.0.1:3000/tickets/bbe55155-5a04-4b67-b01b-6e19c8b116b0 \
 -H "Authorization: Bearer $ACCESS_TOKEN" | jq

curl -s -X POST http://127.0.0.1:3000/auth/register \
 -H "Content-Type: application/json" \
 -d '{
"email": "ana@example.com",
"name": "Ana Admin",
"password": "secret123"
}'

PATCH /tickets/:id/assign

Body:

{
"assignedTo": "uuid-del-agent-o-admin"
}

UserAdmin: "f79acc9c-2a44-4055-bfef-54685839ded5"
UserAgent: 8e7822e9-71a8-4969-b48e-f3b8fe605b59
ticketId: "11111111-1111-4111-8111-111111111111"

curl -s -X PATCH http://127.0.0.1:3000/tickets/11111111-1111-4111-8111-111111111111/assign \
 -H "Authorization: Bearer $ACCESS_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"assignedTo": "8e7822e9-71a8-4969-b48e-f3b8fe605b59"
}'
