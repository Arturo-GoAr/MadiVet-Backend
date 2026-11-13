const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db-pool");
const verificarToken = require("../middleware/auth");
const requireRole = verificarToken.requireRole;

const router = express.Router();
const uploadDirectory = path.join(__dirname, "..", "uploads");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const appointmentTypes = new Set(["medical", "grooming", "vaccination"]);
const appointmentStates = new Set(["pending", "confirmed", "completed", "cancelled"]);
const petSpecies = new Set(["dog", "cat", "other"]);
const petSexes = new Set(["male", "female", "unknown"]);
const adoptionSizes = new Set(["small", "medium", "large"]);
const allowedFiles = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".webp", "image/webp"],
    [".pdf", "application/pdf"]
]);

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => {
            fs.mkdir(uploadDirectory, { recursive: true })
                .then(() => callback(null, uploadDirectory))
                .catch(callback);
        },
        filename: (_req, file, callback) => {
            const extension = path.extname(file.originalname).toLowerCase();
            callback(null, `${crypto.randomUUID()}${extension}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedFiles.get(extension) !== file.mimetype) {
            return callback(Object.assign(new Error("Tipo de archivo no permitido."), { status: 400, code: "INVALID_FILE_TYPE" }));
        }
        return callback(null, true);
    }
});

function sendError(res, status, code, message) {
    return res.status(status).json({ codigo: code, mensaje: message });
}

function getId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function readName(value, maxLength = 100) {
    if (typeof value !== "string") return null;
    const result = value.trim();
    return result && result.length <= maxLength ? result : null;
}

function getUserId(req) {
    return getId(req.usuario.sub);
}

function isStaff(req) {
    return req.usuario.rol === "staff";
}

function publicUser(user) {
    return {
        id: String(user.id),
        nombre: user.nombre,
        correo: user.correo,
        telefono: user.telefono || null,
        rol: user.rol
    };
}

function createToken(user) {
    return jwt.sign(
        { nombre: user.nombre, correo: user.correo, rol: user.rol },
        process.env.JWT_SECRET,
        { subject: String(user.id), expiresIn: "8h", algorithm: "HS256" }
    );
}

function ownsOrStaff(req, ownerId) {
    return isStaff(req) || Number(ownerId) === getUserId(req);
}

async function getAppointmentForUser(appointmentId, req) {
    const [rows] = await pool.execute(
        `SELECT c.id, c.propietario_id, c.mascota_id, c.tipo, c.asunto,
                DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha, c.estado,
                m.nombre AS mascota
         FROM citas c
         LEFT JOIN mascotas m ON m.id = c.mascota_id
         WHERE c.id = ?`,
        [appointmentId]
    );
    const appointment = rows[0];
    return appointment && ownsOrStaff(req, appointment.propietario_id) ? appointment : null;
}

async function saveFiles(files, userId, resourceType, resourceId) {
    const inserted = [];
    try {
        for (const file of files) {
            const handle = await fs.open(file.path, "r");
            let header;
            try {
                header = Buffer.alloc(12);
                await handle.read(header, 0, header.length, 0);
            } finally {
                await handle.close();
            }

            const validSignature =
                (file.mimetype === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
                (file.mimetype === "image/png" && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
                (file.mimetype === "image/webp" && header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") ||
                (file.mimetype === "application/pdf" && header.toString("ascii", 0, 5) === "%PDF-");
            if (!validSignature) {
                const error = new Error("El contenido del archivo no coincide con su tipo.");
                error.code = "INVALID_FILE_CONTENT";
                error.status = 400;
                throw error;
            }

            const id = crypto.randomUUID();
            await pool.execute(
                `INSERT INTO archivos
                 (id, usuario_id, tipo_recurso, recurso_id, nombre_original, nombre_almacenado, mime_type, tamano)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, resourceType, resourceId, path.basename(file.originalname).slice(0, 255), file.filename, file.mimetype, file.size]
            );
            inserted.push({
                id,
                nombre: path.basename(file.originalname),
                tipo: file.mimetype,
                tamano: file.size
            });
        }
        return inserted;
    } catch (error) {
        if (inserted.length) {
            await pool.execute(
                `DELETE FROM archivos WHERE id IN (${inserted.map(() => "?").join(", ")})`,
                inserted.map((file) => file.id)
            );
        }
        await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
        throw error;
    }
}

async function removeUploadedFiles(files) {
    await Promise.all((files || []).map((file) => fs.unlink(file.path).catch(() => {})));
}

router.post("/auth/register", async (req, res, next) => {
    const body = req.body || {};
    const nombre = readName(body.nombre ?? body.name, 100);
    const correo = typeof (body.correo ?? body.email) === "string"
        ? (body.correo ?? body.email).trim().toLowerCase()
        : "";
    const password = body.password;
    if (!nombre || correo.length > 150 || !emailPattern.test(correo)) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa el nombre y el correo.");
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
        return sendError(res, 400, "INVALID_PASSWORD", "La contraseña debe tener entre 8 y 72 caracteres.");
    }
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await pool.execute(
            "INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, 'client')",
            [nombre, correo, passwordHash]
        );
        return res.status(201).json({
            mensaje: "Cuenta creada correctamente.",
            usuario: publicUser({ id: result.insertId, nombre, correo, rol: "client" })
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return sendError(res, 409, "EMAIL_EXISTS", "Ya existe una cuenta con ese correo.");
        }
        return next(error);
    }
});

router.post("/auth/login", async (req, res, next) => {
    const body = req.body || {};
    const correo = typeof (body.correo ?? body.email) === "string"
        ? (body.correo ?? body.email).trim().toLowerCase()
        : "";
    const password = body.password;
    if (!emailPattern.test(correo) || typeof password !== "string" || !password || password.length > 72) {
        return sendError(res, 400, "INVALID_INPUT", "Ingresa un correo y una contraseña válidos.");
    }
    try {
        const [rows] = await pool.execute(
            "SELECT id, nombre, correo, telefono, password, rol FROM usuarios WHERE correo = ? LIMIT 1",
            [correo]
        );
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return sendError(res, 401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
        }
        const sessionUser = { ...user, rol: user.rol || "client" };
        return res.json({ token: createToken(sessionUser), usuario: publicUser(sessionUser) });
    } catch (error) {
        return next(error);
    }
});

