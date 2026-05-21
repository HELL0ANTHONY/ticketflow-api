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
