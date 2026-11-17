require("dotenv").config();

const express = require("express");
const path = require("node:path");
const pool = require("./config/db-pool");
const api = require("./routes/api");

const app = express();
const port = Number(process.env.API_PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET debe estar definido y tener al menos 32 caracteres.");
}

app.disable("x-powered-by");
// CORS: el frontend (Next, otro origen) llama a la API con Bearer token. FRONTEND_ORIGIN admite varios orígenes separados por coma.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").split(",");
app.use("/api", (req, res, next) => {
    if (allowedOrigins.includes(req.headers.origin)) {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    return req.method === "OPTIONS" ? res.sendStatus(204) : next();
});
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (_req, res) => {
    try {
        await pool.query("SELECT id, rol, telefono FROM usuarios LIMIT 0");
        for (const table of ["mascotas", "vacunas", "citas", "mascotas_adopcion", "solicitudes_adopcion", "recomendaciones", "mensajes", "reportes", "archivos"]) {
            await pool.query(`SELECT 1 FROM \`${table}\` LIMIT 0`);
        }
        return res.json({ estado: "ok", baseDeDatos: "conectada", esquema: "listo" });
    } catch (error) {
        console.error("Error comprobando la conexión MySQL:", error.code || "UNKNOWN");
        const schemaError = ["ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE"].includes(error.code);
        return res.status(503).json({
            codigo: schemaError ? "SCHEMA_NOT_READY" : "DATABASE_UNAVAILABLE",
            mensaje: schemaError
                ? "Falta aplicar database/schema.sql y, para una base existente, database/migrations/001_backend_completo.sql."
                : "No se pudo conectar con MySQL."
        });
    }
});

app.use("/api", api);

app.use("/api", (_req, res) => {
    res.status(404).json({ codigo: "NOT_FOUND", mensaje: "La ruta solicitada no existe." });
});

app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
        return res.status(400).json({
            codigo: "INVALID_JSON",
            mensaje: "El cuerpo de la solicitud no es JSON válido."
        });
    }
    console.error("Error inesperado en el servidor:", error);
    return res.status(500).json({
        codigo: "INTERNAL_ERROR",
        mensaje: "Ocurrió un error interno."
    });
});

app.listen(port, () => {
    console.log(`API MädiVet escuchando en http://localhost:${port}`);
});