router.use(verificarToken);

router.get("/auth/me", async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, nombre, correo, telefono, rol FROM usuarios WHERE id = ? LIMIT 1",
            [getUserId(req)]
        );
        if (!rows[0]) return sendError(res, 401, "USER_NOT_FOUND", "La cuenta ya no existe.");
        return res.json({ usuario: publicUser({ ...rows[0], rol: rows[0].rol || "client" }) });
    } catch (error) {
        return next(error);
    }
});

router.patch("/auth/me", async (req, res, next) => {
    const nombre = req.body?.nombre === undefined ? undefined : readName(req.body.nombre, 100);
    const telefono = req.body?.telefono === undefined
        ? undefined
        : typeof req.body.telefono === "string" ? req.body.telefono.trim() : null;
    if (nombre === null || telefono === null || (telefono !== undefined && telefono.length > 30)) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa el nombre o el teléfono.");
    }
    try {
        if (nombre !== undefined && telefono !== undefined) {
            await pool.execute("UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?", [nombre, telefono || null, getUserId(req)]);
        } else if (nombre !== undefined) {
            await pool.execute("UPDATE usuarios SET nombre = ? WHERE id = ?", [nombre, getUserId(req)]);
        } else if (telefono !== undefined) {
            await pool.execute("UPDATE usuarios SET telefono = ? WHERE id = ?", [telefono || null, getUserId(req)]);
        } else {
            return sendError(res, 400, "EMPTY_UPDATE", "No se recibieron cambios.");
        }
        const [rows] = await pool.execute(
            "SELECT id, nombre, correo, telefono, rol FROM usuarios WHERE id = ?",
            [getUserId(req)]
        );
        return res.json({ usuario: publicUser(rows[0]) });
    } catch (error) {
        return next(error);
    }
});

router.get("/clients", requireRole("staff"), async (req, res, next) => {
    try {
        const search = `%${String(req.query.q || "").trim().slice(0, 100)}%`;
        const [rows] = await pool.execute(
            `SELECT u.id, u.nombre, u.correo, u.telefono,
                    COALESCE(GROUP_CONCAT(DISTINCT m.nombre ORDER BY m.nombre SEPARATOR ', '), '') AS mascotas
             FROM usuarios u
             LEFT JOIN mascotas m ON m.propietario_id = u.id
             WHERE u.rol = 'client' AND (u.nombre LIKE ? OR u.correo LIKE ? OR m.nombre LIKE ?)
             GROUP BY u.id
             ORDER BY u.nombre
             LIMIT 200`,
            [search, search, search]
        );
        return res.json({ clientes: rows.map((row) => ({
            id: String(row.id),
            nombre: row.nombre,
            correo: row.correo,
            telefono: row.telefono,
            mascotas: row.mascotas ? row.mascotas.split(", ") : []
        })) });
    } catch (error) {
        return next(error);
    }
});

router.get("/clients/:id", requireRole("staff"), async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [rows] = await pool.execute(
            `SELECT u.id, u.nombre, u.correo, u.telefono, m.id AS mascota_id, m.nombre AS mascota
             FROM usuarios u LEFT JOIN mascotas m ON m.propietario_id = u.id
             WHERE u.id = ? AND u.rol = 'client' ORDER BY m.nombre`,
            [id]
        );
        if (!rows.length) return sendError(res, 404, "CLIENT_NOT_FOUND", "No se encontró el cliente.");
        return res.json({
            cliente: {
                id: String(rows[0].id),
                nombre: rows[0].nombre,
                correo: rows[0].correo,
                telefono: rows[0].telefono,
                mascotas: rows.filter((row) => row.mascota_id).map((row) => ({ id: String(row.mascota_id), nombre: row.mascota }))
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/pets", async (req, res, next) => {
    try {
        const ownerId = isStaff(req) && req.query.ownerId ? getId(req.query.ownerId) : getUserId(req);
        if (isStaff(req) && req.query.ownerId && !ownerId) return sendError(res, 400, "INVALID_ID", "El propietario no es válido.");
        const [rows] = await pool.execute(
            `SELECT m.id, m.propietario_id, m.nombre, m.especie, m.sexo,
                    DATE_FORMAT(m.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento, m.notas,
                    COALESCE(JSON_ARRAYAGG(IF(v.id IS NULL, NULL, JSON_OBJECT(
                      'id', v.id, 'name', v.nombre, 'date', DATE_FORMAT(v.fecha, '%Y-%m-%d'),
                      'next', DATE_FORMAT(v.proxima_fecha, '%Y-%m-%d')
                    ))), JSON_ARRAY()) AS vacunas
             FROM mascotas m
             LEFT JOIN vacunas v ON v.mascota_id = m.id
             WHERE ${isStaff(req) && !ownerId ? "1 = 1" : "m.propietario_id = ?"}
             GROUP BY m.id ORDER BY m.nombre`,
            ownerId ? [ownerId] : []
        );
        return res.json({ mascotas: rows.map((row) => ({
            id: String(row.id),
            ownerId: String(row.propietario_id),
            name: row.nombre,
            species: row.especie,
            sex: row.sexo,
            birthDate: row.fecha_nacimiento,
            notes: row.notas,
            vaccines: typeof row.vacunas === "string" ? JSON.parse(row.vacunas).filter(Boolean) : row.vacunas.filter(Boolean)
        })) });
    } catch (error) {
        return next(error);
    }
});

router.get("/pets/:id", async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [rows] = await pool.execute(
            `SELECT m.id, m.propietario_id, m.nombre, m.especie, m.sexo,
                    DATE_FORMAT(m.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento, m.notas
             FROM mascotas m WHERE m.id = ?`,
            [id]
        );
        const pet = rows[0];
        if (!pet) return sendError(res, 404, "PET_NOT_FOUND", "No se encontró la mascota.");
        if (!ownsOrStaff(req, pet.propietario_id)) return sendError(res, 403, "FORBIDDEN", "No tienes permiso para ver esta mascota.");
        const [vaccines] = await pool.execute(
            `SELECT id, nombre, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                    DATE_FORMAT(proxima_fecha, '%Y-%m-%d') AS proxima_fecha, notas
             FROM vacunas WHERE mascota_id = ? ORDER BY fecha DESC`,
            [id]
        );
        return res.json({ mascota: {
            id: String(pet.id), ownerId: String(pet.propietario_id), name: pet.nombre,
            species: pet.especie, sex: pet.sexo, birthDate: pet.fecha_nacimiento,
            notes: pet.notas,
            vaccines: vaccines.map((vaccine) => ({
                id: String(vaccine.id), name: vaccine.nombre, date: vaccine.fecha,
                next: vaccine.proxima_fecha, notes: vaccine.notas
            }))
        } });
    } catch (error) {
        return next(error);
    }
});

