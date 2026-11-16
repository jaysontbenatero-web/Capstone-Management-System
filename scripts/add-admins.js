require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

/**
 * add-admins.js — seed new admin accounts.
 * User IDs are generated dynamically: ADM<currentYear>-XXXX
 * Edit the ADMINS array below to add more accounts.
 * Duplicate user_ids are skipped automatically.
 */

async function main() {
    const year = new Date().getFullYear();

    const conn = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: process.env.DB_PASSWORD,
        database: "capx_db",
        port: 3307
    });

    // Get the last ADM<year> number so we can continue the sequence
    const [lastRows] = await conn.query(
        `SELECT user_id FROM users
         WHERE user_id LIKE 'ADM${year}-%'
         ORDER BY CAST(SUBSTRING_INDEX(user_id, '-', -1) AS UNSIGNED) DESC
         LIMIT 1`
    );

    let nextNumber = 1;
    if (lastRows.length > 0) {
        const lastId = lastRows[0].user_id;
        nextNumber = parseInt(lastId.split("-")[1]) + 1;
    }

    // ── Define how many new admin accounts to seed ───────────────────────────
    // Change this number to seed more or fewer accounts at once
    const COUNT_TO_ADD = 2;

    const ADMINS = [];
    for (let i = 0; i < COUNT_TO_ADD; i++) {
        const uid = `ADM${year}-${String(nextNumber + i).padStart(4, "0")}`;
        ADMINS.push({ user_id: uid, fullname: uid, password: "12345" });
    }

    console.log(`Year: ${year} | Starting from ADM${year}-${String(nextNumber).padStart(4, "0")}`);
    console.log("Accounts to add:", ADMINS.map(a => a.user_id).join(", "));

    // Get template from existing admin (copies position, access flags, etc.)
    const [existing] = await conn.query(
        "SELECT user_id, fullname, password, role, position, adviser_access, panelist_access, instructor_access, force_password_change FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    console.log("Template admin:", existing[0] ? existing[0].user_id : "(none — using defaults)");

    const template = existing[0] || {
        role: "admin",
        position: null,
        adviser_access: 0,
        panelist_access: 0,
        instructor_access: 0,
        force_password_change: 0
    };

    for (const admin of ADMINS) {
        const [rows] = await conn.query(
            "SELECT id FROM users WHERE user_id = ?",
            [admin.user_id]
        );

        if (rows.length > 0) {
            console.log(`Skip (exists): ${admin.user_id}`);
            continue;
        }

        const hashedPassword = await bcrypt.hash(String(admin.password), 10);

        await conn.query(
            `INSERT INTO users
            (
                user_id, fullname, password, role, position, program,
                adviser_access, panelist_access, instructor_access, force_password_change
            )
            VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?)`,
            [
                admin.user_id,
                admin.fullname,
                hashedPassword,
                template.position || "Dean",
                template.program || "Dean Office",
                template.adviser_access ?? 1,
                template.panelist_access ?? 1,
                template.instructor_access ?? 1,
                template.force_password_change ?? 0
            ]
        );

        console.log(`Added: ${admin.user_id} password: ${admin.password}`);
    }

    const [all] = await conn.query(
        "SELECT id, user_id, fullname, role FROM users WHERE role = 'admin' ORDER BY user_id"
    );
    console.log("\nAll admins:", all);
    await conn.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
