ALTER TABLE archivos
    MODIFY tipo_recurso ENUM('cita', 'mensaje', 'reporte', 'mascota', 'adopcion') NOT NULL;
