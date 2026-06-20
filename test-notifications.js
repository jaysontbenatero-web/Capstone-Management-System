const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    port: 3307,
    user: "root",
    password: "capstone123",
    database: "capx_db"
});

db.connect((err) => {
    if (err) {
        console.error("DB connection error:", err);
        process.exit(1);
    }
    console.log("Connected to DB");

    db.query("SELECT * FROM user_notifications ORDER BY id DESC LIMIT 20", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("--- LATEST NOTIFICATIONS ---");
            console.log(rows);
        }
        db.end();
    });
});
