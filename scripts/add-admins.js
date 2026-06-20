const mysql = require("mysql2/promise");

const ADMINS = [
    { user_id: "ADM2026-0002", fullname: "ADM2026-0002", password: "12345" },
    { user_id: "ADM2026-0003", fullname: "ADM2026-0003", password: "12345" }
];

async function main() {
    const conn = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "capstone123",
        database: "capx_db",
        port: 3307
    });

    const [existing] = await conn.query(
        "SELECT user_id, fullname, password, role, position, adviser_access, panelist_access, instructor_access, force_password_change FROM users WHERE role = 'admin'"
    );
    console.log("Existing admin template:", existing[0] || "(none)");

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
                admin.password,
                template.position || "Dean",
                template.program || "Dean Office",
                template.adviser_access ?? 1,
                template.panelist_access ?? 1,
                template.instructor_access ?? 1,
                template.force_password_change ?? 0
            ]
        );

        console.log(`Added: ${admin.user_id} (${admin.fullname}) password: ${admin.password}`);
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
