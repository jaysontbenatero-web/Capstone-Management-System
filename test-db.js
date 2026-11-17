require("dotenv").config();
const mysql = require('mysql2');
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "capx_db",
    port: Number(process.env.DB_PORT) || 3307
});

db.query("ALTER TABLE document_submissions ADD COLUMN target_role VARCHAR(50) NULL DEFAULT NULL", (err, res) => {
    if (err) console.log("ALTER result:", err.message);
    else console.log("ALTER successful! target_role column added.");
    db.end();
});