router.post("/pets", async (req, res, next) => {
    const nombre = readName(req.body?.name ?? req.body?.nombre);
    const especie = req.body?.species ?? req.body?.especie;
    const sexo = req.body?.sex ?? req.body?.sexo ?? "unknown";
    const fechaNacimiento = req.body?.birthDate ?? null;
    const notes = req.body?.notes ?? null;
    const ownerId = isStaff(req) && req.body?.ownerId ? getId(req.body.ownerId) : getUserId(req);
    if (!nombre || !petSpecies.has(especie) || !petSexes.has(sexo) || !ownerId ||
        (fechaNacimiento !== null && !isValidDate(fechaNacimiento)) ||
        (notes !== null && (typeof notes !== "string" || notes.length > 5000))) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa los datos de la mascota.");
    }
    try {
        const [result] = await pool.execute(
            "INSERT INTO mascotas (propietario_id, nombre, especie, sexo, fecha_nacimiento, notas) VALUES (?, ?, ?, ?, ?, ?)",
            [ownerId, nombre, especie, sexo, fechaNacimiento, notes || null]
        );
        return res.status(201).json({ mascota: { id: String(result.insertId), ownerId: String(ownerId), name: nombre, species: especie, sex: sexo, birthDate: fechaNacimiento } });
    } catch (error) {
        return next(error);
    }
});

router.patch("/pets/:id", async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [rows] = await pool.execute("SELECT propietario_id FROM mascotas WHERE id = ?", [id]);
        if (!rows[0]) return sendError(res, 404, "PET_NOT_FOUND", "No se encontró la mascota.");
        if (!ownsOrStaff(req, rows[0].propietario_id)) return sendError(res, 403, "FORBIDDEN", "No tienes permiso para modificar esta mascota.");
        const fields = [];
        const values = [];
        const updates = [
            ["name", "nombre", (value) => readName(value)],
            ["species", "especie", (value) => petSpecies.has(value) ? value : null],
            ["sex", "sexo", (value) => petSexes.has(value) ? value : null],
            ["birthDate", "fecha_nacimiento", (value) => value === null || isValidDate(value) ? value : undefined],
            ["notes", "notas", (value) => typeof value === "string" && value.length <= 5000 ? value : undefined]
        ];
        for (const [input, column, validate] of updates) {
            if (Object.hasOwn(req.body || {}, input)) {
                const value = validate(req.body[input]);
                if (value === null || value === undefined) return sendError(res, 400, "INVALID_INPUT", `El campo ${input} no es válido.`);
                fields.push(`${column} = ?`);
                values.push(value);
            }
        }
        if (!fields.length) return sendError(res, 400, "EMPTY_UPDATE", "No se recibieron cambios.");
        values.push(id);
        await pool.execute(`UPDATE mascotas SET ${fields.join(", ")} WHERE id = ?`, values);
        return res.json({ mensaje: "Mascota actualizada." });
    } catch (error) {
        return next(error);
    }
});

router.delete("/pets/:id", async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [rows] = await pool.execute("SELECT propietario_id FROM mascotas WHERE id = ?", [id]);
        if (!rows[0]) return sendError(res, 404, "PET_NOT_FOUND", "No se encontró la mascota.");
        if (!ownsOrStaff(req, rows[0].propietario_id)) return sendError(res, 403, "FORBIDDEN", "No tienes permiso para eliminar esta mascota.");
        await pool.execute("DELETE FROM mascotas WHERE id = ?", [id]);
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.post("/pets/:id/vaccines", async (req, res, next) => {
    const petId = getId(req.params.id);
    const nombre = readName(req.body?.name, 120);
    const date = req.body?.date;
    const nextDate = req.body?.next ?? null;
    if (!petId || !nombre || !isValidDate(date) || (nextDate !== null && !isValidDate(nextDate))) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa los datos de la vacuna.");
    }
    try {
        const [pets] = await pool.execute("SELECT propietario_id FROM mascotas WHERE id = ?", [petId]);
        if (!pets[0]) return sendError(res, 404, "PET_NOT_FOUND", "No se encontró la mascota.");
        if (!ownsOrStaff(req, pets[0].propietario_id)) return sendError(res, 403, "FORBIDDEN", "No tienes permiso para modificar esta mascota.");
        const [result] = await pool.execute(
            "INSERT INTO vacunas (mascota_id, nombre, fecha, proxima_fecha, notas) VALUES (?, ?, ?, ?, ?)",
            [petId, nombre, date, nextDate, req.body?.notes || null]
        );
        return res.status(201).json({ vacuna: { id: String(result.insertId), name: nombre, date, next: nextDate } });
    } catch (error) {
        return next(error);
    }
});

