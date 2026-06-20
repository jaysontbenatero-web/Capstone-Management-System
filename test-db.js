const mysql = require('mysql2');
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "capstone123",
    database: "capx_db",
    port: 3307
});

// Check defense_panels table
db.query("DESCRIBE defense_panels", (err, res) => {
    if (err) console.log("defense_panels:", err.message);
    else console.log("defense_panels columns:", res.map(r => r.Field).join(', '));
});

// Check defense_schedules table
db.query("DESCRIBE defense_schedules", (err, res) => {
    if (err) console.log("defense_schedules:", err.message);
    else console.log("defense_schedules columns:", res.map(r => r.Field).join(', '));
    db.end();
});
