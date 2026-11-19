require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const config = {
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "capx_db",
    port: 3307
};

function connectDB(cb) {
    const db = mysql.createConnection(config);
    db.connect((err) => {
        if (err) {
            console.error("Database connection failed on port 3307, trying 3306...", err.message);
            const dbFallback = mysql.createConnection({ ...config, port: 3306 });
            dbFallback.connect((err2) => {
                if (err2) {
                    console.error("Database connection error on 3306:", err2.message);
                    process.exit(1);
                }
                cb(dbFallback);
            });
        } else {
            cb(db);
        }
    });
}

function queryAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

connectDB(async (db) => {
    console.log("=== Cleaning Database (Keeping Admin, Faculty & Repository) ===");

    const tablesToTruncate = [
        "adviser_requests",
        "announcements",
        "capstone_groups",
        "consultations",
        "defense_minutes",
        "defense_panel_evaluations",
        "defense_schedule_panelists",
        "defense_schedules",
        "document_submissions",
        "env_scan_student_signatures",
        "faculty_document_submissions",
        "faculty_documents",
        "group_members",
        "messages",
        "student_documents",
        "student_hidden_updates",
        "title_proposals",
        "title_similarity_results",
        "typed_defense_minutes",
        "user_notifications"
    ];

    try {
        await queryAsync(db, "SET FOREIGN_KEY_CHECKS = 0");

        const delUsers = await queryAsync(
            db,
            "DELETE FROM users WHERE LOWER(role) NOT IN ('admin', 'administrator', 'faculty')"
        );
        console.log(`[OK] Deleted ${delUsers.affectedRows} non-admin/non-faculty user(s).`);

        await queryAsync(
            db,
            "DELETE FROM adviser_settings WHERE faculty_id NOT IN (SELECT id FROM users)"
        );

        for (const table of tablesToTruncate) {
            await queryAsync(db, `TRUNCATE TABLE \`${table}\``);
            console.log(`[OK] Truncated: ${table}`);
        }

        await queryAsync(db, "SET FOREIGN_KEY_CHECKS = 1");

        // Collect files referenced by kept admin/faculty users so we don't delete their avatars/signatures
        const keptUsers = await queryAsync(
            db,
            "SELECT id, user_id, fullname, role, profile_image, digital_signature FROM users ORDER BY id"
        );
        const keptFileBasenames = new Set();
        keptUsers.forEach((u) => {
            if (u.profile_image) keptFileBasenames.add(path.basename(u.profile_image));
            if (u.digital_signature) keptFileBasenames.add(path.basename(u.digital_signature));
        });

        const uploadsDir = path.join(__dirname, "..", "uploads");
        if (fs.existsSync(uploadsDir)) {
            const subdirs = fs.readdirSync(uploadsDir);
            for (const dir of subdirs) {
                const dirPath = path.join(uploadsDir, dir);
                if (!fs.statSync(dirPath).isDirectory()) continue;
                const files = fs.readdirSync(dirPath);
                let removed = 0;
                for (const file of files) {
                    if ((dir === "profile_images" || dir === "signatures") && keptFileBasenames.has(file)) {
                        continue;
                    }
                    try {
                        fs.unlinkSync(path.join(dirPath, file));
                        removed++;
                    } catch (_) {}
                }
                console.log(`[OK] Cleaned uploads/${dir}: removed ${removed} file(s).`);
            }
        }

        const repoCountRes = await queryAsync(db, "SELECT COUNT(*) AS count FROM repository");
        console.log("\n--- VERIFICATION ---");
        console.log("Remaining Users:", keptUsers.map((u) => ({
            id: u.id,
            user_id: u.user_id,
            fullname: u.fullname,
            role: u.role
        })));
        console.log("Repository Rows Preserved:", repoCountRes[0].count);
    } catch (err) {
        console.error("Cleanup error:", err);
        process.exitCode = 1;
    } finally {
        db.end();
    }
});