router.delete("/pets/:id/vaccines/:vaccineId", async (req, res, next) => {
    const petId = getId(req.params.id);
    const vaccineId = getId(req.params.vaccineId);
    if (!petId || !vaccineId) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [pets] = await pool.execute("SELECT propietario_id FROM mascotas WHERE id = ?", [petId]);
        if (!pets[0]) return sendError(res, 404, "PET_NOT_FOUND", "No se encontró la mascota.");
        if (!ownsOrStaff(req, pets[0].propietario_id)) return sendError(res, 403, "FORBIDDEN", "No tienes permiso para modificar esta mascota.");
        const [result] = await pool.execute("DELETE FROM vacunas WHERE id = ? AND mascota_id = ?", [vaccineId, petId]);
        if (!result.affectedRows) return sendError(res, 404, "VACCINE_NOT_FOUND", "No se encontró la vacuna.");
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.get("/appointments", async (req, res, next) => {
    const status = String(req.query.status || "");
    if (status && !appointmentStates.has(status)) return sendError(res, 400, "INVALID_STATUS", "El estado de la cita no es válido.");
    try {
        const ownerFilter = isStaff(req) ? "" : "AND c.propietario_id = ?";
        const [rows] = await pool.execute(
            `SELECT c.id, c.propietario_id, c.mascota_id, c.tipo, c.asunto,
                    DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha, c.estado, m.nombre AS mascota
             FROM citas c LEFT JOIN mascotas m ON m.id = c.mascota_id
             WHERE (? = '' OR c.estado = ?) ${ownerFilter}
             ORDER BY c.fecha DESC LIMIT 500`,
            isStaff(req)
                ? [status, status]
                : [status, status, getUserId(req)]
        );
        return res.json({ citas: rows.map((row) => ({
            id: String(row.id), ownerId: String(row.propietario_id), petId: row.mascota_id ? String(row.mascota_id) : null,
            type: row.tipo, subject: row.asunto, date: row.fecha, status: row.estado, pet: row.mascota
        })) });
    } catch (error) {
        return next(error);
    }
});

router.post("/appointments", async (req, res, next) => {
    const body = req.body || {};
    const type = body.type;
    const subject = readName(body.subject, 500);
    const date = body.date;
    const petId = body.petId ? getId(body.petId) : null;
    const ownerId = isStaff(req) && body.ownerId ? getId(body.ownerId) : getUserId(req);
    if (!appointmentTypes.has(type) || !subject || !isValidDate(date) || !ownerId || (body.petId && !petId)) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa los datos de la cita.");
    }
    try {
        if (petId) {
            const [pets] = await pool.execute("SELECT propietario_id FROM mascotas WHERE id = ?", [petId]);
            if (!pets[0] || (!isStaff(req) && Number(pets[0].propietario_id) !== ownerId)) {
                return sendError(res, 400, "INVALID_PET", "La mascota no pertenece a esta cuenta.");
            }
        }
        const [result] = await pool.execute(
            "INSERT INTO citas (propietario_id, mascota_id, tipo, asunto, fecha) VALUES (?, ?, ?, ?, ?)",
            [ownerId, petId, type, subject, `${date} 12:00:00`]
        );
        return res.status(201).json({ cita: {
            id: String(result.insertId), ownerId: String(ownerId), petId: petId ? String(petId) : null,
            type, subject, date, status: "pending"
        } });
    } catch (error) {
        return next(error);
    }
});

router.get("/appointments/:id", async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const appointment = await getAppointmentForUser(id, req);
        if (!appointment) return sendError(res, 404, "APPOINTMENT_NOT_FOUND", "No se encontró la cita.");
        return res.json({ cita: {
            id: String(appointment.id), petId: appointment.mascota_id ? String(appointment.mascota_id) : null,
            type: appointment.tipo, subject: appointment.asunto, date: appointment.fecha,
            status: appointment.estado, pet: appointment.mascota
        } });
    } catch (error) {
        return next(error);
    }
});

router.patch("/appointments/:id", async (req, res, next) => {
    const id = getId(req.params.id);
    const status = req.body?.status;
    if (!id || !appointmentStates.has(status)) return sendError(res, 400, "INVALID_INPUT", "El identificador o estado no es válido.");
    try {
        const appointment = await getAppointmentForUser(id, req);
        if (!appointment) return sendError(res, 404, "APPOINTMENT_NOT_FOUND", "No se encontró la cita.");
        if (!isStaff(req) && status !== "cancelled") return sendError(res, 403, "FORBIDDEN", "Solo el personal puede cambiar el estado de una cita.");
        await pool.execute("UPDATE citas SET estado = ? WHERE id = ?", [status, id]);
        return res.json({ mensaje: "Estado de la cita actualizado.", status });
    } catch (error) {
        return next(error);
    }
});

router.get("/adoption/animals", async (_req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado,
                    descripcion, fotos, estado
             FROM mascotas_adopcion WHERE estado = 'available' ORDER BY creado_en DESC`
        );
        return res.json({ mascotas: rows.map((row) => ({
            id: String(row.id), name: row.nombre, age: row.edad, species: row.especie,
            breed: row.raza, sex: row.sexo, size: row.tamano, vaccinated: Boolean(row.vacunado),
            sterilized: Boolean(row.esterilizado), description: row.descripcion,
            photos: typeof row.fotos === "string" ? JSON.parse(row.fotos) : row.fotos || []
        })) });
    } catch (error) {
        return next(error);
    }
});

router.post("/adoption/animals", requireRole("staff"), async (req, res, next) => {
    const body = req.body || {};
    const nombre = readName(body.name, 100);
    const edad = readName(body.age, 60);
    const especie = body.species;
    const sexo = body.sex || "unknown";
    const size = body.size;
    const raza = typeof body.breed === "string" ? body.breed.trim() : "";
    const descripcion = typeof body.description === "string" ? body.description.trim() : "";
    const fotos = Array.isArray(body.photos) ? body.photos.filter((item) => typeof item === "string" && item.length <= 500).slice(0, 10) : [];
    const photosInvalid = body.photos !== undefined &&
        (!Array.isArray(body.photos) || body.photos.length > 10 || body.photos.some((item) => typeof item !== "string" || item.length > 500));
    if (!nombre || !edad || !petSpecies.has(especie) || !petSexes.has(sexo) || !adoptionSizes.has(size) ||
        raza.length > 120 || !descripcion || descripcion.length > 5000 || photosInvalid ||
        (body.vaccinated !== undefined && typeof body.vaccinated !== "boolean") ||
        (body.sterilized !== undefined && typeof body.sterilized !== "boolean")) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa los datos de la mascota en adopción.");
    }
    try {
        const [result] = await pool.execute(
            `INSERT INTO mascotas_adopcion
             (nombre, edad, especie, raza, sexo, tamano, vacunado, esterilizado, descripcion, fotos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nombre, edad, especie, raza, sexo, size, Boolean(body.vaccinated), Boolean(body.sterilized), descripcion, JSON.stringify(fotos)]
        );
        return res.status(201).json({ id: String(result.insertId) });
    } catch (error) {
        return next(error);
    }
});

