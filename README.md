# ticketflow-api

- docker compose up -d --build api levanta correctamente.
- docker compose ps api muestra el contenedor Up.
- GET http://127.0.0.1:3000/healtcheck responde {"status":"ok"}

  Endpoints:

  POST /tickets
  GET /tickets
  GET /tickets?priority=high&status=open

  Por ahora POST /tickets recibe createdBy en el body porque todavía no existe Auth:

  {
  "title": "No puedo iniciar sesión",
  "description": "El usuario ve un error al intentar iniciar sesión.",
  "createdBy": "uuid-de-un-user-existente",
  "priority": "high"
  }

curl -s http://127.0.0.1:3000/ticket/bbe55155-5a04-4b67-b01b-6e19c8b116b0 | jq

export type CreateUserInput = {
email: string;
name: string;
password: string;
role?: UserRole;
};

curl -s -X POST http://127.0.0.1:3000/users \
 -H "Content-Type: application/json" \
 -d '{
"email": "ana@example.com",
"name": "Ana Admin",
"password": "secret123",
"role": "admin"
}'

PATCH /ticket/:id/assign

Body:

{
"actorId": "uuid-del-agent-o-admin",
"assignedTo": "uuid-del-agent-o-admin"
}

UserAdmin: "f79acc9c-2a44-4055-bfef-54685839ded5"
UserAgent: 8e7822e9-71a8-4969-b48e-f3b8fe605b59
ticketId: "11111111-1111-4111-8111-111111111111"

curl -s -X PATCH http://127.0.0.1:3000/tickets/11111111-1111-4111-8111-111111111111/assign \
 -H "Content-Type: application/json" \
 -d '{
"actorId": "f79acc9c-2a44-4055-bfef-54685839ded5",
"assignedTo": "8e7822e9-71a8-4969-b48e-f3b8fe605b59"
}'
