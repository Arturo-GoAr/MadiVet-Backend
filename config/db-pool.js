const mysql = require("mysql2/promise");

const requiredEnvironment = ["DB_HOST", "DB_USER", "DB_NAME"];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);

if (missingEnvironment.length > 0) {
    throw new Error(`Faltan variables de entorno de MySQL: ${missingEnvironment.join(", ")}`);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