router.patch("/adoption/animals/:id", requireRole("staff"), async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    const body = req.body || {};
    const fields = [];
    const values = [];
    const stringFields = [
        ["name", "nombre", 100],
        ["age", "edad", 60],
        ["breed", "raza", 120],
        ["description", "descripcion", 5000]
    ];
    for (const [input, column, maxLength] of stringFields) {
        if (Object.hasOwn(body, input)) {
            const value = typeof body[input] === "string" ? body[input].trim() : "";
            if (!value || value.length > maxLength) return sendError(res, 400, "INVALID_INPUT", `El campo ${input} no es válido.`);
            fields.push(`${column} = ?`);
            values.push(value);
        }
    }
    const enumFields = [
        ["species", "especie", petSpecies],
        ["sex", "sexo", petSexes],
        ["size", "tamano", adoptionSizes],
        ["status", "estado", new Set(["available", "pending", "adopted"])]
    ];
    for (const [input, column, choices] of enumFields) {
        if (Object.hasOwn(body, input)) {
            if (!choices.has(body[input])) return sendError(res, 400, "INVALID_INPUT", `El campo ${input} no es válido.`);
            fields.push(`${column} = ?`);
            values.push(body[input]);
        }
    }
    for (const [input, column] of [["vaccinated", "vacunado"], ["sterilized", "esterilizado"]]) {
        if (Object.hasOwn(body, input)) {
            if (typeof body[input] !== "boolean") return sendError(res, 400, "INVALID_INPUT", `El campo ${input} no es válido.`);
            fields.push(`${column} = ?`);
            values.push(body[input]);
        }
    }
    if (Object.hasOwn(body, "photos")) {
        if (!Array.isArray(body.photos) || body.photos.length > 10 ||
            body.photos.some((photo) => typeof photo !== "string" || photo.length > 500)) {
            return sendError(res, 400, "INVALID_INPUT", "La lista de fotos no es válida.");
        }
        fields.push("fotos = ?");
        values.push(JSON.stringify(body.photos));
    }
    if (!fields.length) return sendError(res, 400, "EMPTY_UPDATE", "No se recibieron cambios.");
    values.push(id);
    try {
        const [result] = await pool.execute(`UPDATE mascotas_adopcion SET ${fields.join(", ")} WHERE id = ?`, values);
        if (!result.affectedRows) return sendError(res, 404, "ANIMAL_NOT_FOUND", "No se encontró la mascota.");
        return res.json({ mensaje: "Estado de adopción actualizado." });
    } catch (error) {
        return next(error);
    }
});

router.post("/adoption/requests", async (req, res, next) => {
    const body = req.body || {};
    const nombreSolicitante = readName(body.owner ?? body.nombreSolicitante, 150);
    const telefono = typeof body.phone === "string" ? body.phone.trim() : "";
    const direccion = readName(body.address, 255);
    const nombreMascota = readName(body.petName ?? body.pet, 100);
    const details = typeof (body.notes ?? body.details) === "string" ? (body.notes ?? body.details).trim() : "";
    const animalId = body.adoptableId ? getId(body.adoptableId) : null;
    if (!nombreSolicitante || !telefono || telefono.length > 30 || !direccion || !nombreMascota ||
        details.length > 5000 || (body.adoptableId && !animalId)) {
        return sendError(res, 400, "INVALID_INPUT", "Revisa los datos de la solicitud.");
    }
    try {
        if (animalId) {
            const [animals] = await pool.execute("SELECT id FROM mascotas_adopcion WHERE id = ? AND estado = 'available'", [animalId]);
            if (!animals.length) return sendError(res, 400, "ANIMAL_UNAVAILABLE", "La mascota ya no está disponible.");
        }
        const [result] = await pool.execute(
            `INSERT INTO solicitudes_adopcion
             (usuario_id, mascota_adopcion_id, nombre_solicitante, telefono, direccion, nombre_mascota, detalles)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [getUserId(req), animalId, nombreSolicitante, telefono, direccion, nombreMascota, details || null]
        );
        return res.status(201).json({ id: String(result.insertId), status: "pending" });
    } catch (error) {
        return next(error);
    }
});

router.get("/adoption/requests", async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT s.id, s.usuario_id, s.mascota_adopcion_id, s.nombre_solicitante, s.telefono,
                    s.direccion, s.nombre_mascota, s.detalles, s.estado, s.creado_en,
                    u.correo, a.nombre AS animal
             FROM solicitudes_adopcion s
             JOIN usuarios u ON u.id = s.usuario_id
             LEFT JOIN mascotas_adopcion a ON a.id = s.mascota_adopcion_id
             WHERE ${isStaff(req) ? "1 = 1" : "s.usuario_id = ?"}
             ORDER BY s.creado_en DESC LIMIT 300`,
            isStaff(req) ? [] : [getUserId(req)]
        );
        return res.json({ solicitudes: rows.map((row) => ({
            id: String(row.id), ownerId: String(row.usuario_id), name: row.nombre_solicitante,
            email: row.correo, phone: row.telefono, address: row.direccion, pet: row.nombre_mascota,
            animalId: row.mascota_adopcion_id ? String(row.mascota_adopcion_id) : null,
            animal: row.animal, details: row.detalles, status: row.estado, createdAt: row.creado_en
        })) });
    } catch (error) {
        return next(error);
    }
});

