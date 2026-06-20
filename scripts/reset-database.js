/**
 * Reset CapstoneX database to a clean state.
 * Keeps only admin user(s). Clears groups, defenses, documents, messages, etc.
 *
 * Usage: node scripts/reset-database.js --confirm
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
    host: "localhost",
    user: "root",
    password: "capstone123",
    database: "capx_db",
    port: 3307,
    multipleStatements: true
};

const TABLES_TO_TRUNCATE = [
    "defense_panel_evaluations",
    "defense_schedule_panelists",
    "defense_schedules",
    "document_submissions",
    "student_documents",
    "faculty_document_submissions",
    "faculty_documents",
    "title_proposals",
    "title_similarity_results",
    "adviser_requests",
    "group_members",
    "student_hidden_updates",
    "user_notifications",
    "announcements",
    "messages",
    "capstone_groups",
    "adviser_settings",
    "consultations"
];

const UPLOAD_SUBDIRS = [
    "title_proposals",
    "student_documents",
    "profile_images",
    "chat_files"
];

function clearUploads(projectRoot) {
    const uploadsRoot = path.join(projectRoot, "uploads");

    if (!fs.existsSync(uploadsRoot)) {
        fs.mkdirSync(uploadsRoot, { recursive: true });
        return { removed: 0 };
    }

    let removed = 0;

    for (const sub of UPLOAD_SUBDIRS) {
        const dir = path.join(uploadsRoot, sub);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            continue;
        }

        for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);

            if (fs.statSync(fullPath).isFile()) {
                fs.unlinkSync(fullPath);
                removed += 1;
            }
        }
    }

    for (const entry of fs.readdirSync(uploadsRoot)) {
        const fullPath = path.join(uploadsRoot, entry);

        if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
            removed += 1;
        }
    }

    return { removed };
}

async function resetDatabase() {
    if (!process.argv.includes("--confirm")) {
        console.error(
            "This will DELETE all data except admin accounts.\n" +
                "Run: node scripts/reset-database.js --confirm"
        );
        process.exit(1);
    }

    const conn = await mysql.createConnection(DB_CONFIG);

    try {
        await conn.beginTransaction();
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");

        for (const table of TABLES_TO_TRUNCATE) {
            await conn.query(`TRUNCATE TABLE \`${table}\``);
            console.log(`  cleared: ${table}`);
        }

        const [deleteResult] = await conn.query(
            "DELETE FROM users WHERE role <> 'admin'"
        );
        console.log(`  removed non-admin users: ${deleteResult.affectedRows}`);

        const [admins] = await conn.query(
            `SELECT id, user_id, fullname FROM users WHERE role = 'admin' ORDER BY id ASC`
        );

        if (admins.length === 0) {
            throw new Error(
                "No admin account found. Aborting — create an admin user first."
            );
        }

        let nextId = 1;

        for (const admin of admins) {
            if (Number(admin.id) !== nextId) {
                await conn.query("UPDATE users SET id = ? WHERE id = ?", [
                    nextId,
                    admin.id
                ]);
                console.log(
                    `  admin ${admin.user_id} (${admin.fullname}): id ${admin.id} -> ${nextId}`
                );
            } else {
                console.log(
                    `  kept admin: ${admin.user_id} (${admin.fullname}) id=${nextId}`
                );
            }

            nextId += 1;
        }

        await conn.query(`ALTER TABLE users AUTO_INCREMENT = ${nextId}`);

        const autoTables = [
            ...TABLES_TO_TRUNCATE,
            "users"
        ];

        for (const table of autoTables) {
            if (table === "users") {
                continue;
            }

            await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
        }

        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
        await conn.commit();

        const uploadResult = clearUploads(path.join(__dirname, ".."));

        console.log("\nDatabase reset complete.");
        console.log(`Admin account(s) kept: ${admins.length}`);
        console.log(`Upload files removed: ${uploadResult.removed}`);
        console.log(
            "\nNext steps: restart the server, clear browser localStorage (or log out), and enroll fresh test users."
        );
    } catch (err) {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
        await conn.rollback().catch(() => {});
        console.error("Reset failed:", err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

resetDatabase();
