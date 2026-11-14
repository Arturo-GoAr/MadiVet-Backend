CREATE TABLE IF NOT EXISTS usuarios (
    id INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(30) NULL,
    rol ENUM('client', 'staff') NOT NULL DEFAULT 'client',
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY usuarios_correo_unique (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mascotas (
    id INT NOT NULL AUTO_INCREMENT,
    propietario_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    especie ENUM('dog', 'cat', 'other') NOT NULL,
    sexo ENUM('male', 'female', 'unknown') NOT NULL DEFAULT 'unknown',
    fecha_nacimiento DATE NULL,
    notas TEXT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY mascotas_propietario (propietario_id),
    CONSTRAINT mascotas_usuario_fk FOREIGN KEY (propietario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vacunas (
    id INT NOT NULL AUTO_INCREMENT,
    mascota_id INT NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    fecha DATE NOT NULL,
    proxima_fecha DATE NULL,
    notas TEXT NULL,
    PRIMARY KEY (id),
    KEY vacunas_mascota_fecha (mascota_id, fecha),
    CONSTRAINT vacunas_mascota_fk FOREIGN KEY (mascota_id) REFERENCES mascotas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citas (
    id INT NOT NULL AUTO_INCREMENT,
    propietario_id INT NOT NULL,
    mascota_id INT NULL,
    tipo ENUM('medical', 'grooming', 'vaccination') NOT NULL,
    asunto VARCHAR(500) NOT NULL,
    fecha DATETIME NOT NULL,
    estado ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY citas_propietario_fecha (propietario_id, fecha),
    KEY citas_fecha_estado (fecha, estado),
    CONSTRAINT citas_usuario_fk FOREIGN KEY (propietario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT citas_mascota_fk FOREIGN KEY (mascota_id) REFERENCES mascotas (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mascotas_adopcion (
    id INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    edad VARCHAR(60) NOT NULL,
    especie ENUM('dog', 'cat', 'other') NOT NULL,
    raza VARCHAR(120) NOT NULL DEFAULT '',
    sexo ENUM('male', 'female', 'unknown') NOT NULL DEFAULT 'unknown',
    tamano ENUM('small', 'medium', 'large') NOT NULL DEFAULT 'medium',
    vacunado BOOLEAN NOT NULL DEFAULT FALSE,
    esterilizado BOOLEAN NOT NULL DEFAULT FALSE,
    descripcion TEXT NOT NULL,
    fotos JSON NULL,
    estado ENUM('available', 'pending', 'adopted') NOT NULL DEFAULT 'available',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY adopcion_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitudes_adopcion (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    mascota_adopcion_id INT NULL,
    nombre_solicitante VARCHAR(150) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    nombre_mascota VARCHAR(100) NOT NULL,
    detalles TEXT NULL,
    estado ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY solicitudes_usuario_fecha (usuario_id, creado_en),
    KEY solicitudes_estado (estado),
    CONSTRAINT solicitudes_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT solicitudes_mascota_fk FOREIGN KEY (mascota_adopcion_id) REFERENCES mascotas_adopcion (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recomendaciones (
    id INT NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY recomendaciones_activa (activa, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mensajes (
    id INT NOT NULL AUTO_INCREMENT,
    cita_id INT NOT NULL,
    usuario_id INT NOT NULL,
    contenido TEXT NOT NULL,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY mensajes_cita_fecha (cita_id, creado_en),
    CONSTRAINT mensajes_cita_fk FOREIGN KEY (cita_id) REFERENCES citas (id) ON DELETE CASCADE,
    CONSTRAINT mensajes_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reportes (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    tipo ENUM('problem', 'review') NOT NULL,
    detalles TEXT NOT NULL,
    calificacion TINYINT UNSIGNED NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY reportes_usuario_fecha (usuario_id, creado_en),
    KEY reportes_tipo_fecha (tipo, creado_en),
    CONSTRAINT reportes_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT reportes_calificacion_check CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS archivos (
    id CHAR(36) NOT NULL,
    usuario_id INT NOT NULL,
    tipo_recurso ENUM('cita', 'mensaje', 'reporte', 'mascota', 'adopcion') NOT NULL,
    recurso_id INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_almacenado VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamano INT UNSIGNED NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY archivos_recurso (tipo_recurso, recurso_id),
    KEY archivos_usuario_fecha (usuario_id, creado_en),
    UNIQUE KEY archivos_nombre_almacenado (nombre_almacenado),
    CONSTRAINT archivos_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
