INSERT INTO recomendaciones (titulo, contenido)
SELECT '¿Qué hacer si mi mascota está desanimada?',
       'Observa si come, bebe y se mueve con normalidad. Si el desánimo dura más de un día o hay otros síntomas, agenda una cita.'
WHERE NOT EXISTS (SELECT 1 FROM recomendaciones WHERE titulo = '¿Qué hacer si mi mascota está desanimada?');

INSERT INTO recomendaciones (titulo, contenido)
SELECT '¿Cada cuánto debo desparasitar a mi perro?',
       'Depende de su edad y estilo de vida. Pregunta en tu próxima cita el calendario que le corresponde.'
WHERE NOT EXISTS (SELECT 1 FROM recomendaciones WHERE titulo = '¿Cada cuánto debo desparasitar a mi perro?');

INSERT INTO recomendaciones (titulo, contenido)
SELECT '¿Cómo cuido a mi gato después de la vacuna?',
       'Déjalo descansar en un lugar tranquilo y vigila que coma con normalidad. Si notas inflamación fuerte o decaimiento, escríbenos.'
WHERE NOT EXISTS (SELECT 1 FROM recomendaciones WHERE titulo = '¿Cómo cuido a mi gato después de la vacuna?');

INSERT INTO recomendaciones (titulo, contenido)
SELECT '¿Qué alimentos son tóxicos para mis mascotas?',
       'Chocolate, uvas, cebolla, ajo y xilitol son peligrosos. Si los ingirió, contacta a la clínica de inmediato.'
WHERE NOT EXISTS (SELECT 1 FROM recomendaciones WHERE titulo = '¿Qué alimentos son tóxicos para mis mascotas?');

INSERT INTO recomendaciones (titulo, contenido)
SELECT '¿Cómo sé si mi mascota tiene fiebre?',
       'Nariz muy caliente, temblores y poco apetito pueden ser señales, pero solo un termómetro lo confirma. Consulta antes de medicarla.'
WHERE NOT EXISTS (SELECT 1 FROM recomendaciones WHERE titulo = '¿Cómo sé si mi mascota tiene fiebre?');

INSERT INTO recomendaciones (titulo, contenido)
SELECT '¿Cuándo debo esterilizar a mi mascota?',
       'La edad ideal varía según especie y tamaño. Lo definimos contigo en una consulta.'
WHERE NOT EXISTS (SELECT 1 FROM recomendaciones WHERE titulo = '¿Cuándo debo esterilizar a mi mascota?');

INSERT INTO mascotas_adopcion
    (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
SELECT 'Monchi', '5 meses', 'dog', 'Mestizo', 'male', 'small', TRUE, FALSE,
       'Recién llegado, recogido de la calle. Ya fue vacunado y busca un hogar.',
       JSON_ARRAY('/images/adoption/placeholder-1.svg', '/images/adoption/placeholder-2.svg', '/images/adoption/placeholder-3.svg')
WHERE NOT EXISTS (SELECT 1 FROM mascotas_adopcion WHERE nombre = 'Monchi');

INSERT INTO mascotas_adopcion
    (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
SELECT 'Canela', '2 años', 'dog', 'Labrador mestizo', 'female', 'large', TRUE, TRUE,
       'Cariñosa y juguetona. Se lleva bien con niños y con otros perros.',
       JSON_ARRAY('/images/adoption/placeholder-1.svg', '/images/adoption/placeholder-2.svg', '/images/adoption/placeholder-3.svg')
WHERE NOT EXISTS (SELECT 1 FROM mascotas_adopcion WHERE nombre = 'Canela');

INSERT INTO mascotas_adopcion
    (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
SELECT 'Rocky', '1 año', 'dog', 'Bulldog francés', 'male', 'medium', TRUE, TRUE,
       'Muy activo, necesita paseos diarios.',
       JSON_ARRAY('/images/adoption/placeholder-1.svg', '/images/adoption/placeholder-2.svg', '/images/adoption/placeholder-3.svg')
WHERE NOT EXISTS (SELECT 1 FROM mascotas_adopcion WHERE nombre = 'Rocky');

INSERT INTO mascotas_adopcion
    (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
SELECT 'Nube', '3 años', 'dog', 'Maltés', 'female', 'small', TRUE, TRUE,
       'Tranquila y sociable. Ideal para departamento.',
       JSON_ARRAY('/images/adoption/placeholder-1.svg', '/images/adoption/placeholder-2.svg', '/images/adoption/placeholder-3.svg')
WHERE NOT EXISTS (SELECT 1 FROM mascotas_adopcion WHERE nombre = 'Nube');

INSERT INTO mascotas_adopcion
    (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
SELECT 'Tobi', '8 meses', 'dog', 'Schnauzer', 'male', 'small', TRUE, FALSE,
       'Cachorro curioso, vacunado y desparasitado.',
       JSON_ARRAY('/images/adoption/placeholder-1.svg', '/images/adoption/placeholder-2.svg', '/images/adoption/placeholder-3.svg')
WHERE NOT EXISTS (SELECT 1 FROM mascotas_adopcion WHERE nombre = 'Tobi');

INSERT INTO mascotas_adopcion
    (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
SELECT 'Pelusa', '1 año', 'cat', 'Europeo', 'female', 'small', TRUE, TRUE,
       'Gata independiente pero cariñosa. Convive bien con otros gatos.',
       JSON_ARRAY('/images/adoption/placeholder-1.svg', '/images/adoption/placeholder-2.svg', '/images/adoption/placeholder-3.svg')
WHERE NOT EXISTS (SELECT 1 FROM mascotas_adopcion WHERE nombre = 'Pelusa');