router.get("/adoption/requests/:id", async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [rows] = await pool.execute(
            `SELECT s.id, s.usuario_id, s.mascota_adopcion_id, s.nombre_solicitante, s.telefono,
                    s.direccion, s.nombre_mascota, s.detalles, s.estado, s.creado_en,
                    u.correo, a.nombre AS animal
             FROM solicitudes_adopcion s JOIN usuarios u ON u.id = s.usuario_id
             LEFT JOIN mascotas_adopcion a ON a.id = s.mascota_adopcion_id
             WHERE s.id = ? AND ${isStaff(req) ? "1 = 1" : "s.usuario_id = ?"}`,
            isStaff(req) ? [id] : [id, getUserId(req)]
        );
        const row = rows[0];
        if (!row) return sendError(res, 404, "REQUEST_NOT_FOUND", "No se encontró la solicitud.");
        return res.json({ solicitud: {
            id: String(row.id), ownerId: String(row.usuario_id), name: row.nombre_solicitante,
            email: row.correo, phone: row.telefono, address: row.direccion, pet: row.nombre_mascota,
            animalId: row.mascota_adopcion_id ? String(row.mascota_adopcion_id) : null,
            animal: row.animal, details: row.detalles, status: row.estado, createdAt: row.creado_en
        } });
    } catch (error) {
        return next(error);
    }
});

router.patch("/adoption/requests/:id", requireRole("staff"), async (req, res, next) => {
    const id = getId(req.params.id);
    const status = req.body?.status;
    if (!id || !["pending", "approved", "rejected"].includes(status)) {
        return sendError(res, 400, "INVALID_INPUT", "El identificador o estado no es válido.");
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute("SELECT mascota_adopcion_id, estado FROM solicitudes_adopcion WHERE id = ? FOR UPDATE", [id]);
        if (!rows.length) {
            await connection.rollback();
            return sendError(res, 404, "REQUEST_NOT_FOUND", "No se encontró la solicitud.");
        }
        if (rows[0].estado !== "pending" && rows[0].estado !== status) {
            await connection.rollback();
            return sendError(res, 409, "REQUEST_ALREADY_RESOLVED", "La solicitud ya fue resuelta.");
        }
        await connection.execute("UPDATE solicitudes_adopcion SET estado = ? WHERE id = ?", [status, id]);
        if (rows[0].mascota_adopcion_id) {
            const adoptionStatus = status === "approved" ? "adopted" : status === "rejected" ? "available" : "pending";
            await connection.execute("UPDATE mascotas_adopcion SET estado = ? WHERE id = ?", [adoptionStatus, rows[0].mascota_adopcion_id]);
        }
        await connection.commit();
        return res.json({ mensaje: "Solicitud actualizada.", status });
    } catch (error) {
        await connection.rollback();
        return next(error);
    } finally {
        connection.release();
    }
});

router.get("/recommendations", async (_req, res, next) => {
    try {
        const [rows] = await pool.execute("SELECT id, titulo, contenido FROM recomendaciones WHERE activa = TRUE ORDER BY id");
        return res.json({ recomendaciones: rows.map((row) => ({ id: String(row.id), title: row.titulo, body: row.contenido })) });
    } catch (error) {
        return next(error);
    }
});

router.post("/recommendations", requireRole("staff"), async (req, res, next) => {
    const title = readName(req.body?.title, 255);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!title || !body || body.length > 10000) return sendError(res, 400, "INVALID_INPUT", "Revisa la recomendación.");
    try {
        const [result] = await pool.execute("INSERT INTO recomendaciones (titulo, contenido) VALUES (?, ?)", [title, body]);
        return res.status(201).json({ id: String(result.insertId), title, body });
    } catch (error) {
        return next(error);
    }
});

router.patch("/recommendations/:id", requireRole("staff"), async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    const fields = [];
    const values = [];
    if (Object.hasOwn(req.body || {}, "title")) {
        const title = readName(req.body.title, 255);
        if (!title) return sendError(res, 400, "INVALID_INPUT", "El título no es válido.");
        fields.push("titulo = ?");
        values.push(title);
    }
    if (Object.hasOwn(req.body || {}, "body")) {
        if (typeof req.body.body !== "string" || !req.body.body.trim() || req.body.body.length > 10000) {
            return sendError(res, 400, "INVALID_INPUT", "El contenido no es válido.");
        }
        fields.push("contenido = ?");
        values.push(req.body.body.trim());
    }
    if (Object.hasOwn(req.body || {}, "active")) {
        if (typeof req.body.active !== "boolean") return sendError(res, 400, "INVALID_INPUT", "El estado no es válido.");
        fields.push("activa = ?");
        values.push(req.body.active);
    }
    if (!fields.length) return sendError(res, 400, "EMPTY_UPDATE", "No se recibieron cambios.");
    values.push(id);
    try {
        const [result] = await pool.execute(`UPDATE recomendaciones SET ${fields.join(", ")} WHERE id = ?`, values);
        if (!result.affectedRows) return sendError(res, 404, "RECOMMENDATION_NOT_FOUND", "No se encontró la recomendación.");
        return res.json({ mensaje: "Recomendación actualizada." });
    } catch (error) {
        return next(error);
    }
});

