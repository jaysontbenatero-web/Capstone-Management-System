require("dotenv").config();
const mysql = require('mysql2');
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "capx_db",
    port: 3307
});

db.query("ALTER TABLE document_submissions ADD COLUMN target_role VARCHAR(50) NULL DEFAULT NULL", (err, res) => {
    if (err) console.log("ALTER result:", err.message);
    else console.log("ALTER successful! target_role column added.");
    db.end();
});
