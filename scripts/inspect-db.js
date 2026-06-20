const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "capstone123",
    database: "capx_db",
    port: 3307
});

db.query("SHOW TABLES", (err, tables) => {
    if (err) return console.error(err);
    const names = tables.map((r) => Object.values(r)[0]);
    console.log("TABLES:\n", names.join("\n"));

    db.query(
        `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = 'capx_db' AND REFERENCED_TABLE_NAME IS NOT NULL`,
        (err2, fks) => {
            console.log("\nFOREIGN KEYS:\n", JSON.stringify(fks, null, 2));

            db.query(
                `SELECT id, user_id, fullname, role FROM users ORDER BY id`,
                (err3, users) => {
                    console.log("\nUSERS:\n", users);
                    db.end();
                }
            );
        }
    );
});