router.delete("/recommendations/:id", requireRole("staff"), async (req, res, next) => {
    const id = getId(req.params.id);
    if (!id) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [result] = await pool.execute("UPDATE recomendaciones SET activa = FALSE WHERE id = ?", [id]);
        if (!result.affectedRows) return sendError(res, 404, "RECOMMENDATION_NOT_FOUND", "No se encontró la recomendación.");
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.get("/chats", async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT c.id AS cita_id, c.tipo, m.nombre AS mascota,
                    (SELECT msg.contenido FROM mensajes msg WHERE msg.cita_id = c.id ORDER BY msg.creado_en DESC, msg.id DESC LIMIT 1) AS ultimo_mensaje,
                    (SELECT DATE_FORMAT(msg.creado_en, '%Y-%m-%dT%H:%i') FROM mensajes msg WHERE msg.cita_id = c.id ORDER BY msg.creado_en DESC, msg.id DESC LIMIT 1) AS ultimo_mensaje_fecha,
                    (SELECT COUNT(*) FROM mensajes msg
                     JOIN usuarios autor ON autor.id = msg.usuario_id
                     WHERE msg.cita_id = c.id AND msg.leido = FALSE AND autor.rol = ?) AS no_leidos
             FROM citas c LEFT JOIN mascotas m ON m.id = c.mascota_id
             WHERE ${isStaff(req) ? "1 = 1" : "c.propietario_id = ?"}
             ORDER BY c.fecha DESC LIMIT 200`,
            isStaff(req) ? ["client"] : ["staff", getUserId(req)]
        );
        return res.json({ chats: rows.map((row) => ({
            appointmentId: String(row.cita_id), title: `${row.mascota || "Mascota"} · ${row.tipo}`,
            unread: Number(row.no_leidos), lastMessage: row.ultimo_mensaje, lastAt: row.ultimo_mensaje_fecha
        })) });
    } catch (error) {
        return next(error);
    }
});

router.get("/appointments/:id/messages", async (req, res, next) => {
    const appointmentId = getId(req.params.id);
    if (!appointmentId) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const appointment = await getAppointmentForUser(appointmentId, req);
        if (!appointment) return sendError(res, 404, "APPOINTMENT_NOT_FOUND", "No se encontró la cita.");
        await pool.execute("UPDATE mensajes SET leido = TRUE WHERE cita_id = ? AND usuario_id <> ?", [appointmentId, getUserId(req)]);
        const [rows] = await pool.execute(
            `SELECT m.id, m.usuario_id, m.contenido, DATE_FORMAT(m.creado_en, '%Y-%m-%dT%H:%i') AS fecha,
                    (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
                      'id', a.id, 'name', a.nombre_original, 'type', a.mime_type
                    )), JSON_ARRAY())
                     FROM archivos a WHERE a.tipo_recurso = 'mensaje' AND a.recurso_id = m.id) AS archivos
             FROM mensajes m WHERE m.cita_id = ? ORDER BY m.creado_en, m.id`,
            [appointmentId]
        );
        return res.json({ mensajes: rows.map((row) => ({
            id: String(row.id), from: Number(row.usuario_id) === getUserId(req) ? "me" : "them",
            text: row.contenido, at: row.fecha,
            files: (typeof row.archivos === "string" ? JSON.parse(row.archivos) : row.archivos || [])
                .map((file) => ({ id: file.id, name: file.name, type: file.type, url: `/api/files/${file.id}` }))
        })) });
    } catch (error) {
        return next(error);
    }
});

router.post("/appointments/:id/messages", upload.array("files", 5), async (req, res, next) => {
    const appointmentId = getId(req.params.id);
    const files = req.files || [];
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!appointmentId || (!text && files.length === 0) || text.length > 5000) {
        await removeUploadedFiles(files);
        return sendError(res, 400, "INVALID_INPUT", "Escribe un mensaje o adjunta un archivo.");
    }
    try {
        const appointment = await getAppointmentForUser(appointmentId, req);
        if (!appointment) {
            await removeUploadedFiles(files);
            return sendError(res, 404, "APPOINTMENT_NOT_FOUND", "No se encontró la cita.");
        }
        const [result] = await pool.execute(
            "INSERT INTO mensajes (cita_id, usuario_id, contenido) VALUES (?, ?, ?)",
            [appointmentId, getUserId(req), text]
        );
        let attachments;
        try {
            attachments = await saveFiles(files, getUserId(req), "mensaje", result.insertId);
        } catch (error) {
            await pool.execute("DELETE FROM mensajes WHERE id = ?", [result.insertId]);
            throw error;
        }
        return res.status(201).json({ mensaje: {
            id: String(result.insertId), from: "me", text, at: new Date().toISOString().slice(0, 16),
            files: attachments.map((file) => ({ ...file, url: `/api/files/${file.id}` }))
        } });
    } catch (error) {
        await removeUploadedFiles(files);
        return next(error);
    }
});

router.post("/feedback", upload.array("files", 5), async (req, res, next) => {
    const files = req.files || [];
    const type = req.body?.type;
    const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
    const rating = req.body?.rating === undefined || req.body.rating === "" ? null : Number(req.body.rating);
    if (!["problem", "review"].includes(type) || !details || details.length > 10000 ||
        (type === "review" && (!Number.isInteger(rating) || rating < 1 || rating > 5)) ||
        (type === "problem" && rating !== null)) {
        await removeUploadedFiles(files);
        return sendError(res, 400, "INVALID_INPUT", "Revisa los detalles y la calificación.");
    }
    let reportId;
    try {
        const [result] = await pool.execute(
            "INSERT INTO reportes (usuario_id, tipo, detalles, calificacion) VALUES (?, ?, ?, ?)",
            [getUserId(req), type, details, rating]
        );
        reportId = result.insertId;
        const attachments = await saveFiles(files, getUserId(req), "reporte", result.insertId);
        return res.status(201).json({ id: String(result.insertId), files: attachments.map((file) => ({ ...file, url: `/api/files/${file.id}` })) });
    } catch (error) {
        if (reportId) await pool.execute("DELETE FROM reportes WHERE id = ?", [reportId]);
        await removeUploadedFiles(files);
        return next(error);
    }
});

router.get("/feedback", requireRole("staff"), async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT r.id, r.usuario_id, r.tipo, r.detalles, r.calificacion, r.creado_en,
                    u.nombre, u.correo
             FROM reportes r JOIN usuarios u ON u.id = r.usuario_id
             ORDER BY r.creado_en DESC LIMIT 300`
        );
        return res.json({ reportes: rows.map((row) => ({
            id: String(row.id), userId: String(row.usuario_id), name: row.nombre,
            email: row.correo, type: row.tipo, details: row.detalles,
            rating: row.calificacion, createdAt: row.creado_en
        })) });
    } catch (error) {
        return next(error);
    }
});

