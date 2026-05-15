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
