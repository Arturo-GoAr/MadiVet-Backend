-- Ejecutar una sola vez en la base de datos existente, después de schema.sql.
-- No elimina ni modifica las contraseñas ni los registros de usuarios existentes.
ALTER TABLE usuarios
    ADD COLUMN telefono VARCHAR(30) NULL,
    ADD COLUMN rol ENUM('client', 'staff') NOT NULL DEFAULT 'client';
