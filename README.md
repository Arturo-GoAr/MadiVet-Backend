# MädiVet

El backend Express se ejecuta en esta carpeta y el frontend Next.js está en
`frontend/`. La interfaz estática preexistente de `public/` sigue disponible en
`http://localhost:4000/`.

## Preparar MySQL

El proyecto **no ejecuta migraciones ni seeds automáticamente**.

- Base nueva: ejecuta `database/schema.sql` y después, si quieres los datos
  iniciales de adopción y recomendaciones, `database/seed.sql`.
- Base existente: primero ejecuta `database/schema.sql` (sus `CREATE TABLE IF
  NOT EXISTS` conservan las tablas existentes) y luego ejecuta una sola vez
  `database/migrations/001_backend_completo.sql`. Esta migración agrega teléfono
  y rol a `usuarios`; no borra cuentas ni contraseñas.
- A las cuentas existentes se les asigna el rol `client`. Para habilitar una
  cuenta de personal, cambia su rol explícitamente desde MySQL a `staff`.

La columna `usuarios.password` debe contener hashes bcrypt. Las cuentas
existentes en la base configurada usan ese formato. Las nuevas contraseñas se
guardan con bcrypt; nunca se devuelven en las respuestas.

## Ejecutar

1. Conserva `.env`; revisa que incluya `DB_HOST`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`, `DB_PORT` y un `JWT_SECRET` aleatorio de al menos 32 caracteres.
2. Desde esta carpeta, ejecuta `npm install` y `npm run dev`.
3. En otra terminal, desde `frontend/`, ejecuta `pnpm install` y `pnpm dev`.
4. Abre `http://localhost:3000`. Para otro host/puerto de API, configura
   `BACKEND_API_URL` en `frontend/.env.local`.

`npm run db:check` comprueba la conexión a MySQL. La carga inicial es opcional y
se ejecuta manualmente con `database/seed.sql`.

## API

Todas las rutas `/api` salvo `/api/health`, `/api/auth/register` y
`/api/auth/login` requieren un token `Authorization: Bearer <token>`. Los
recursos de cada cliente se limitan a su cuenta; las operaciones administrativas
requieren rol `staff`.

- Autenticación y cuenta: `POST /api/auth/register`, `POST /api/auth/login`,
  `GET/PATCH /api/auth/me`.
- Clientes (personal): `GET /api/clients`, `GET /api/clients/:id`.
- Mascotas y cartilla: `GET/POST /api/pets`, `PATCH/DELETE /api/pets/:id`,
  `POST /api/pets/:id/vaccines`.
- Citas: `GET/POST /api/appointments`, `GET/PATCH /api/appointments/:id`.
- Adopción: `GET /api/adoption/animals`, personal puede crear/actualizar
  animales; `POST/GET /api/adoption/requests`, personal gestiona solicitudes.
- Recomendaciones: `GET /api/recommendations`; personal puede crear, actualizar
  y desactivar.
- Chats: `GET /api/chats`, `GET/POST /api/appointments/:id/messages`.
- Problemas y reseñas: `POST /api/feedback`; personal consulta con
  `GET /api/feedback`.
- Adjuntos: imágenes JPG/PNG/WebP y PDF de hasta 10 MB por archivo; se guardan
  fuera de `public/` y se sirven mediante `GET /api/files/:id` con autorización.
- Estado: `GET /api/health`; panel: `GET /api/dashboard`.

El frontend consume estas rutas para sesión, dashboard, citas, mascotas,
clientes, adopciones, recomendaciones y chats; los formularios de citas,
estética, adopción y mensajes persisten en MySQL. Para que las pantallas muestren
datos reales, aplica primero el esquema y carga los datos iniciales opcionales.
La administración de contenido y los reportes/reseñas están disponibles por API.