router.post("/appointments/:id/attachments", upload.array("files", 5), async (req, res, next) => {
    const appointmentId = getId(req.params.id);
    const files = req.files || [];
    if (!appointmentId || !files.length) {
        await removeUploadedFiles(files);
        return sendError(res, 400, "INVALID_INPUT", "Selecciona un archivo válido.");
    }
    try {
        const appointment = await getAppointmentForUser(appointmentId, req);
        if (!appointment) {
            await removeUploadedFiles(files);
            return sendError(res, 404, "APPOINTMENT_NOT_FOUND", "No se encontró la cita.");
        }
        const attachments = await saveFiles(files, getUserId(req), "cita", appointmentId);
        return res.status(201).json({ files: attachments.map((file) => ({ ...file, url: `/api/files/${file.id}` })) });
    } catch (error) {
        await removeUploadedFiles(files);
        return next(error);
    }
});

router.get("/files/:id", async (req, res, next) => {
    const fileId = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return sendError(res, 400, "INVALID_ID", "El identificador no es válido.");
    try {
        const [rows] = await pool.execute(
            `SELECT a.*, c.propietario_id
             FROM archivos a
             LEFT JOIN mensajes m ON a.tipo_recurso = 'mensaje' AND m.id = a.recurso_id
             LEFT JOIN citas c ON (a.tipo_recurso = 'cita' AND c.id = a.recurso_id)
                                OR (a.tipo_recurso = 'mensaje' AND c.id = m.cita_id)
             WHERE a.id = ?`,
            [fileId]
        );
        const file = rows[0];
        if (!file) return sendError(res, 404, "FILE_NOT_FOUND", "No se encontró el archivo.");
        const canRead = isStaff(req) || Number(file.usuario_id) === getUserId(req) ||
            (file.propietario_id && Number(file.propietario_id) === getUserId(req));
        if (!canRead) return sendError(res, 403, "FORBIDDEN", "No tienes permiso para ver este archivo.");
        const filePath = path.join(uploadDirectory, path.basename(file.nombre_almacenado));
        res.type(file.mime_type);
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.nombre_original)}`);
        return res.sendFile(filePath, (error) => {
            if (error && !res.headersSent) next(error);
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/dashboard", async (req, res, next) => {
    try {
        if (isStaff(req)) {
            const [[appointments]] = await pool.execute("SELECT COUNT(*) AS total FROM citas");
            const [[today]] = await pool.execute("SELECT COUNT(*) AS total FROM citas WHERE DATE(fecha) = CURDATE() AND estado <> 'cancelled'");
            const [[unread]] = await pool.execute(
                "SELECT COUNT(*) AS total FROM mensajes m JOIN usuarios u ON u.id = m.usuario_id WHERE u.rol = 'client' AND m.leido = FALSE",
                []
            );
            return res.json({ registered: Number(appointments.total), today: Number(today.total), unread: Number(unread.total) });
        }
        const [[upcoming]] = await pool.execute(
            "SELECT COUNT(*) AS total FROM citas WHERE propietario_id = ? AND fecha >= CURDATE() AND estado IN ('pending', 'confirmed')",
            [getUserId(req)]
        );
        const [[last]] = await pool.execute(
            "SELECT DATEDIFF(CURDATE(), MAX(fecha)) AS days FROM citas WHERE propietario_id = ? AND estado = 'completed'",
            [getUserId(req)]
        );
        const [[unread]] = await pool.execute(
            "SELECT COUNT(*) AS total FROM mensajes m JOIN citas c ON c.id = m.cita_id JOIN usuarios u ON u.id = m.usuario_id WHERE c.propietario_id = ? AND u.rol = 'staff' AND m.leido = FALSE",
            [getUserId(req)]
        );
        return res.json({
            upcoming: Number(upcoming.total),
            daysSince: last.days === null ? null : Number(last.days),
            unread: Number(unread.total)
        });
    } catch (error) {
        return next(error);
    }
});

router.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
        const tooLarge = error.code === "LIMIT_FILE_SIZE";
        return sendError(res, tooLarge ? 413 : 400, error.code, tooLarge ? "El archivo supera el límite de 10 MB." : "No se pudieron procesar los archivos.");
    }
    if (error.code === "INVALID_FILE_TYPE" || error.code === "INVALID_FILE_CONTENT") {
        return sendError(res, 400, error.code, error.message);
    }
    if (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE") {
        console.error("Esquema de base de datos incompleto:", error.code);
        return sendError(res, 503, "SCHEMA_NOT_READY", "Aplica database/schema.sql y la migración indicada en el README.");
    }
    if (["ECONNREFUSED", "ETIMEDOUT", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "ER_NO_REFERENCED_ROW_2", "ER_DUP_ENTRY", "PROTOCOL_CONNECTION_LOST"].includes(error.code)) {
        console.error("Error de base de datos en la API:", error.code);
        return sendError(res, error.code === "ER_DUP_ENTRY" ? 409 : 503, error.code === "ER_DUP_ENTRY" ? "CONFLICT" : "DATABASE_UNAVAILABLE",
            error.code === "ER_DUP_ENTRY" ? "El registro ya existe." : "La base de datos no está disponible.");
    }
    console.error("Error inesperado en la API:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Ocurrió un error interno.");
});

module.exports = router;
