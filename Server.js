const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { PDFDocument } = require("pdf-lib");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(bodyParser.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= PROFILE IMAGE UPLOAD SETUP ================= */

const profileImageStorage = multer.diskStorage({
    destination:function(req, file, cb){

        const uploadPath =
            path.join(
                __dirname,
                "uploads",
                "profile_images"
            );

        if(!fs.existsSync(uploadPath)){

            fs.mkdirSync(
                uploadPath,
                {
                    recursive:true
                }
            );

        }

        cb(null, uploadPath);

    },

    filename:function(req, file, cb){

        const uniqueName =
            Date.now()
            + "-"
            + Math.round(Math.random() * 1E9)
            + path.extname(file.originalname);

        cb(null, uniqueName);

    }
});

const profileImageUpload = multer({
    storage:profileImageStorage,

    fileFilter:function(req, file, cb){

        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        if(!allowedTypes.includes(file.mimetype)){

            return cb(
                new Error("Only JPG, PNG, and WEBP images are allowed.")
            );

        }

        cb(null, true);

    },

    limits:{
        fileSize:5 * 1024 * 1024
    }
});

const signatureImageStorage = multer.diskStorage({
    destination:function(req, file, cb){

        const uploadPath =
            path.join(
                __dirname,
                "uploads",
                "signatures"
            );

        if(!fs.existsSync(uploadPath)){
            fs.mkdirSync(uploadPath, { recursive:true });
        }

        cb(null, uploadPath);

    },

    filename:function(req, file, cb){

        const uniqueName =
            Date.now()
            + "-"
            + Math.round(Math.random() * 1E9)
            + path.extname(file.originalname);

        cb(null, uniqueName);

    }
});

const signatureImageUpload = multer({
    storage:signatureImageStorage,

    fileFilter:function(req, file, cb){

        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/x-png",
            "image/pjpeg",
            "application/octet-stream"
        ];

        const allowedExt = [
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        ];

        const ext =
            path.extname(file.originalname || "").toLowerCase();

        if(
            allowedTypes.includes(file.mimetype)
            || allowedExt.includes(ext)
        ){

            return cb(null, true);

        }

        return cb(
            new Error("Only JPG, PNG, and WEBP images are allowed.")
        );

    },

    limits:{
        fileSize:5 * 1024 * 1024
    }
});

const titleProposalStorage = multer.diskStorage({
    destination: function(req, file, cb){
        const uploadPath = path.join(__dirname, "uploads", "title_proposals");

        if(!fs.existsSync(uploadPath)){
            fs.mkdirSync(uploadPath, {
                recursive:true
            });
        }

        cb(null, uploadPath);
    },

    filename: function(req, file, cb){
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const titleProposalUpload = multer({
    storage:titleProposalStorage,

    fileFilter:function(req, file, cb){
        if(file.mimetype !== "application/pdf"){
            return cb(new Error("Only PDF files are allowed."));
        }

        cb(null, true);
    },

    limits:{
        fileSize: 20 * 1024 * 1024
    }
});

/* ================= STUDENT DOCUMENT UPLOAD SETUP ================= */

const studentDocumentStorage = multer.diskStorage({
    destination:function(req, file, cb){

        const uploadPath =
            path.join(
                __dirname,
                "uploads",
                "student_documents"
            );

        if(!fs.existsSync(uploadPath)){

            fs.mkdirSync(
                uploadPath,
                {
                    recursive:true
                }
            );

        }

        cb(null, uploadPath);

    },

    filename:function(req, file, cb){

        const uniqueName =
            Date.now()
            + "-"
            + Math.round(Math.random() * 1E9)
            + path.extname(file.originalname);

        cb(null, uniqueName);

    }
});

const studentDocumentUpload = multer({
    storage:studentDocumentStorage,

    fileFilter:function(req, file, cb){

        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if(!allowedTypes.includes(file.mimetype)){

            return cb(
                new Error("Only PDF, DOC, and DOCX files are allowed.")
            );

        }

        cb(null, true);

    },

    limits:{
        fileSize:20 * 1024 * 1024
    }
});

/* ================= DATABASE ================= */

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "capstone123",
    database: "capx_db",
    port: 3307
});

/* ================= CONNECT ================= */

db.connect((err) => {
    if (err) {
        console.log(err);
    } else {
        console.log("MySQL Connected");
        const checkOwnershipColumnSql = `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'users'
            AND column_name = 'enrolled_by_user_id'
            LIMIT 1
        `;

        db.query(checkOwnershipColumnSql, (checkErr, checkResult) => {
            if (checkErr) {
                console.error(
                    "Unable to check users.enrolled_by_user_id column (bulk enrollment/instructor scoping may not work):",
                    checkErr
                );
                return;
            }

            if (Array.isArray(checkResult) && checkResult.length > 0) {
                console.log("users.enrolled_by_user_id column already exists");
                return;
            }

            const addOwnershipColumnSql = `
                ALTER TABLE users
                ADD COLUMN enrolled_by_user_id VARCHAR(50) NULL
            `;

            db.query(addOwnershipColumnSql, (addErr) => {
                if (addErr) {
                    console.error(
                        "Unable to add users.enrolled_by_user_id column (bulk enrollment/instructor scoping may not work):",
                        addErr
                    );
                } else {
                    console.log("users.enrolled_by_user_id column created");
                }
            });
        });

        const checkSignatureColumnSql = `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'users'
            AND column_name = 'digital_signature'
            LIMIT 1
        `;

        db.query(checkSignatureColumnSql, (sigCheckErr, sigCheckResult) => {
            if(sigCheckErr){
                console.error(
                    "Unable to check users.digital_signature column:",
                    sigCheckErr
                );
                return;
            }

            if(Array.isArray(sigCheckResult) && sigCheckResult.length > 0){
                console.log("users.digital_signature column already exists");
                return;
            }

            db.query(
                `ALTER TABLE users ADD COLUMN digital_signature VARCHAR(500) NULL`,
                (sigAddErr) => {
                    if(sigAddErr){
                        console.error(
                            "Unable to add users.digital_signature column:",
                            sigAddErr
                        );
                    }else{
                        console.log("users.digital_signature column created");
                    }
                }
            );
        });

        const checkSignedFileColumnSql = `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'student_documents'
            AND column_name = 'signed_file_path'
            LIMIT 1
        `;

        db.query(checkSignedFileColumnSql, (signedColErr, signedColResult) => {
            if(signedColErr){
                console.error("Unable to check student_documents.signed_file_path column:", signedColErr);
                return;
            }

            if(Array.isArray(signedColResult) && signedColResult.length > 0){
                console.log("student_documents.signed_file_path column already exists");
                return;
            }

            db.query(
                `ALTER TABLE student_documents ADD COLUMN signed_file_path VARCHAR(500) NULL`,
                (signedAddErr) => {
                    if(signedAddErr){
                        console.error("Unable to add student_documents.signed_file_path column:", signedAddErr);
                    }else{
                        console.log("student_documents.signed_file_path column created");
                    }
                }
            );
        });

        const createMessagesTable = `
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id VARCHAR(50) NOT NULL,
                receiver_id VARCHAR(50) NOT NULL,
                message_text TEXT NULL,
                file_path VARCHAR(255) NULL,
                file_name VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        db.query(createMessagesTable, (error) => {
            if (error) {
                console.error("Error creating messages table:", error);
            } else {
                console.log("Messages table verified/created");
            }
        });

        const createPanelEvaluationsTable = `
            CREATE TABLE IF NOT EXISTS defense_panel_evaluations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                schedule_id INT NOT NULL,
                panelist_id INT NOT NULL,
                score VARCHAR(20) NULL,
                panel_result VARCHAR(100) NULL,
                comments TEXT NULL,
                recommendations TEXT NULL,
                approved_title_id INT NULL,
                concept_evaluation_details LONGTEXT NULL,
                outline_evaluation_details LONGTEXT NULL,
                evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_panel_schedule (schedule_id, panelist_id)
            )
        `;

        db.query(createPanelEvaluationsTable, (panelEvalTableErr) => {
            if(panelEvalTableErr){
                console.error("Error creating defense_panel_evaluations table:", panelEvalTableErr);
            }else{
                console.log("defense_panel_evaluations table verified/created");
            }
        });

        const checkProposedObjectivesColumnSql = `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'title_proposals'
            AND column_name = 'proposed_objectives'
            LIMIT 1
        `;

        db.query(checkProposedObjectivesColumnSql, (err, result) => {
            if (err) {
                console.error("Unable to check title_proposals.proposed_objectives column:", err);
                return;
            }
            if (Array.isArray(result) && result.length > 0) {
                console.log("title_proposals.proposed_objectives column already exists");
            } else {
                const addObjColumnSql = `
                    ALTER TABLE title_proposals
                    ADD COLUMN proposed_objectives TEXT NULL
                `;
                db.query(addObjColumnSql, (addErr) => {
                    if (addErr) {
                        console.error("Unable to add title_proposals.proposed_objectives column:", addErr);
                    } else {
                        console.log("title_proposals.proposed_objectives column created successfully");
                    }
                });
            }
        });

        const createSimilarityResultsTable = `
            CREATE TABLE IF NOT EXISTS title_similarity_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(50) NOT NULL,
                proposed_title_id INT NOT NULL,
                matched_repository_id INT NOT NULL,
                similarity_percentage INT NOT NULL,
                similarity_level VARCHAR(50) NOT NULL,
                matching_sections TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_proposal (proposed_title_id),
                FOREIGN KEY (proposed_title_id) REFERENCES title_proposals(id) ON DELETE CASCADE,
                FOREIGN KEY (matched_repository_id) REFERENCES repository(id) ON DELETE CASCADE
            )
        `;
        db.query(createSimilarityResultsTable, (tableErr) => {
            if (tableErr) {
                console.error("Error creating title_similarity_results table:", tableErr);
            } else {
                console.log("title_similarity_results table verified/created");
            }
        });
    }
});

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {

    const {
        userId,
        password
    } = req.body;

    if(!userId || !password){

        return res.json({
            success:false,
            message:"Please enter your User ID and password."
        });

    }

    const sql = `
        SELECT *
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(sql, [userId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error during login."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                errorType:"user_not_found",
                message:"User ID not found. Please check your User ID and try again."
            });

        }

        const user = result[0];

        if(user.password !== password){
            return res.json({
                success:false,
                errorType:"incorrect_password",
                message:"Incorrect password. Please verify your password and try again."
            });
        }

        return res.json({
            success:true,
            message:"Login successful.",
            fullname:user.fullname,
            userId:user.user_id,
            role:user.role,
            student_position:user.student_position,
            adviser_access:user.adviser_access || 0,
            panelist_access:user.panelist_access || 0,
            instructor_access:user.instructor_access || 0,
            forcePasswordChange:user.force_password_change || 0
        });

    });

});

/* ================= ENROLL FACULTY ================= */

app.post("/enroll-faculty", (req, res) => {
    const { fullname, position } = req.body;

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'FAC2026-%'
        ORDER BY CAST(SUBSTRING_INDEX(user_id, '-', -1) AS UNSIGNED) DESC
        LIMIT 1
    `;

    db.query(sqlLast, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        let nextNumber = 1;

        if (result.length > 0) {
            const lastId = result[0].user_id;
            const numberPart = parseInt(lastId.split("-")[1]);
            nextNumber = numberPart + 1;
        }

        const facultyId = `FAC2026-${String(nextNumber).padStart(4, "0")}`;
        const tempPassword = "FAC" + Math.floor(1000 + Math.random() * 9000);

        const sqlInsert = `
            INSERT INTO users
            (
                user_id,
                fullname,
                password,
                role,
                position
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(
            sqlInsert,
            [facultyId, fullname, tempPassword, "faculty", position],
            (err) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                res.json({
                    success: true,
                    facultyId,
                    tempPassword
                });
            }
        );
    });
});

/* ================= LOAD FACULTY ================= */

app.get("/faculty-accounts", (req, res) => {
    const sql = `
        SELECT *
        FROM users
        WHERE role = 'faculty'
        ORDER BY id DESC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({
            success: true,
            faculty: result
        });
    });
});

/* ================= DELETE FACULTY ================= */

app.delete("/delete-faculty/:id", (req, res) => {
    const sql = `
        DELETE FROM users
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({ success: true });
    });
});

/* ================= EDIT FACULTY ================= */

app.put("/edit-faculty", (req, res) => {
    const { id, position, password } = req.body;

    const sql = `
        UPDATE users
        SET
            position = ?,
            password = ?
        WHERE id = ?
    `;

    db.query(sql, [position, password, id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({ success: true });
    });
});

/* ================= ROLE ACCESS ================= */

app.put("/update-role", (req, res) => {
    const { id, roleField, value } = req.body;

    const allowedFields = [
        "adviser_access",
        "panelist_access",
        "instructor_access"
    ];

    if (!allowedFields.includes(roleField)) {
        return res.json({ success: false });
    }

    const sql = `
        UPDATE users
        SET ${roleField} = ?
        WHERE id = ?
    `;

    db.query(sql, [value ? 1 : 0, id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({ success: true });
    });
});

/* ================= ENROLL STUDENT ================= */

app.post("/enroll-student", (req, res) => {
    const {
        fullname,
        program,
        year_level,
        student_position,
        enrolledByUserId
    } = req.body;

    const position = student_position || "Not Assigned";

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'STU2026-%'
        ORDER BY CAST(SUBSTRING_INDEX(user_id, '-', -1) AS UNSIGNED) DESC
        LIMIT 1
    `;

    db.query(sqlLast, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        let nextNumber = 1;

        if (result.length > 0) {
            const lastId = result[0].user_id;
            const numberPart = parseInt(lastId.split("-")[1]);
            nextNumber = numberPart + 1;
        }

        const studentId = `STU2026-${String(nextNumber).padStart(4, "0")}`;
        const tempPassword = Math.random().toString(36).slice(-8);

        const sqlInsert = `
            INSERT INTO users
            (
                user_id,
                fullname,
                password,
                role,
                program,
                year_level,
                student_position,
                enrolled_by_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sqlInsert,
            [
                studentId,
                fullname,
                tempPassword,
                "student",
                program,
                year_level,
                position,
                enrolledByUserId || null
            ],
            (err) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                res.json({
                    success: true,
                    studentId,
                    tempPassword
                });
            }
        );
    });
});

/* ================= LOAD STUDENTS ================= */

app.get("/student-accounts", (req, res) => {
    const {
        scope,
        enrolledByUserId
    } = req.query;

    const isMine = String(scope || "").toLowerCase() === "mine";

    const sql = `
        SELECT *
        FROM users
        WHERE role = 'student'
        ${isMine ? "AND enrolled_by_user_id = ?" : ""}
        ORDER BY id DESC
    `;

    const params =
        isMine
            ? [enrolledByUserId || ""]
            : [];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({
            success: true,
            students: result
        });
    });
});

/* ================= DELETE STUDENT ================= */

app.delete("/delete-student/:id", (req, res) => {
    const {
        requestorRole,
        requestorUserId
    } = req.query;

    if (String(requestorRole || "").toLowerCase() !== "admin") {
        const ownerSql = `
            SELECT id
            FROM users
            WHERE id = ?
            AND role = 'student'
            AND enrolled_by_user_id = ?
            LIMIT 1
        `;

        return db.query(
            ownerSql,
            [
                req.params.id,
                requestorUserId || ""
            ],
            (err, ownerResult) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                if (ownerResult.length === 0) {
                    return res.json({
                        success: false,
                        message: "You can only delete students you enrolled."
                    });
                }

                const sql = `
                    DELETE FROM users
                    WHERE id = ?
                `;

                db.query(sql, [req.params.id], (err) => {
                    if (err) {
                        console.log(err);
                        return res.json({ success: false });
                    }

                    res.json({ success: true });
                });
            }
        );
    }

    const sql = `
        DELETE FROM users
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({ success: true });
    });
});

/* ================= EDIT STUDENT ================= */

app.put("/edit-student", (req, res) => {
    const {
        id,
        fullname,
        program,
        year_level,
        student_position,
        password,
        requestorRole,
        requestorUserId
    } = req.body;

    if (String(requestorRole || "").toLowerCase() !== "admin") {
        const ownerSql = `
            SELECT id
            FROM users
            WHERE id = ?
            AND role = 'student'
            AND enrolled_by_user_id = ?
            LIMIT 1
        `;

        return db.query(
            ownerSql,
            [
                id,
                requestorUserId || ""
            ],
            (err, ownerResult) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                if (ownerResult.length === 0) {
                    return res.json({
                        success: false,
                        message: "You can only edit students you enrolled."
                    });
                }

                const sql = `
                    UPDATE users
                    SET
                        fullname = ?,
                        program = ?,
                        year_level = ?,
                        student_position = ?,
                        password = ?
                    WHERE id = ?
                `;

                db.query(
                    sql,
                    [
                        fullname,
                        program,
                        year_level,
                        student_position,
                        password,
                        id
                    ],
                    (err) => {
                        if (err) {
                            console.log(err);
                            return res.json({ success: false });
                        }

                        res.json({ success: true });
                    }
                );
            }
        );
    }

    const sql = `
        UPDATE users
        SET
            fullname = ?,
            program = ?,
            year_level = ?,
            student_position = ?,
            password = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            fullname,
            program,
            year_level,
            student_position,
            password,
            id
        ],
        (err) => {
            if (err) {
                console.log(err);
                return res.json({ success: false });
            }

            res.json({ success: true });
        }
    );
});

/* ================= BULK ENROLL STUDENTS (CSV -> JSON) ================= */

app.post("/bulk-enroll-students", (req, res) => {
    const {
        students,
        enrolledByUserId
    } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
        return res.json({
            success: false,
            message: "No students provided."
        });
    }

    const normalizedRows = students.map((s) => ({
        fullname: String(s.fullname || "").trim(),
        program: String(s.program || "").trim(),
        year_level: String(s.year_level || "").trim(),
        student_position: String(s.student_position || "").trim() || "Not Assigned"
    }));

    const invalidIndex = normalizedRows.findIndex((s) =>
        !s.fullname ||
        !s.program ||
        !s.year_level
    );

    if (invalidIndex !== -1) {
        return res.json({
            success: false,
            message: `Row ${invalidIndex + 1} is missing required fields (fullname, program, year_level).`
        });
    }

    const invalidYearIndex = normalizedRows.findIndex((s) => (
        s.year_level !== "3rd Year" && s.year_level !== "4th Year"
    ));

    if (invalidYearIndex !== -1) {
        return res.json({
            success: false,
            message: `Row ${invalidYearIndex + 1} has invalid year_level. Only "3rd Year" and "4th Year" are allowed.`
        });
    }

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'STU2026-%'
        ORDER BY CAST(SUBSTRING_INDEX(user_id, '-', -1) AS UNSIGNED) DESC
        LIMIT 1
    `;

    db.query(sqlLast, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({
                success: false,
                message: "Database error while generating IDs."
            });
        }

        let nextNumber = 1;
        if (result.length > 0) {
            const lastId = result[0].user_id;
            const numberPart = parseInt(lastId.split("-")[1]);
            nextNumber = numberPart + 1;
        }

        const insertSql = `
            INSERT INTO users
            (
                user_id,
                fullname,
                password,
                role,
                program,
                year_level,
                student_position,
                enrolled_by_user_id
            )
            VALUES (?, ?, ?, 'student', ?, ?, ?, ?)
        `;

        const results = [];

        const insertNext = (idx) => {
            if (idx >= normalizedRows.length) {
                return res.json({
                    success: true,
                    results
                });
            }

            const row = normalizedRows[idx];
            const studentId = `STU2026-${String(nextNumber).padStart(4, "0")}`;
            nextNumber += 1;
            const tempPassword = Math.random().toString(36).slice(-8);

            db.query(
                insertSql,
                [
                    studentId,
                    row.fullname,
                    tempPassword,
                    row.program,
                    row.year_level,
                    row.student_position,
                    enrolledByUserId || null
                ],
                (err) => {
                    if (err) {
                        console.log(err);
                        results.push({
                            rowIndex: idx + 1,
                            fullname: row.fullname,
                            success: false,
                            error: "Insert failed"
                        });
                    } else {
                        results.push({
                            rowIndex: idx + 1,
                            fullname: row.fullname,
                            studentId,
                            tempPassword,
                            success: true
                        });
                    }

                    insertNext(idx + 1);
                }
            );
        };

        insertNext(0);
    });
});

/* ================= ADD REPOSITORY ================= */

app.post("/add-repository", (req, res) => {
    const {
        program,
        title,
        abstract,
        objectives,
        researchers,
        adviser,
        category,
        year
    } = req.body;

    const sql = `
        INSERT INTO repository
        (
            program,
            title,
            abstract,
            objectives,
            researchers,
            adviser,
            category,
            year
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            program,
            title,
            abstract,
            objectives,
            researchers,
            adviser,
            category,
            year
        ],
        (err) => {
            if (err) {
                console.log(err);
                return res.json({ success: false });
            }

            res.json({ success: true });
        }
    );
});

/* ================= LOAD REPOSITORY ================= */

app.get("/repository", (req, res) => {
    const sql = `
        SELECT *
        FROM repository
        ORDER BY id DESC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({
            success: true,
            repository: result
        });
    });
});

/* ================= DELETE REPOSITORY ================= */

app.delete("/delete-repository/:id", (req, res) => {
    const sql = `
        DELETE FROM repository
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({ success: true });
    });
});

/* ================= GET REPOSITORY TITLES ================= */

app.get("/repository-titles", (req, res) => {
    const sql = `
        SELECT *
        FROM repository
        ORDER BY id DESC
    `;

    db.query(sql, (error, result) => {
        if (error) {
            console.log(error);
            return res.json({ success: false });
        }

        res.json({
            success: true,
            titles: result
        });
    });
});

/* ================= GET SINGLE REPOSITORY TITLE BY ID ================= */

app.get("/repository-title/:id", (req, res) => {
    const titleId = req.params.id;

    const sql = `
        SELECT *
        FROM repository
        WHERE id = ?
    `;

    db.query(sql, [titleId], (error, result) => {
        if (error) {
            console.log(error);
            return res.json({ success: false });
        }

        if (result.length === 0) {
            return res.json({
                success: false,
                message: "Title not found"
            });
        }

        res.json({
            success: true,
            title: result[0]
        });
    });
});

/* ================= STUDENT INFO ================= */

app.get("/student-info/:userId", (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.program,
            u.year_level,
            u.student_position,
            u.enrolled_by_user_id,
            inst.fullname AS instructor_name
        FROM users u
        LEFT JOIN users inst ON u.enrolled_by_user_id = inst.user_id
        WHERE u.user_id = ?
        AND u.role = 'student'
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        if (result.length === 0) {
            return res.json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,
            student: result[0]
        });
    });
});

/* ================= CREATE GROUP ================= */

app.post("/create-group", (req, res) => {
    const {
    groupName,
    projectTitle,
    groupProgram,
    projectManagerUserId,
    members
} = req.body;
    if(members.length > 3){

    return res.json({
        success:false,
        message:"Only 4 members are allowed per group, including the Project Manager."
    });

}

    const checkManagerSql = `
        SELECT id, user_id, fullname, student_position, program
        FROM users
        WHERE user_id = ?
        AND role = 'student'
    `;

    db.query(checkManagerSql, [projectManagerUserId], (err, managerResult) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        if (managerResult.length === 0) {
            return res.json({
                success: false,
                message: "Project Manager account not found."
            });
        }

        const manager = managerResult[0];

        if (manager.student_position !== "Project Manager") {
            return res.json({
                success: false,
                message: "You do not have permission to create a group. Only the Project Manager can do this."
            });
        }

        const checkExistingGroupSql = `
            SELECT cg.group_id
            FROM group_members gm
            JOIN capstone_groups cg ON gm.group_id = cg.id
            WHERE gm.student_id = ?
            LIMIT 1
        `;

        db.query(checkExistingGroupSql, [manager.id], (err, existingGroup) => {
            if (err) {
                console.log(err);
                return res.json({ success: false });
            }

            if (existingGroup.length > 0) {
                return res.json({
                    success: false,
                    message: `You already belong to a group: ${existingGroup[0].group_id}`
                });
            }

            const sqlLast = `
                SELECT group_id
                FROM capstone_groups
                WHERE group_id LIKE 'GRP2026-%'
                ORDER BY CAST(SUBSTRING_INDEX(group_id, '-', -1) AS UNSIGNED) DESC
                LIMIT 1
            `;

            db.query(sqlLast, (err, lastResult) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                let nextNumber = 1;

                if (lastResult.length > 0) {
                    const lastGroupId = lastResult[0].group_id;
                    const numberPart = parseInt(lastGroupId.split("-")[1]);
                    nextNumber = numberPart + 1;
                }

                const groupCode = `GRP2026-${String(nextNumber).padStart(4, "0")}`;

                const insertGroupSql = `
                    INSERT INTO capstone_groups
                    (
                        group_id,
                        group_name,
                        project_title,
                        program,
                        project_manager_id
                    )
                    VALUES (?, ?, ?, ?, ?)
                `;

                db.query(
                    insertGroupSql,
                    [
                        groupCode,
                        groupName,
                        projectTitle,
                        manager.program,
                        manager.id
                    ],
                    (err, groupResult) => {
                        if (err) {
                            console.log(err);
                            return res.json({ success: false });
                        }

                        const newGroupDbId = groupResult.insertId;

                        const allMembers = [
                            {
                                studentUserId: projectManagerUserId,
                                memberPosition: "Project Manager"
                            },
                            ...members
                        ];

                        const studentUserIds = allMembers.map(member => member.studentUserId);

                        const findStudentsSql = `
                            SELECT id, user_id, program
                            FROM users
                            WHERE user_id IN (?)
                            AND role = 'student'
                        `;

                        db.query(findStudentsSql, [studentUserIds], (err, studentResult) => {
                            if (err) {
                                console.log(err);
                                return res.json({ success: false });
                            }

                            // Validate program alignment
                            const invalidProgramMember = studentResult.find(
                                student => student.program !== manager.program
                            );

                            if (invalidProgramMember) {
                                return res.json({
                                    success: false,
                                    message: `All members must belong to the same program (${manager.program}). Student ${invalidProgramMember.user_id} belongs to ${invalidProgramMember.program || "None"}.`
                                });
                            }

                            const values = [];

                            allMembers.forEach(member => {
                                const foundStudent = studentResult.find(
                                    student => student.user_id === member.studentUserId
                                );

                                if (foundStudent) {
                                    values.push([
                                        newGroupDbId,
                                        foundStudent.id,
                                        member.memberPosition
                                    ]);
                                }
                            });

                            if (values.length === 0) {
                                return res.json({
                                    success: false,
                                    message: "No valid members found."
                                });
                            }

                            const insertMembersSql = `
                                INSERT INTO group_members
                                (
                                    group_id,
                                    student_id,
                                    member_position
                                )
                                VALUES ?
                            `;

                            db.query(insertMembersSql, [values], (err) => {
                                if (err) {
                                    console.log(err);
                                    return res.json({ success: false });
                                }

                                res.json({
                                    success: true,
                                    groupId: groupCode,
                                    message: "Group created successfully."
                                });
                            });
                        });
                    }
                );
            });
        });
    });
});

/* ================= LOAD STUDENT GROUP ================= */


app.get("/student-group/:userId", (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT
            cg.id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            cg.progress,
            cg.stage,
            cg.status,

            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name,
            adviser.position AS adviser_position,
            adviser.profile_image AS adviser_profile_image,

            adset.program_cater AS adviser_program,
            adset.year_level_cater AS adviser_year_level,
            adset.group_capacity AS adviser_capacity,
            adset.adviser_status AS adviser_status,

            u.fullname,
            u.user_id,
            gm.member_position,
            u.enrolled_by_user_id,
            u.profile_image,
            inst.fullname AS instructor_name
        FROM group_members gm
        JOIN capstone_groups cg 
            ON gm.group_id = cg.id
        JOIN users u 
            ON gm.student_id = u.id

        LEFT JOIN users adviser
            ON cg.adviser_id = adviser.id

        LEFT JOIN adviser_settings adset
            ON adviser.id = adset.faculty_id

        LEFT JOIN users inst
            ON u.enrolled_by_user_id = inst.user_id

        WHERE gm.group_id = (
            SELECT gm2.group_id
            FROM group_members gm2
            JOIN users u2 ON gm2.student_id = u2.id
            WHERE u2.user_id = ?
            LIMIT 1
        )
        ORDER BY gm.id ASC
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log(err);

            return res.json({
                success: false,
                message: "Database error while loading student group."
            });
        }

        if (result.length === 0) {
            return res.json({
                success: false,
                message: "No group found."
            });
        }

        const first = result[0];

        res.json({
            success: true,
            group: {
                id: first.id,
                group_id: first.group_id,
                group_name: first.group_name,
                project_title: first.project_title,
                program: first.program,
                progress: first.progress,
                stage: first.stage,
                status: first.status,

                adviser_user_id: first.adviser_user_id,
                adviser_name: first.adviser_name,
                adviser_position: first.adviser_position,
                adviser_profile_image: first.adviser_profile_image,
                adviser_program: first.adviser_program,
                adviser_year_level: first.adviser_year_level,
                adviser_capacity: first.adviser_capacity,
                adviser_status: first.adviser_status,

                members: result.map(member => ({
                    fullname: member.fullname,
                    user_id: member.user_id,
                    member_position: member.member_position,
                    enrolled_by_user_id: member.enrolled_by_user_id,
                    profile_image: member.profile_image,
                    instructor_name: member.instructor_name
                }))
            }
        });
    });
});

/* ================= GROUP DEFENSE HISTORY ================= */

app.get("/group-defense-history/:groupDbId", (req, res) => {
    const groupDbId = req.params.groupDbId;
    if(!groupDbId){
        return res.json({
            success:false,
            message:"Missing group ID."
        });
    }
    const sql = `
        SELECT
            ds.id,
            ds.schedule_code,
            ds.room_name,
            ds.defense_date,
            ds.start_time,
            ds.end_time,
            ds.defense_type,
            ds.defense_status,
            ds.panel_result,
            ds.notes,
            ds.score,
            ds.created_at,
            ds.updated_at
        FROM defense_schedules ds
        WHERE ds.group_id = ?
        ORDER BY ds.id ASC
    `;
    db.query(sql, [groupDbId], (err, result) => {
        if(err){
            console.log(err);
            return res.json({ success: false, message: "Database error." });
        }
        res.json({
            success: true,
            defenses: result
        });
    });
});

/* ================= STUDENT DEFENSE HISTORY ================= */

app.get("/student-defense-history/:userId", (req, res) => {

    const userId =
        req.params.userId;

    if(!userId){

        return res.json({
            success:false,
            message:"Missing student account."
        });

    }

    const sql = `
        SELECT
            ds.id,
            ds.schedule_code,
            ds.room_name,
            ds.defense_date,
            ds.start_time,
            ds.end_time,
            ds.defense_type,
            ds.defense_status,
            ds.panel_result,
            ds.notes,
            ds.score,
            ds.created_at,
            ds.updated_at
        FROM defense_schedules ds

        JOIN capstone_groups cg
            ON ds.group_id = cg.id

        JOIN group_members gm
            ON cg.id = gm.group_id

        JOIN users u
            ON gm.student_id = u.id

        WHERE u.user_id = ?

        ORDER BY ds.defense_date ASC, ds.start_time ASC
    `;

    db.query(sql, [userId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load defense history."
            });
        }

        res.json({
            success:true,
            defenses:result || []
        });

    });

});

/* ================= STUDENT INFO ================= */

app.get("/student-info/:userId", (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.program,
            u.year_level,
            u.student_position,
            u.profile_image,
            u.enrolled_by_user_id,
            inst.fullname AS instructor_name
        FROM users u
        LEFT JOIN users inst ON u.enrolled_by_user_id = inst.user_id
        WHERE u.user_id = ?
        AND u.role = 'student'
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.json({
                success: false,
                message: "Database error."
            });
        }

        if (result.length === 0) {
            return res.json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,
            student: result[0]
        });
    });
});

/* ================= REMOVE GROUP MEMBER ================= */

app.delete("/remove-group-member", (req, res) => {
    const {
        groupId,
        studentUserId,
        projectManagerUserId
    } = req.body;

    const checkManagerSql = `
        SELECT 
            cg.id AS group_db_id,
            cg.project_manager_id,
            u.id AS manager_db_id
        FROM capstone_groups cg
        JOIN users u ON cg.project_manager_id = u.id
        WHERE cg.group_id = ?
        AND u.user_id = ?
    `;

    db.query(
        checkManagerSql,
        [groupId, projectManagerUserId],
        (err, managerResult) => {
            if (err) {
                console.log(err);
                return res.json({
                    success: false,
                    message: "Database error."
                });
            }

            if (managerResult.length === 0) {
                return res.json({
                    success: false,
                    message: "Only the Project Manager can remove members."
                });
            }

            const groupDbId = managerResult[0].group_db_id;
            const managerDbId = managerResult[0].manager_db_id;

            const getStudentSql = `
                SELECT id
                FROM users
                WHERE user_id = ?
                AND role = 'student'
            `;

            db.query(getStudentSql, [studentUserId], (err, studentResult) => {
                if (err) {
                    console.log(err);
                    return res.json({
                        success: false,
                        message: "Database error."
                    });
                }

                if (studentResult.length === 0) {
                    return res.json({
                        success: false,
                        message: "Student not found."
                    });
                }

                const studentDbId = studentResult[0].id;

                if (studentDbId === managerDbId) {
                    return res.json({
                        success: false,
                        message: "Project Manager cannot be removed from the group."
                    });
                }

                const deleteSql = `
                    DELETE FROM group_members
                    WHERE group_id = ?
                    AND student_id = ?
                `;

                db.query(deleteSql, [groupDbId, studentDbId], (err) => {
                    if (err) {
                        console.log(err);
                        return res.json({
                            success: false,
                            message: "Failed to remove member."
                        });
                    }

                    res.json({
                        success: true,
                        message: "Member removed successfully."
                    });
                });
            });
        }
    );
});

/* ================= UPDATE STUDENT POSITION ================= */

app.put("/update-student-position", (req, res) => {
    const { studentUserId, position } = req.body;

    if (!studentUserId || !position) {
        return res.json({ success: false, message: "Missing required fields." });
    }

    const sql = `
        UPDATE users
        SET student_position = ?
        WHERE user_id = ?
        AND role = 'student'
    `;

    db.query(sql, [position, studentUserId], (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false, message: "Database error." });
        }

        res.json({ success: true, message: "Student position updated." });
    });
});

/* ================= UPDATE GROUP ================= */

app.put("/update-group", (req, res) => {
    const {
        groupId,
        groupName,
        projectTitle,
        groupProgram,
        projectManagerUserId,
        members
    } = req.body;

    if(members.length > 3){
        return res.json({
            success:false,
            message:"Only 4 members are allowed per group, including the Project Manager."
        });
    }

    const checkManagerSql = `
        SELECT
            cg.id AS group_db_id,
            cg.project_manager_id,
            u.id AS manager_db_id,
            u.program AS manager_program
        FROM capstone_groups cg
        JOIN users u ON cg.project_manager_id = u.id
        WHERE cg.group_id = ?
        AND u.user_id = ?
    `;

    db.query(
        checkManagerSql,
        [groupId, projectManagerUserId],
        (err, managerResult) => {
            if(err){
                console.log(err);
                return res.json({
                    success:false,
                    message:"Database error."
                });
            }

            if(managerResult.length === 0){
                return res.json({
                    success:false,
                    message:"Only the Project Manager can update this group."
                });
            }

            const groupDbId = managerResult[0].group_db_id;
            const managerProgram = managerResult[0].manager_program;

            const updateGroupSql = `
                UPDATE capstone_groups
                SET
                    group_name = ?,
                    project_title = ?,
                    program = ?
                WHERE id = ?
            `;

            db.query(
                updateGroupSql,
                [groupName, projectTitle, managerProgram, groupDbId],
                (err) => {
                    if(err){
                        console.log(err);
                        return res.json({
                            success:false,
                            message:"Failed to update group details."
                        });
                    }

                    if(members.length === 0){
                        return res.json({
                            success:true,
                            message:"Group updated successfully."
                        });
                    }

                    const studentUserIds = members.map(member => member.studentUserId);

                    const findStudentsSql = `
                        SELECT id, user_id, program
                        FROM users
                        WHERE user_id IN (?)
                        AND role = 'student'
                    `;

                    db.query(findStudentsSql, [studentUserIds], (err, studentResult) => {
                        if(err){
                            console.log(err);
                            return res.json({
                                success:false,
                                message:"Database error."
                            });
                        }

                        if(studentResult.length !== studentUserIds.length){
                            return res.json({
                                success:false,
                                message:"One or more student IDs are invalid."
                            });
                        }

                        // Validate program alignment
                        const invalidProgramMember = studentResult.find(
                            student => student.program !== managerProgram
                        );

                        if(invalidProgramMember){
                            return res.json({
                                success:false,
                                message:`All members must belong to the same program (${managerProgram}). Student ${invalidProgramMember.user_id} belongs to ${invalidProgramMember.program || "None"}.`
                            });
                        }

                        const studentDbIds = studentResult.map(student => student.id);

                        const checkMembersGroupSql = `
                            SELECT
                                gm.student_id,
                                u.user_id,
                                cg.group_id
                            FROM group_members gm
                            JOIN users u ON gm.student_id = u.id
                            JOIN capstone_groups cg ON gm.group_id = cg.id
                            WHERE gm.student_id IN (?)
                            AND gm.group_id != ?
                        `;

                        db.query(
                            checkMembersGroupSql,
                            [studentDbIds, groupDbId],
                            (err, existingMembers) => {
                                if(err){
                                    console.log(err);
                                    return res.json({
                                        success:false,
                                        message:"Database error."
                                    });
                                }

                                if(existingMembers.length > 0){
                                    const existingList = existingMembers
                                        .map(item => `${item.user_id} already belongs to ${item.group_id}`)
                                        .join(", ");

                                    return res.json({
                                        success:false,
                                        message:existingList
                                    });
                                }

                                const values = [];

                                members.forEach(member => {
                                    const foundStudent = studentResult.find(
                                        student => student.user_id === member.studentUserId
                                    );

                                    if(foundStudent){
                                        values.push([
                                            groupDbId,
                                            foundStudent.id,
                                            member.memberPosition
                                        ]);
                                    }
                                });

                                if(values.length === 0){
                                    return res.json({
                                        success:true,
                                        message:"Group updated successfully."
                                    });
                                }

                                const insertMembersSql = `
                                    INSERT INTO group_members
                                    (
                                        group_id,
                                        student_id,
                                        member_position
                                    )
                                    VALUES ?
                                `;

                                db.query(insertMembersSql, [values], (err) => {
                                    if(err){
                                        console.log(err);
                                        return res.json({
                                            success:false,
                                            message:"Failed to add new members."
                                        });
                                    }

                                    res.json({
                                        success:true,
                                        message:"Group updated successfully."
                                    });
                                });
                            }
                        );
                    });
                }
            );
        }
    );
});

/* ================= ADVISER MANAGEMENT ================= */

app.get("/adviser-management", (req, res) => {

    const advisersSql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.position,
            u.role,
            u.adviser_access,

            COALESCE(a.group_capacity, 0) AS group_capacity,
            COALESCE(a.program_cater, 'Not Set') AS program_cater,
            COALESCE(a.year_level_cater, 'Not Set') AS year_level_cater,
            COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,
            COALESCE(a.remarks, '') AS remarks

        FROM users u

        LEFT JOIN adviser_settings a
            ON u.id = a.faculty_id

        WHERE u.role IN ('faculty', 'admin')
        AND u.adviser_access = 1

        ORDER BY u.fullname ASC
    `;

    const totalGroupsSql = `
        SELECT COUNT(*) AS total_groups
        FROM capstone_groups
    `;

    db.query(advisersSql, (err, advisersResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load advisers."
            });
        }

        db.query(totalGroupsSql, (err, groupsResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to count groups."
                });
            }

            const totalAdvisers =
                advisersResult.length;

            const totalGroups =
                groupsResult[0].total_groups;

            const availableAdvisers =
                advisersResult.filter(adviser =>
                    adviser.adviser_status === "Available"
                    &&
                    Number(adviser.group_capacity) > 0
                ).length;

            res.json({
                success:true,
                advisers:advisersResult,
                stats:{
                    totalAdvisers,
                    totalGroups,
                    availableAdvisers
                }
            });

        });

    });

});

/* ================= SAVE ADVISER SETTINGS ================= */

app.post("/save-adviser-settings", (req, res) => {

    const {
        adviserId,
        facultyId,
        groupCapacity,
        programCater,
        yearLevelCater,
        adviserStatus,
        remarks
    } = req.body;

    const selectedAdviser =
        adviserId || facultyId;

    if(
        !selectedAdviser ||
        !groupCapacity ||
        !programCater ||
        !yearLevelCater ||
        !adviserStatus
    ){
        return res.json({
            success:false,
            message:"Please complete all adviser settings fields."
        });
    }

    const capacity =
        Number(groupCapacity);

    if(isNaN(capacity) || capacity <= 0){

        return res.json({
            success:false,
            message:"Group capacity must be greater than 0."
        });

    }

    const adviserSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            adviser_access
        FROM users
        WHERE
        (
            id = ?
            OR user_id = ?
        )
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(
        adviserSql,
        [
            selectedAdviser,
            selectedAdviser
        ],
        (err, adviserResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking adviser."
                });
            }

            if(adviserResult.length === 0){

                return res.json({
                    success:false,
                    message:"Faculty/Admin adviser not found or does not have adviser access."
                });

            }

            const adviserDbId =
                adviserResult[0].id;

            const checkSettingsSql = `
                SELECT id
                FROM adviser_settings
                WHERE faculty_id = ?
                LIMIT 1
            `;

            db.query(checkSettingsSql, [adviserDbId], (err, settingsResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Database error while checking adviser settings."
                    });
                }

                if(settingsResult.length > 0){

                    const updateSql = `
                        UPDATE adviser_settings
                        SET
                            group_capacity = ?,
                            program_cater = ?,
                            year_level_cater = ?,
                            adviser_status = ?,
                            remarks = ?
                        WHERE faculty_id = ?
                    `;

                    db.query(
                        updateSql,
                        [
                            capacity,
                            programCater,
                            yearLevelCater,
                            adviserStatus,
                            remarks || "",
                            adviserDbId
                        ],
                        (err) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to update adviser settings."
                                });
                            }

                            res.json({
                                success:true,
                                message:"Adviser settings updated successfully."
                            });

                        }
                    );

                }else{

                    const insertSql = `
                        INSERT INTO adviser_settings
                        (
                            faculty_id,
                            group_capacity,
                            program_cater,
                            year_level_cater,
                            adviser_status,
                            remarks
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertSql,
                        [
                            adviserDbId,
                            capacity,
                            programCater,
                            yearLevelCater,
                            adviserStatus,
                            remarks || ""
                        ],
                        (err) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to save adviser settings."
                                });
                            }

                            res.json({
                                success:true,
                                message:"Adviser settings saved successfully."
                            });

                        }
                    );

                }

            });

        }
    );

});

/* ================= STUDENT LOAD ADVISERS ================= */

app.get("/student-advisers/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const groupSql = `
        SELECT
            cg.id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            cg.adviser_id

        FROM group_members gm

        JOIN capstone_groups cg
            ON gm.group_id = cg.id

        JOIN users u
            ON gm.student_id = u.id

        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [userId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while loading group."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:false,
                message:"You must create or join a group before requesting an adviser."
            });

        }

        const group =
            groupResult[0];

        const advisersSql = `
            SELECT
                u.id,
                u.user_id,
                u.fullname,
                u.position,
                u.role,
                u.profile_image,

                COALESCE(a.group_capacity, 0) AS group_capacity,
                COALESCE(a.program_cater, 'Not Set') AS program_cater,
                COALESCE(a.year_level_cater, 'Not Set') AS year_level_cater,
                COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,
                COALESCE(a.remarks, '') AS remarks,

                (
                    SELECT COUNT(*)
                    FROM capstone_groups cg
                    WHERE cg.adviser_id = u.id
                ) AS assigned_groups,

                (
                    SELECT request_status
                    FROM adviser_requests ar
                    WHERE ar.group_id = ?
                    AND ar.adviser_id = u.id
                    ORDER BY ar.id DESC
                    LIMIT 1
                ) AS request_status

            FROM users u

            LEFT JOIN adviser_settings a
                ON u.id = a.faculty_id

            WHERE u.role IN ('faculty', 'admin')
            AND u.adviser_access = 1

            ORDER BY u.fullname ASC
        `;

        db.query(advisersSql, [group.id], (err, advisersResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while loading advisers."
                });
            }

            res.json({
                success:true,
                group,
                advisers:advisersResult
            });

        });

    });

});

/* ================= SEND ADVISER REQUEST ================= */

app.post("/request-adviser", (req, res) => {

    const {
        studentUserId,
        adviserUserId,
        message
    } = req.body;

    if(
        !studentUserId ||
        !adviserUserId
    ){
        return res.json({
            success:false,
            message:"Missing adviser request information."
        });
    }

    const groupSql = `
        SELECT
            cg.id,
            cg.group_id,
            cg.group_name,
            cg.program,
            cg.adviser_id

        FROM group_members gm

        JOIN capstone_groups cg
            ON gm.group_id = cg.id

        JOIN users u
            ON gm.student_id = u.id

        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [studentUserId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking student group."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:false,
                message:"You must belong to a group before requesting an adviser."
            });

        }

        const group =
            groupResult[0];

        if(group.adviser_id){

            return res.json({
                success:false,
                message:"Your group already has an assigned adviser."
            });

        }

        if(!group.program){

            return res.json({
                success:false,
                message:"Please set your group program first in Members > Edit Group."
            });

        }

        const adviserSql = `
            SELECT
                u.id,
                u.user_id,
                u.fullname,
                u.role,

                COALESCE(a.group_capacity, 0) AS group_capacity,
                COALESCE(a.program_cater, 'Not Set') AS program_cater,
                COALESCE(a.year_level_cater, 'Not Set') AS year_level_cater,
                COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,

                (
                    SELECT COUNT(*)
                    FROM capstone_groups cg
                    WHERE cg.adviser_id = u.id
                ) AS assigned_groups

            FROM users u

            LEFT JOIN adviser_settings a
                ON u.id = a.faculty_id

            WHERE
            (
                u.user_id = ?
                OR u.id = ?
            )
            AND u.role IN ('faculty', 'admin')
            AND u.adviser_access = 1

            LIMIT 1
        `;

        db.query(
            adviserSql,
            [
                adviserUserId,
                adviserUserId
            ],
            (err, adviserResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Database error while checking adviser."
                    });
                }

                if(adviserResult.length === 0){

                    return res.json({
                        success:false,
                        message:"Selected adviser was not found or does not have adviser access."
                    });

                }

                const adviser =
                    adviserResult[0];

                const groupProgramFull =
                    group.program === "IS"
                    ? "BSIS"
                    : group.program === "IT"
                    ? "BSIT"
                    : group.program;

                const adviserProgram =
                    adviser.program_cater;

                if(
                    adviserProgram === "Not Set" ||
                    adviserProgram === null ||
                    adviserProgram === ""
                ){
                    return res.json({
                        success:false,
                        message:"Cannot request this adviser because their program setting is not configured yet."
                    });
                }

                if(
                    adviserProgram !== "Both"
                    &&
                    adviserProgram !== groupProgramFull
                ){
                    return res.json({
                        success:false,
                        message:`Cannot request this adviser. Your group is ${groupProgramFull}, but this adviser only caters ${adviserProgram}.`
                    });
                }

                if(adviser.adviser_status !== "Available"){

                    return res.json({
                        success:false,
                        message:`Cannot request this adviser because their status is ${adviser.adviser_status}.`
                    });

                }

                if(Number(adviser.group_capacity) <= 0){

                    return res.json({
                        success:false,
                        message:"Cannot request this adviser because their group capacity is not configured."
                    });

                }

                if(
                    Number(adviser.assigned_groups)
                    >=
                    Number(adviser.group_capacity)
                ){
                    return res.json({
                        success:false,
                        message:"Cannot request this adviser because their capacity is already full."
                    });
                }

                const checkProposalsSql = `
                    SELECT COUNT(*) AS proposal_count
                    FROM title_proposals
                    WHERE group_id = ?
                    AND TRIM(COALESCE(proposed_title, '')) != ''
                    AND TRIM(COALESCE(file_path, '')) != ''
                `;

                db.query(checkProposalsSql, [group.id], (err, proposalResult) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Database error while checking title proposals."
                        });
                    }

                    if(Number(proposalResult[0].proposal_count) < 3){

                        return res.json({
                            success:false,
                            message:"Please save all 3 title proposals (title + PDF) on this page before requesting an adviser."
                        });

                    }

                    const checkPendingSql = `
                        SELECT id
                        FROM adviser_requests
                        WHERE group_id = ?
                        AND request_status = 'Pending'
                        LIMIT 1
                    `;

                    db.query(checkPendingSql, [group.id], (err, pendingResult) => {

                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Database error while checking pending requests."
                            });
                        }

                        if(pendingResult.length > 0){

                            return res.json({
                                success:false,
                                message:"Your group already has a pending adviser request."
                            });

                        }

                        const insertSql = `
                            INSERT INTO adviser_requests
                            (
                                group_id,
                                adviser_id,
                                request_status,
                                request_message
                            )
                            VALUES (?, ?, 'Pending', ?)
                        `;

                        db.query(
                            insertSql,
                            [
                                group.id,
                                adviser.id,
                                message || ""
                            ],
                            (err) => {

                                if(err){
                                    console.log(err);

                                    return res.json({
                                        success:false,
                                        message:"Failed to send adviser request."
                                    });
                                }

                                // Notify the requested adviser
                                insertUserNotificationsByDbIds(
                                    [adviser.id],
                                    "New Adviser Request",
                                    `Capstone group "${group.group_name || group.group_id}" has requested you as their adviser.`,
                                    "Adviser Request"
                                );

                                // Notify all student group members
                                notifyGroupMembersAboutAdviserRequest(
                                    group.id,
                                    "Adviser Request Sent",
                                    `Your group has sent an adviser request to ${adviser.fullname}.`
                                );

                                return res.json({
                                    success:true,
                                    message:"Adviser request sent successfully."
                                });

                            }
                        );

                    });

                });

            }
        );

    });

});

/* ================= ADMIN LOAD CAPSTONE GROUPS ================= */

app.get("/admin-capstone-groups", (req, res) => {

    const groupsSql = `
        SELECT
            cg.id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            cg.progress,
            cg.stage,
            cg.status,

            pm.user_id AS project_manager_user_id,
            pm.fullname AS project_manager_name,

            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name,

            COALESCE(adset.group_capacity, 0) AS adviser_capacity,
            COALESCE(adset.program_cater, 'Not Set') AS adviser_program,
            COALESCE(adset.year_level_cater, 'Not Set') AS adviser_year_level,
            COALESCE(adset.adviser_status, 'Not Configured') AS adviser_status

        FROM capstone_groups cg

        LEFT JOIN users pm
            ON cg.project_manager_id = pm.id

        LEFT JOIN users adviser
            ON cg.adviser_id = adviser.id

        LEFT JOIN adviser_settings adset
            ON adviser.id = adset.faculty_id

        ORDER BY cg.id DESC
    `;

    const membersSql = `
        SELECT
            gm.group_id,
            gm.member_position,
            u.user_id,
            u.fullname,
            u.program,
            u.year_level
        FROM group_members gm
        JOIN users u
            ON gm.student_id = u.id
        ORDER BY gm.id ASC
    `;

    const advisersSql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.position,

            COALESCE(a.group_capacity, 0) AS group_capacity,
            COALESCE(a.program_cater, 'Not Set') AS program_cater,
            COALESCE(a.year_level_cater, 'Not Set') AS year_level_cater,
            COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,

            (
                SELECT COUNT(*)
                FROM capstone_groups cg
                WHERE cg.adviser_id = u.id
            ) AS assigned_groups

        FROM users u
        LEFT JOIN adviser_settings a
            ON u.id = a.faculty_id

        WHERE u.role IN ('faculty', 'admin')
AND u.adviser_access = 1
ORDER BY u.fullname ASC
    `;

    db.query(groupsSql, (err, groupsResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load capstone groups."
            });
        }

        db.query(membersSql, (err, membersResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load group members."
                });
            }

            db.query(advisersSql, (err, advisersResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load advisers."
                    });
                }

                const groups = groupsResult.map(group => {

                    return {
                        ...group,
                        members: membersResult.filter(member =>
                            member.group_id === group.id
                        )
                    };

                });

                res.json({
                    success:true,
                    groups,
                    advisers: advisersResult
                });

            });

        });

    });

});


/* ================= ADMIN UPDATE CAPSTONE GROUP ================= */

app.put("/admin-update-capstone-group", (req, res) => {

    const {
        groupId,
        groupName,
        projectTitle,
        program,
        progress,
        stage,
        status,
        adviserUserId
    } = req.body;

    if(!groupId || !groupName || !projectTitle || !program){

        return res.json({
            success:false,
            message:"Please complete group name, project title, and program."
        });

    }

    const getGroupSql = `
        SELECT
            id,
            adviser_id
        FROM capstone_groups
        WHERE group_id = ?
    `;

    db.query(getGroupSql, [groupId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:false,
                message:"Group not found."
            });

        }

        const groupDbId = groupResult[0].id;
        const currentAdviserId = groupResult[0].adviser_id;

        if(!adviserUserId){

            const updateWithoutAdviserSql = `
                UPDATE capstone_groups
                SET
                    group_name = ?,
                    project_title = ?,
                    program = ?,
                    progress = ?,
                    stage = ?,
                    status = ?,
                    adviser_id = NULL
                WHERE id = ?
            `;

            db.query(
                updateWithoutAdviserSql,
                [
                    groupName,
                    projectTitle,
                    program,
                    progress || 0,
                    stage || "Stage 1",
                    status || "Active",
                    groupDbId
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update group."
                        });
                    }

                    return res.json({
                        success:true,
                        message:"Group updated successfully."
                    });

                }
            );

            return;

        }

        const adviserSql = `
            SELECT
                u.id,
                u.user_id,
                u.fullname,

                COALESCE(a.group_capacity, 0) AS group_capacity,
                COALESCE(a.program_cater, 'Not Set') AS program_cater,
                COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,

                (
                    SELECT COUNT(*)
                    FROM capstone_groups cg
                    WHERE cg.adviser_id = u.id
                ) AS assigned_groups

            FROM users u
            LEFT JOIN adviser_settings a
                ON u.id = a.faculty_id

            WHERE u.user_id = ?
            AND u.role = 'faculty'
            AND u.adviser_access = 1
        `;

        db.query(adviserSql, [adviserUserId], (err, adviserResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking adviser."
                });
            }

            if(adviserResult.length === 0){

                return res.json({
                    success:false,
                    message:"Selected adviser was not found."
                });

            }

            const adviser = adviserResult[0];

            const groupProgramFull =
                program === "IS"
                ? "BSIS"
                : program === "IT"
                ? "BSIT"
                : program;

            if(
                adviser.program_cater !== "Both"
                &&
                adviser.program_cater !== "Not Set"
                &&
                adviser.program_cater !== groupProgramFull
            ){

                return res.json({
                    success:false,
                    message:`Cannot assign adviser. This group is ${groupProgramFull}, but the adviser caters ${adviser.program_cater}.`
                });

            }

            if(
                adviser.group_capacity > 0
                &&
                adviser.assigned_groups >= adviser.group_capacity
                &&
                currentAdviserId !== adviser.id
            ){

                return res.json({
                    success:false,
                    message:"Cannot assign adviser because their capacity is already full."
                });

            }

            const updateSql = `
                UPDATE capstone_groups
                SET
                    group_name = ?,
                    project_title = ?,
                    program = ?,
                    progress = ?,
                    stage = ?,
                    status = ?,
                    adviser_id = ?
                WHERE id = ?
            `;

            db.query(
                updateSql,
                [
                    groupName,
                    projectTitle,
                    program,
                    progress || 0,
                    stage || "Stage 1",
                    status || "Active",
                    adviser.id,
                    groupDbId
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update group."
                        });
                    }

                    res.json({
                        success:true,
                        message:"Group updated successfully."
                    });

                }
            );

        });

    });

});


/* ================= ADMIN DELETE CAPSTONE GROUP ================= */

app.delete("/admin-delete-capstone-group/:groupId", (req, res) => {

    const groupId = req.params.groupId;

    const findGroupSql = `
        SELECT id
        FROM capstone_groups
        WHERE group_id = ?
    `;

    db.query(findGroupSql, [groupId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:false,
                message:"Group not found."
            });

        }

        const groupDbId = groupResult[0].id;

        const deleteRequestsSql = `
            DELETE FROM adviser_requests
            WHERE group_id = ?
        `;

        db.query(deleteRequestsSql, [groupDbId], (err) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to delete adviser requests."
                });
            }

            const deleteMembersSql = `
                DELETE FROM group_members
                WHERE group_id = ?
            `;

            db.query(deleteMembersSql, [groupDbId], (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to delete group members."
                    });
                }

                const deleteGroupSql = `
                    DELETE FROM capstone_groups
                    WHERE id = ?
                `;

                db.query(deleteGroupSql, [groupDbId], (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to delete group."
                        });
                    }

                    res.json({
                        success:true,
                        message:"Group deleted successfully."
                    });

                });

            });

        });

    });

});

/* ================= INSTRUCTOR LOAD CAPSTONE GROUPS ================= */

app.get("/instructor-capstone-groups", (req, res) => {

    const groupsSql = `
        SELECT
            cg.id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            cg.progress,
            cg.stage,
            cg.status,

            pm.user_id AS project_manager_user_id,
            pm.fullname AS project_manager_name,

            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name,

            COALESCE(adset.group_capacity, 0) AS adviser_capacity,
            COALESCE(adset.program_cater, 'Not Set') AS adviser_program,
            COALESCE(adset.year_level_cater, 'Not Set') AS adviser_year_level,
            COALESCE(adset.adviser_status, 'Not Configured') AS adviser_status

        FROM capstone_groups cg

        LEFT JOIN users pm
            ON cg.project_manager_id = pm.id

        LEFT JOIN users adviser
            ON cg.adviser_id = adviser.id

        LEFT JOIN adviser_settings adset
            ON adviser.id = adset.faculty_id

        ORDER BY cg.id DESC
    `;

    const membersSql = `
        SELECT
            gm.group_id,
            gm.member_position,
            u.user_id,
            u.fullname,
            u.program,
            u.year_level,
            u.profile_image,
            u.enrolled_by_user_id
        FROM group_members gm
        JOIN users u
            ON gm.student_id = u.id
        ORDER BY gm.id ASC
    `;

    const advisersSql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.position,

            COALESCE(a.group_capacity, 0) AS group_capacity,
            COALESCE(a.program_cater, 'Not Set') AS program_cater,
            COALESCE(a.year_level_cater, 'Not Set') AS year_level_cater,
            COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,

            (
                SELECT COUNT(*)
                FROM capstone_groups cg
                WHERE cg.adviser_id = u.id
            ) AS assigned_groups

        FROM users u
        LEFT JOIN adviser_settings a
            ON u.id = a.faculty_id

        WHERE u.role IN ('faculty', 'admin')
AND u.adviser_access = 1
ORDER BY u.fullname ASC
    `;

    db.query(groupsSql, (err, groupsResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load capstone groups."
            });
        }

        db.query(membersSql, (err, membersResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load group members."
                });
            }

            db.query(advisersSql, (err, advisersResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load advisers."
                    });
                }

                const groups = groupsResult.map(group => {
                    return {
                        ...group,
                        members: membersResult.filter(member =>
                            member.group_id === group.id
                        )
                    };
                });

                res.json({
                    success:true,
                    groups,
                    advisers:advisersResult
                });

            });

        });

    });

});


/* ================= INSTRUCTOR UPDATE CAPSTONE GROUP ================= */

app.put("/instructor-update-capstone-group", (req, res) => {

    const {
        groupId,
        progress,
        stage,
        status,
        adviserUserId
    } = req.body;

    if(!groupId){

        return res.json({
            success:false,
            message:"Group ID is required."
        });

    }

    if(progress < 0 || progress > 100){

        return res.json({
            success:false,
            message:"Progress must be between 0 and 100."
        });

    }

    const getGroupSql = `
        SELECT
            id,
            group_id,
            program,
            adviser_id
        FROM capstone_groups
        WHERE group_id = ?
    `;

    db.query(getGroupSql, [groupId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:false,
                message:"Group not found."
            });

        }

        const group = groupResult[0];

        if(!adviserUserId){

            const updateSql = `
                UPDATE capstone_groups
                SET
                    progress = ?,
                    stage = ?,
                    status = ?,
                    adviser_id = NULL
                WHERE id = ?
            `;

            db.query(
                updateSql,
                [
                    progress || 0,
                    stage || "Stage 1",
                    status || "Active",
                    group.id
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update group."
                        });
                    }

                    res.json({
                        success:true,
                        message:"Group monitoring details updated successfully."
                    });

                }
            );

            return;

        }

        const adviserSql = `
            SELECT
                u.id,
                u.user_id,
                u.fullname,

                COALESCE(a.group_capacity, 0) AS group_capacity,
                COALESCE(a.program_cater, 'Not Set') AS program_cater,
                COALESCE(a.adviser_status, 'Not Configured') AS adviser_status,

                (
                    SELECT COUNT(*)
                    FROM capstone_groups cg
                    WHERE cg.adviser_id = u.id
                ) AS assigned_groups

            FROM users u
            LEFT JOIN adviser_settings a
                ON u.id = a.faculty_id

            WHERE u.user_id = ?
            AND u.role = 'faculty'
            AND u.adviser_access = 1
        `;

        db.query(adviserSql, [adviserUserId], (err, adviserResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking adviser."
                });
            }

            if(adviserResult.length === 0){

                return res.json({
                    success:false,
                    message:"Selected adviser was not found."
                });

            }

            const adviser = adviserResult[0];

            const groupProgramFull =
                group.program === "IS"
                ? "BSIS"
                : group.program === "IT"
                ? "BSIT"
                : group.program;

            if(
                adviser.program_cater !== "Both"
                &&
                adviser.program_cater !== "Not Set"
                &&
                adviser.program_cater !== groupProgramFull
            ){

                return res.json({
                    success:false,
                    message:`Cannot assign adviser. This group is ${groupProgramFull}, but the adviser caters ${adviser.program_cater}.`
                });

            }

            if(
                adviser.group_capacity > 0
                &&
                adviser.assigned_groups >= adviser.group_capacity
                &&
                group.adviser_id !== adviser.id
            ){

                return res.json({
                    success:false,
                    message:"Cannot assign adviser because their capacity is already full."
                });

            }

            const updateSql = `
                UPDATE capstone_groups
                SET
                    progress = ?,
                    stage = ?,
                    status = ?,
                    adviser_id = ?
                WHERE id = ?
            `;

            db.query(
                updateSql,
                [
                    progress || 0,
                    stage || "Stage 1",
                    status || "Active",
                    adviser.id,
                    group.id
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update group."
                        });
                    }

                    res.json({
                        success:true,
                        message:"Group monitoring details updated successfully."
                    });

                }
            );

        });

    });

});

/* ================= SEMANTIC SIMILARITY CHECKER ENGINE ================= */

const STOP_WORDS = new Set([
    // Articles, prepositions, conjunctions
    'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'of', 'by', 'using',
    'about', 'from', 'as', 'into', 'its', 'it', 'this', 'that', 'these', 'those', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'not', 'our', 'we', 'you', 'your',
    'their', 'they', 'he', 'she', 'him', 'her', 'us', 'also', 'such', 'can', 'will', 'may', 'shall',
    'each', 'all', 'any', 'both', 'few', 'more', 'other', 'same', 'than', 'too', 'very', 'just',
    'while', 'where', 'when', 'which', 'who', 'how', 'what', 'was', 'were', 'would', 'could', 'should',
    // Generic academic / tech verbs that appear in every capstone document
    'develop', 'developed', 'developing', 'development', 'create', 'created', 'creating', 'design',
    'designed', 'designing', 'implement', 'implemented', 'implementing', 'build', 'built', 'building',
    'provide', 'provided', 'providing', 'enable', 'enabled', 'enabling', 'allow', 'allows', 'allowed',
    'improve', 'improved', 'improving', 'generate', 'generated', 'generating', 'support', 'supported',
    'use', 'used', 'uses', 'ensure', 'ensures', 'ensured', 'enhance', 'enhanced', 'enhancing',
    'manage', 'managed', 'managing', 'make', 'makes', 'made', 'help', 'helps', 'helped',
    'identify', 'identified', 'analyze', 'analyzed', 'process', 'processes', 'processed',
    'collect', 'collected', 'collecting', 'access', 'accessed', 'maintain', 'maintained',
    'integrate', 'integrated', 'track', 'tracked', 'tracking', 'conduct', 'conducted',
    // Generic nouns that appear in every capstone
    'system', 'systems', 'application', 'applications', 'platform', 'platforms', 'software',
    'web', 'website', 'online', 'based', 'tool', 'tools', 'portal', 'module', 'modules',
    'data', 'information', 'record', 'records', 'report', 'reports', 'result', 'results',
    'process', 'procedure', 'method', 'approach', 'feature', 'features', 'function', 'functions',
    'user', 'users', 'admin', 'administrator', 'interface', 'database',
    'objective', 'objectives', 'general', 'specific', 'purpose', 'goal', 'goals', 'aim', 'aims',
    'study', 'research', 'project', 'capstone', 'thesis', 'paper',
    'figure', 'table', 'section', 'chapter', 'page', 'list', 'one', 'two', 'three',
    'first', 'second', 'third', 'following', 'include', 'includes', 'included',
    'through', 'within', 'between', 'different', 'various', 'multiple', 'available', 'existing',
    'new', 'current', 'local', 'overall', 'additional', 'related', 'complete', 'completed'
]);

const SYNONYMS = {
    'monitoring': ['tracking', 'surveillance', 'observation', 'checking', 'record', 'recording'],
    'tracking': ['monitoring', 'surveillance', 'observation', 'checking', 'record', 'recording', 'tracing'],
    'attendance': ['presence', 'roll call', 'tardy', 'absent', 'log'],
    'qr': ['qr code', 'quick response', 'barcode', 'scan'],
    'code': ['qr', 'barcode', 'scan'],
    'class': ['student', 'classroom', 'course', 'school', 'academic'],
    'student': ['class', 'learner', 'pupil', 'academic', 'classroom'],
    'system': ['application', 'software', 'platform', 'app', 'tool', 'portal'],
    'application': ['system', 'software', 'platform', 'app', 'tool', 'portal'],
    'app': ['system', 'software', 'platform', 'application', 'tool', 'portal'],
    'web': ['online', 'website', 'internet', 'portal', 'cloud'],
    'mobile': ['android', 'ios', 'phone', 'smartphone', 'handheld'],
    'automated': ['automatic', 'smart', 'intelligent', 'computerized'],
    'smart': ['automated', 'automatic', 'intelligent', 'cognitive'],
    'sms': ['text message', 'notification', 'alert', 'message'],
    'alert': ['notification', 'sms', 'warning', 'alarm'],
    'notification': ['alert', 'sms', 'warning', 'message']
};

function tokenizeText(text) {
    if (!text) return [];
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    return clean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function calculateMatchScore(studentText, repoText, matchType) {
    if (!studentText || !repoText) {
        return { score: 0, matchedWords: [], matchedSynonymWords: [] };
    }
    const studentTokens = tokenizeText(studentText);
    const repoTokens = tokenizeText(repoText);
    if (studentTokens.length === 0) {
        return { score: 0, matchedWords: [], matchedSynonymWords: [] };
    }

    let matches = 0;
    const matchedWords = [];      // exact / partial exact matches
    const matchedSynonymWords = []; // synonym-based matches
    const normRepo = repoText.toLowerCase();

    studentTokens.forEach(st => {
        if (repoTokens.includes(st)) {
            matches += 1.0;
            matchedWords.push(st);
        } else if (normRepo.includes(st)) {
            matches += 1.0;
            matchedWords.push(st);
        } else {
            const related = SYNONYMS[st] || [];
            for (let rel of related) {
                if (repoTokens.includes(rel) || normRepo.includes(rel)) {
                    matches += 0.8;
                    matchedSynonymWords.push(st);  // synonym hit tracked separately
                    break;
                }
            }
        }
    });

    return {
        score: Math.min(matches / studentTokens.length, 1.0),
        matchedWords: [...new Set(matchedWords)],
        matchedSynonymWords: [...new Set(matchedSynonymWords)]
    };
}

function runSimilarityCheck(proposedTitle, proposedPdfText, repositoryRecords) {
    let highestPercentage = 0;
    let bestMatch = null;
    let bestMatchDetails = null;

    repositoryRecords.forEach(repo => {
        // Compare proposed title against repository title (weight: 40%)
        const titleMatch = calculateMatchScore(proposedTitle, repo.title, 'title');

        // Compare proposed objectives (PDF text) against repository abstract (weight: 30%)
        const abstractMatch = calculateMatchScore(proposedPdfText, repo.abstract, 'abstract');

        // Compare proposed objectives (PDF text) against repository objectives (weight: 30%)
        const objectivesMatch = calculateMatchScore(proposedPdfText, repo.objectives, 'objectives');

        const percentage = Math.round(
            (titleMatch.score * 0.4 + abstractMatch.score * 0.3 + objectivesMatch.score * 0.3) * 100
        );

        if (percentage >= highestPercentage) {
            highestPercentage = percentage;
            bestMatch = repo;
            bestMatchDetails = {
                // Exact-match word lists per section
                matchedTitleWords:         titleMatch.matchedWords,
                matchedObjAbstractWords:   abstractMatch.matchedWords,
                matchedObjObjectivesWords: objectivesMatch.matchedWords,
                // Synonym-match word lists per section (shown in a different colour)
                synonymTitleWords:         titleMatch.matchedSynonymWords,
                synonymAbstractWords:      abstractMatch.matchedSynonymWords,
                synonymObjectivesWords:    objectivesMatch.matchedSynonymWords
            };
        }
    });

    let similarityLevel = "Low Similarity";
    if (highestPercentage > 25 && highestPercentage <= 50) {
        similarityLevel = "Moderate Similarity";
    } else if (highestPercentage > 50 && highestPercentage <= 75) {
        similarityLevel = "High Similarity";
    } else if (highestPercentage > 75) {
        similarityLevel = "Very High Similarity";
    }

    return {
        percentage: highestPercentage,
        level: similarityLevel,
        matchedRecord: bestMatch,
        matchingSections: bestMatchDetails
    };
}
async function extractTextFromPdf(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        let rawText = data.text || "";

        /* ══════════════════════════════════════════════════════════════════
         * PHASE 1 — Substring scrubbing
         * pdf-parse sometimes concatenates header/footer text onto the
         * same line as body content. We scrub known phrases directly
         * from the raw string before doing any line-level work.
         * ══════════════════════════════════════════════════════════════════ */
        const PHRASE_SCRUB = [
            /davao\s+del\s+norte\s+state\s+college/gi,
            /dnsc\.edu\.ph/gi,
            /\.edu\.ph/gi,
            /institute\s+of\s+computing/gi,
            /college\s+of\s+\w+/gi,
            /university\s+of\s+\w+/gi,
            /polytechnic\s+(college|university|institute)/gi,
            /president@[^\s]+/gi,
            /@officialdnsc/gi,
            /new\s+visayas[,\s]*panabo\s+city[,\s]*\d*/gi,
            /panabo\s+city[,\s]*\d*/gi,
            /new\s+visayas/gi,
            /tel\.?\s*no\.?[\s:]+[\d\-\s]+/gi,
            /telefax[\s:]+[\d\-\s]+/gi,
            /\+63[\d\-\s]{7,}/g,
            /["\u201c]?inspiring\s+change[,\s]*creating\s+futures["\u201d]?/gi,
            /bacong\s+pilipinas/gi,
            /an?\s+institution\s+leading\s+in\s+agri/gi,
            /socio[\-\s]cultural\s+development/gi,
            /asean\s+region/gi,
            /future[\-\s]ready\s+workforce/gi,
            /empower\s+communities/gi,
            /uphold\s+good\s+governance/gi,
            /\bstewardship\b/gi,
            /adaptability\s+and\s+excellence/gi,
            /integrity\s+and\s+innovativeness/gi,
            /love\s+of\s+god\s+and\s+country/gi,
            /\[\d+(?:[,\s]*\d+)*\]/g,
            /\bpage\s+\d+\s+of\s+\d+\b/gi,
            /\bpage\s+\d+\b/gi,
        ];

        for (const re of PHRASE_SCRUB) {
            rawText = rawText.replace(re, ' ');
        }

        /* ══════════════════════════════════════════════════════════════════
         * PHASE 2 — References removal + line-level filtering
         * ══════════════════════════════════════════════════════════════════ */
        const rawLines = rawText.split(/\r?\n/);

        const bodyLines = [];
        let inReferences = false;
        for (const line of rawLines) {
            const t = line.trim();
            if (/^(references?|bibliography|works\s+cited|literature\s+cited)\s*$/i.test(t)) {
                inReferences = true;
            }
            if (inReferences) continue;
            bodyLines.push(line);
        }

        const LINE_PATTERNS = [
            /dnsc/i,
            /state\s+college/i,
            /president@/i,
            /panabo/i,
            /new\s+visayas/i,
            /\+63/i,
            /inspiring\s+change/i,
            /creating\s+futures/i,
            /bacong\s+pilipinas/i,
            /^vision$/i,
            /^mission$/i,
            /^core\s+values?$/i,
            /^stewardship/i,
            /^running\s+head:/i,
            /^\s*[-\u2013]?\s*\d{1,4}\s*[-\u2013]?\s*$/,
            /^\s*\d+\s+of\s+\d+\s*$/,
        ];

        const filteredLines = bodyLines
            .map(l => l.trim())
            .filter(l => {
                if (!l || l.length < 4) return false;
                if (LINE_PATTERNS.some(re => re.test(l))) return false;
                return true;
            });

        const seenCount = new Map();
        filteredLines.forEach(l => seenCount.set(l, (seenCount.get(l) || 0) + 1));
        const cleanLines = filteredLines.filter(l => seenCount.get(l) === 1);

        // Reassemble with paragraph structure preserved.
        // Wrapped body lines in PDF paragraphs get space-joined so sentences flow naturally.
        let assembled = '';
        let prevWasTable = false;
        for (let i = 0; i < cleanLines.length; i++) {
            const line = cleanLines[i];
            const isBullet = /^[•\-\*\d+[\.\)]]\s*/.test(line);
            const isShortHeader = line.length < 40 && !/[.,;:]\s*$/.test(line);
            const isTableLine = line.includes('\t') || line.includes('|') || / {3,}/.test(line);

            if (assembled.length === 0) {
                assembled = line;
            } else if (isTableLine || prevWasTable) {
                assembled += '\n' + line;
            } else if (isBullet) {
                assembled += '\n\n' + line;
            } else if (isShortHeader) {
                assembled += '\n\n' + line;
            } else {
                // If previous line ends with hyphenation (e.g., "implement-"), join without hyphen/space
                if (/-\s*$/.test(assembled)) {
                    assembled = assembled.replace(/-\s*$/, '') + line;
                } else {
                    const prevTerminal = /[.!?:]\s*$/.test(assembled);
                    if (prevTerminal && (isShortHeader || /^[A-Z0-9]/.test(line))) {
                        assembled += '\n\n' + line;
                    } else {
                        assembled += ' ' + line;
                    }
                }
            }
            prevWasTable = isTableLine;
        }
        return assembled.replace(/\n{3,}/g, '\n\n').trim();
    } catch (error) {
        console.error("Error reading PDF:", error);
        return "";
    }
}

/* ================= LOAD TITLE PROPOSALS ================= */

app.get("/title-proposals/:userId", (req, res) => {
    const userId = req.params.userId;

    const groupSql = `
        SELECT
            cg.id AS group_db_id
        FROM group_members gm
        JOIN capstone_groups cg ON gm.group_id = cg.id
        JOIN users u ON gm.student_id = u.id
        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [userId], (err, groupResult) => {
        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while loading group."
            });
        }

        if(groupResult.length === 0){
            return res.json({
                success:false,
                message:"You must belong to a group first."
            });
        }

        const groupDbId = groupResult[0].group_db_id;

        const proposalsSql = `
            SELECT
                tp.id,
                tp.title_number,
                tp.proposed_title,
                tp.proposed_objectives,
                tp.file_name,
                tp.file_path,
                tp.status,
                tp.created_at,
                tsr.similarity_percentage,
                tsr.similarity_level,
                tsr.matching_sections,
                r.title AS matched_title,
                r.abstract AS matched_abstract,
                r.objectives AS matched_objectives
            FROM title_proposals tp
            LEFT JOIN title_similarity_results tsr ON tp.id = tsr.proposed_title_id
            LEFT JOIN repository r ON tsr.matched_repository_id = r.id
            WHERE tp.group_id = ?
            ORDER BY tp.title_number ASC
        `;

        db.query(proposalsSql, [groupDbId], (err, proposalsResult) => {
            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load title proposals."
                });
            }

            res.json({
                success:true,
                proposals:proposalsResult
            });
        });
    });
});


/* ================= SAVE TITLE PROPOSAL (TEXT ONLY) ================= */

app.post("/save-title-proposal", (req, res) => {

    const {
        studentUserId,
        titleNumber,
        proposedTitle,
        proposedObjectives
    } = req.body;

    if(!studentUserId || !titleNumber || !proposedTitle){

        return res.json({
            success:false,
            message:"Please enter the proposed title."
        });
    }

    const groupSql = `
        SELECT
            cg.id AS group_db_id,
            u.id AS uploaded_by
        FROM group_members gm
        JOIN capstone_groups cg ON gm.group_id = cg.id
        JOIN users u ON gm.student_id = u.id
        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [studentUserId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking group."
            });
        }

        if(groupResult.length === 0){
            return res.json({
                success:false,
                message:"You must belong to a group before saving title proposals."
            });
        }

        const groupDbId =
            groupResult[0].group_db_id;

        const uploadedBy =
            groupResult[0].uploaded_by;

        const saveSql = `
            INSERT INTO title_proposals
            (
                group_id,
                title_number,
                proposed_title,
                proposed_objectives,
                file_name,
                file_path,
                uploaded_by,
                status
            )
            VALUES (?, ?, ?, '', '', '', ?, 'Pending Review')

            ON DUPLICATE KEY UPDATE
                proposed_title = VALUES(proposed_title),
                uploaded_by = VALUES(uploaded_by),
                status = 'Pending Review',
                updated_at = CURRENT_TIMESTAMP
        `;

        db.query(
            saveSql,
            [
                groupDbId,
                titleNumber,
                proposedTitle.trim(),
                uploadedBy
            ],
            (err2) => {

                if(err2){
                    console.log(err2);

                    return res.json({
                        success:false,
                        message:"Failed to save title proposal."
                    });
                }

                // Retrieve saved proposal ID to link it to similarity results
                const getProposalIdSql = `
                    SELECT id 
                    FROM title_proposals 
                    WHERE group_id = ? AND title_number = ?
                    LIMIT 1
                `;
                db.query(getProposalIdSql, [groupDbId, titleNumber], (err3, proposalResult) => {
                    if (err3 || proposalResult.length === 0) {
                        return res.json({
                            success:true,
                            message:`Title proposal ${titleNumber} saved.`
                        });
                    }

                    const proposedTitleId = proposalResult[0].id;

                    // Fetch all repository records for comparison
                    const getRepositorySql = `SELECT * FROM repository`;
                    db.query(getRepositorySql, (err4, repoResult) => {
                        if (err4 || !repoResult || repoResult.length === 0) {
                            return res.json({
                                success:true,
                                message:`Title proposal ${titleNumber} saved.`
                            });
                        }

                        const similarityResult = runSimilarityCheck(
                            proposedTitle.trim(),
                            proposedObjectives ? proposedObjectives.trim() : "",
                            repoResult
                        );

                        if (similarityResult && similarityResult.matchedRecord) {
                            const insertSimSql = `
                                INSERT INTO title_similarity_results
                                (
                                    student_id,
                                    proposed_title_id,
                                    matched_repository_id,
                                    similarity_percentage,
                                    similarity_level,
                                    matching_sections
                                )
                                VALUES (?, ?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE
                                    matched_repository_id = VALUES(matched_repository_id),
                                    similarity_percentage = VALUES(similarity_percentage),
                                    similarity_level = VALUES(similarity_level),
                                    matching_sections = VALUES(matching_sections),
                                    updated_at = CURRENT_TIMESTAMP
                            `;
                            db.query(
                                insertSimSql,
                                [
                                    studentUserId,
                                    proposedTitleId,
                                    similarityResult.matchedRecord.id,
                                    similarityResult.percentage,
                                    similarityResult.level,
                                    JSON.stringify(similarityResult.matchingSections)
                                ],
                                (err5) => {
                                    if (err5) {
                                        console.error("Error saving similarity result:", err5);
                                    }
                                    return res.json({
                                        success:true,
                                        message:`Title proposal ${titleNumber} saved & similarity check completed.`
                                    });
                                }
                            );
                        } else {
                            return res.json({
                                success:true,
                                message:`Title proposal ${titleNumber} saved.`
                            });
                        }
                    });
                });

            }
        );

    });

});


/* ================= UPLOAD TITLE PROPOSAL ================= */

app.post(
    "/upload-title-proposal",
    titleProposalUpload.single("proposalFile"),
    (req, res) => {
        const {
            studentUserId,
            titleNumber,
            proposedTitle
        } = req.body;

        if(!studentUserId || !titleNumber || !proposedTitle || !req.file){
            return res.json({
                success:false,
                message:"Please complete the title proposal and upload a PDF file."
            });
        }

        const groupSql = `
            SELECT
                cg.id AS group_db_id,
                u.id AS uploaded_by
            FROM group_members gm
            JOIN capstone_groups cg ON gm.group_id = cg.id
            JOIN users u ON gm.student_id = u.id
            WHERE u.user_id = ?
            LIMIT 1
        `;

        db.query(groupSql, [studentUserId], async (err, groupResult) => {
            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking group."
                });
            }

            if(groupResult.length === 0){
                return res.json({
                    success:false,
                    message:"You must belong to a group before uploading title proposals."
                });
            }

            const groupDbId =
                groupResult[0].group_db_id;

            const uploadedBy =
                groupResult[0].uploaded_by;

            const filePath =
                `/uploads/title_proposals/${req.file.filename}`;
            const physicalPath = req.file.path;

            // Extract objectives from PDF
            let parsedObjectives = "";
            try {
                parsedObjectives = await extractTextFromPdf(physicalPath);
            } catch(e) {
                console.error("Error parsing objectives from uploaded PDF:", e);
            }

            const getRepositorySql = `SELECT * FROM repository`;
            db.query(getRepositorySql, (errR, repoResult) => {
                if (errR) {
                    console.log(errR);
                    return res.json({
                        success: false,
                        message: "Database error while fetching repository records."
                    });
                }

                const similarityResult = runSimilarityCheck(
                    proposedTitle.trim(),
                    parsedObjectives.trim(),
                    repoResult || []
                );

                if (similarityResult && similarityResult.percentage >= 90) {
                    // Automatically reject and delete the uploaded file
                    try {
                        fs.unlinkSync(physicalPath);
                    } catch (unlinkErr) {
                        console.error("Error deleting rejected file:", unlinkErr);
                    }

                    return res.json({
                        success: false,
                        isSimilarityRejection: true,
                        similarityPercentage: similarityResult.percentage,
                        matchedTitle: similarityResult.matchedRecord.title,
                        message: `Automatically Rejected: This title proposal has a similarity score of ${similarityResult.percentage}% (matches "${similarityResult.matchedRecord.title}"), which exceeds the maximum allowable threshold of 90%. You are required to submit another concept.`
                    });
                }

                const saveSql = `
                    INSERT INTO title_proposals
                    (
                        group_id,
                        title_number,
                        proposed_title,
                        proposed_objectives,
                        file_name,
                        file_path,
                        uploaded_by,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review')

                    ON DUPLICATE KEY UPDATE
                        proposed_title = VALUES(proposed_title),
                        proposed_objectives = VALUES(proposed_objectives),
                        file_name = VALUES(file_name),
                        file_path = VALUES(file_path),
                        uploaded_by = VALUES(uploaded_by),
                        status = 'Pending Review',
                        updated_at = CURRENT_TIMESTAMP
                `;

                db.query(
                    saveSql,
                    [
                        groupDbId,
                        titleNumber,
                        proposedTitle,
                        parsedObjectives,
                        req.file.originalname,
                        filePath,
                        uploadedBy
                    ],
                    (err) => {
                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Failed to save title proposal."
                            });
                        }

                        // Since similarity is already checked, save results to DB directly
                        const getProposalIdSql = `
                            SELECT id 
                            FROM title_proposals 
                            WHERE group_id = ? AND title_number = ?
                            LIMIT 1
                        `;
                        db.query(getProposalIdSql, [groupDbId, titleNumber], (errP, proposalResult) => {
                            if (!errP && proposalResult.length > 0) {
                                const proposedTitleId = proposalResult[0].id;
                                if (similarityResult && similarityResult.matchedRecord) {
                                    const insertSimSql = `
                                        INSERT INTO title_similarity_results
                                        (
                                            student_id,
                                            proposed_title_id,
                                            matched_repository_id,
                                            similarity_percentage,
                                            similarity_level,
                                            matching_sections
                                        )
                                        VALUES (?, ?, ?, ?, ?, ?)
                                        ON DUPLICATE KEY UPDATE
                                            matched_repository_id = VALUES(matched_repository_id),
                                            similarity_percentage = VALUES(similarity_percentage),
                                            similarity_level = VALUES(similarity_level),
                                            matching_sections = VALUES(matching_sections),
                                            updated_at = CURRENT_TIMESTAMP
                                    `;
                                    db.query(insertSimSql, [
                                        studentUserId,
                                        proposedTitleId,
                                        similarityResult.matchedRecord.id,
                                        similarityResult.percentage,
                                        similarityResult.level,
                                        JSON.stringify(similarityResult.matchingSections)
                                    ]);
                                }
                            }
                        });

                        // Sync with student_documents
                        const docType = `Concept Presentation • Proposed concept paper (${titleNumber})`;
                        const checkDocSql = `
                            SELECT id, document_code FROM student_documents
                            WHERE group_id = ? AND document_type = ?
                            LIMIT 1
                        `;
                        db.query(checkDocSql, [groupDbId, docType], (err2, checkResult) => {
                            if(err2){
                                console.log("Error checking document sync:", err2);
                                return res.json({
                                    success:true,
                                    message:`Title Proposal ${titleNumber} uploaded, but document sync failed.`
                                });
                            }

                            if(checkResult.length > 0){
                                // Update existing document
                                const docId = checkResult[0].id;
                                const updateDocSql = `
                                    UPDATE student_documents
                                    SET
                                        document_title = ?,
                                        file_name = ?,
                                        file_path = ?,
                                        file_format = 'PDF',
                                        document_status = 'Uploaded',
                                        is_sent = 0,
                                        uploaded_by = ?,
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                    AND document_status != 'Approved'
                                `;
                                db.query(updateDocSql, [proposedTitle, req.file.originalname, filePath, uploadedBy, docId], (err3) => {
                                    if(err3){
                                        console.log("Error updating document sync:", err3);
                                        return res.json({
                                            success:true,
                                            message:`Title Proposal ${titleNumber} uploaded, but document sync update failed.`
                                        });
                                    }
                                    return res.json({
                                        success:true,
                                        message:`Title Proposal ${titleNumber} uploaded successfully and checked for similarity.`
                                    });
                                });
                            } else {
                                // Insert new document. We first need a new document code.
                                const lastDocumentSql = `
                                    SELECT document_code
                                    FROM student_documents
                                    WHERE document_code LIKE 'DOC2026-%'
                                    ORDER BY CAST(SUBSTRING_INDEX(document_code, '-', -1) AS UNSIGNED) DESC
                                    LIMIT 1
                                `;
                                db.query(lastDocumentSql, (err3, lastResult) => {
                                    let nextNumber = 1;
                                    if(!err3 && lastResult && lastResult.length > 0){
                                        const lastCode = lastResult[0].document_code;
                                        const numberPart = parseInt(lastCode.split("-")[1]);
                                        nextNumber = numberPart + 1;
                                    }
                                    const documentCode = `DOC2026-${String(nextNumber).padStart(4, "0")}`;

                                    const insertDocSql = `
                                        INSERT INTO student_documents
                                        (
                                            document_code,
                                            group_id,
                                            uploaded_by,
                                            document_type,
                                            document_title,
                                            file_name,
                                            file_path,
                                            file_format,
                                            document_status,
                                            is_sent
                                        )
                                        VALUES (?, ?, ?, ?, ?, ?, ?, 'PDF', 'Uploaded', 0)
                                    `;
                                    db.query(
                                        insertDocSql,
                                        [
                                            documentCode,
                                            groupDbId,
                                            uploadedBy,
                                            docType,
                                            proposedTitle,
                                            req.file.originalname,
                                            filePath
                                        ],
                                        (err4) => {
                                            if(err4){
                                                console.log("Error inserting document sync:", err4);
                                                return res.json({
                                                    success:true,
                                                    message:`Title Proposal ${titleNumber} uploaded, but document sync insert failed.`
                                                });
                                            }
                                            return res.json({
                                                success:true,
                                                message:`Title Proposal ${titleNumber} uploaded successfully and checked for similarity.`
                                            });
                                        }
                                    );
                                });
                            }
                        });
                    }
                );
            });
        });
    }
);

/* ================= ADVISER LOAD REQUESTS ================= */

app.get("/adviser-requests/:adviserUserId", (req, res) => {

    const adviserUserId = req.params.adviserUserId;

    const requestsSql = `
        SELECT
            ar.id AS request_id,
            ar.request_status,
            ar.request_message,
            ar.created_at,

            cg.id AS group_db_id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            cg.progress,
            cg.stage,
            cg.status,
            cg.adviser_id,

            pm.user_id AS project_manager_user_id,
            pm.fullname AS project_manager_name,

            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name

        FROM adviser_requests ar

        JOIN capstone_groups cg
            ON ar.group_id = cg.id

        LEFT JOIN users pm
            ON cg.project_manager_id = pm.id

        JOIN users adviser
            ON ar.adviser_id = adviser.id

        WHERE adviser.user_id = ?
        ORDER BY ar.created_at DESC
    `;

    db.query(requestsSql, [adviserUserId], (err, requestsResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load adviser requests."
            });
        }

        if(requestsResult.length === 0){

            return res.json({
                success:true,
                requests:[]
            });

        }

        const groupIds =
            requestsResult.map(request => request.group_db_id);

        const membersSql = `
            SELECT
                gm.group_id,
                gm.member_position,
                u.user_id,
                u.fullname,
                u.program,
                u.year_level,
                u.profile_image
            FROM group_members gm
            JOIN users u
                ON gm.student_id = u.id
            WHERE gm.group_id IN (?)
            ORDER BY gm.id ASC
        `;

        db.query(membersSql, [groupIds], (err, membersResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load group members."
                });
            }

            const proposalsSql = `
                SELECT
                    tp.id,
                    tp.group_id,
                    tp.title_number,
                    tp.proposed_title,
                    tp.proposed_objectives,
                    tp.file_name,
                    tp.file_path,
                    tp.status,
                    tp.created_at,
                    tsr.similarity_percentage,
                    tsr.similarity_level,
                    tsr.matching_sections,
                    r.title AS matched_title,
                    r.abstract AS matched_abstract,
                    r.objectives AS matched_objectives
                FROM title_proposals tp
                LEFT JOIN title_similarity_results tsr ON tp.id = tsr.proposed_title_id
                LEFT JOIN repository r ON tsr.matched_repository_id = r.id
                WHERE tp.group_id IN (?)
                ORDER BY tp.title_number ASC
            `;

            db.query(proposalsSql, [groupIds], (err, proposalsResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load title proposals."
                    });
                }

                const requests =
                    requestsResult.map(request => {

                        return {
                            ...request,

                            members: membersResult.filter(member =>
                                member.group_id === request.group_db_id
                            ),

                            proposals: proposalsResult.filter(proposal =>
                                proposal.group_id === request.group_db_id
                            )
                        };

                    });

                res.json({
                    success:true,
                    requests
                });

            });

        });

    });

});


/* ================= ADVISER DELETE REQUEST ================= */

app.delete("/delete-adviser-request/:requestId", (req, res) => {

    const requestId =
        req.params.requestId;

    const {
        adviserUserId
    } = req.body;

    if(!requestId || !adviserUserId){

        return res.json({
            success:false,
            message:"Missing request information."
        });

    }

    const checkSql = `
        SELECT
            ar.id,
            ar.group_id,
            ar.adviser_id,
            ar.request_status,

            cg.adviser_id AS current_group_adviser_id,

            adviser.user_id AS adviser_user_id
        FROM adviser_requests ar

        JOIN users adviser
            ON ar.adviser_id = adviser.id

        JOIN capstone_groups cg
            ON ar.group_id = cg.id

        WHERE ar.id = ?
        AND adviser.user_id = ?
    `;

    db.query(
        checkSql,
        [
            requestId,
            adviserUserId
        ],
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking request."
                });
            }

            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Request not found or you do not have permission to delete it."
                });

            }

            const request =
                result[0];

            const removeAssignedAdviser = () => {

                if(
                    request.request_status === "Accepted"
                    &&
                    request.current_group_adviser_id === request.adviser_id
                ){

                    const unassignSql = `
                        UPDATE capstone_groups
                        SET adviser_id = NULL
                        WHERE id = ?
                    `;

                    db.query(
                        unassignSql,
                        [
                            request.group_id
                        ],
                        (err) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to remove adviser assignment."
                                });
                            }

                            deleteRequest();

                        }
                    );

                }else{

                    deleteRequest();

                }

            };

            const deleteRequest = () => {

                const deleteSql = `
                    DELETE FROM adviser_requests
                    WHERE id = ?
                `;

                db.query(
                    deleteSql,
                    [
                        requestId
                    ],
                    (err) => {

                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Failed to delete adviser request."
                            });
                        }

                        res.json({
                            success:true,
                            message:"Adviser request deleted successfully."
                        });

                    }
                );

            };

            removeAssignedAdviser();

        }
    );

});

/* ================= ADVISER REMOVE ASSIGNMENT ================= */

app.put("/remove-adviser-assignment", (req, res) => {

    const {
        requestId,
        adviserUserId
    } = req.body;

    if(!requestId || !adviserUserId){

        return res.json({
            success:false,
            message:"Missing request information."
        });

    }

    const checkSql = `
        SELECT
            ar.id AS request_id,
            ar.group_id,
            ar.adviser_id,
            ar.request_status,

            cg.adviser_id AS current_group_adviser_id,

            adviser.user_id AS adviser_user_id
        FROM adviser_requests ar

        JOIN capstone_groups cg
            ON ar.group_id = cg.id

        JOIN users adviser
            ON ar.adviser_id = adviser.id

        WHERE ar.id = ?
        AND adviser.user_id = ?
    `;

    db.query(
        checkSql,
        [
            requestId,
            adviserUserId
        ],
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking assignment."
                });
            }

            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Request not found or you do not have permission to update it."
                });

            }

            const request =
                result[0];

            if(request.request_status !== "Accepted"){

                return res.json({
                    success:false,
                    message:"Only accepted adviser requests can remove adviser assignment."
                });

            }

            if(request.current_group_adviser_id !== request.adviser_id){

                return res.json({
                    success:false,
                    message:"This group is no longer assigned to you."
                });

            }

            const unassignSql = `
                UPDATE capstone_groups
                SET adviser_id = NULL
                WHERE id = ?
            `;

            db.query(
                unassignSql,
                [
                    request.group_id
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to remove adviser assignment."
                        });
                    }

                    const updateRequestSql = `
                        UPDATE adviser_requests
                        SET request_status = 'Removed'
                        WHERE id = ?
                    `;

                    db.query(
                        updateRequestSql,
                        [
                            requestId
                        ],
                        (err) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Assignment removed, but failed to update request status."
                                });
                            }

                            res.json({
                                success:true,
                                message:"Adviser assignment removed successfully. The group no longer has this adviser."
                            });

                        }
                    );

                }
            );

        }
    );

});

/* ================= ADVISER LOAD ASSIGNED CAPSTONE GROUPS ================= */

app.get("/adviser-capstone-groups/:adviserUserId", (req, res) => {

    const adviserUserId =
        req.params.adviserUserId;

    const groupsSql = `
        SELECT
            cg.id AS group_db_id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            cg.progress,
            cg.stage,
            cg.status,
            cg.created_at,

            pm.user_id AS project_manager_user_id,
            pm.fullname AS project_manager_name,

            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name,
            adviser.position AS adviser_position

        FROM capstone_groups cg

        JOIN users adviser
            ON cg.adviser_id = adviser.id

        LEFT JOIN users pm
            ON cg.project_manager_id = pm.id

        WHERE adviser.user_id = ?
        AND adviser.role IN ('faculty', 'admin')
        AND adviser.adviser_access = 1

        ORDER BY cg.id DESC
    `;

    db.query(groupsSql, [adviserUserId], (err, groupsResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load assigned capstone groups."
            });
        }

        if(groupsResult.length === 0){

            return res.json({
                success:true,
                groups:[]
            });

        }

        const groupDbIds =
            groupsResult.map(group =>
                group.group_db_id
            );

        const membersSql = `
            SELECT
                gm.group_id,
                gm.member_position,

                u.user_id,
                u.fullname,
                u.program,
                u.year_level,
                u.student_position,
                u.profile_image

            FROM group_members gm

            JOIN users u
                ON gm.student_id = u.id

            WHERE gm.group_id IN (?)

            ORDER BY gm.id ASC
        `;

        db.query(membersSql, [groupDbIds], (err, membersResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load group members."
                });
            }

            const proposalsSql = `
                SELECT
                    id,
                    group_id,
                    title_number,
                    proposed_title,
                    file_name,
                    file_path,
                    status,
                    created_at

                FROM title_proposals

                WHERE group_id IN (?)

                ORDER BY title_number ASC
            `;

            db.query(proposalsSql, [groupDbIds], (err, proposalsResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load title proposals."
                    });
                }

                const groups =
                    groupsResult.map(group => {

                        return {
                            ...group,

                            members:membersResult.filter(member =>
                                member.group_id === group.group_db_id
                            ),

                            proposals:proposalsResult.filter(proposal =>
                                proposal.group_id === group.group_db_id
                            )
                        };

                    });

                res.json({
                    success:true,
                    groups
                });

            });

        });

    });

});

/* ================= ADVISER DASHBOARD DATA ================= */

app.get("/adviser-dashboard-data/:adviserUserId", (req, res) => {
    const adviserUserId = req.params.adviserUserId;

    const adviserSql = `
        SELECT id, user_id, fullname, role, position, program, adviser_access
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [adviserUserId], (err, adviserResult) => {
        if(err){
            console.log(err);
            return res.json({ success: false, message: "Database error while loading adviser." });
        }

        if(adviserResult.length === 0){
            return res.json({ success: false, message: "Adviser not found or access disabled." });
        }

        const adviser = adviserResult[0];
        const adviserDbId = adviser.id;

        const groupsSql = "SELECT COUNT(*) AS total FROM capstone_groups WHERE adviser_id = ?";
        const requestsSql = "SELECT COUNT(*) AS total FROM adviser_requests WHERE adviser_id = ? AND request_status = 'Pending'";
        const docsSql = "SELECT review_status FROM document_submissions WHERE receiver_id = ?";
        const topGroupsSql = `
            SELECT cg.id, cg.group_id, cg.group_name, cg.project_title, cg.program, cg.progress, cg.stage, cg.status
            FROM capstone_groups cg
            WHERE cg.adviser_id = ?
            ORDER BY cg.id DESC
            LIMIT 3
        `;

        db.query(groupsSql, [adviserDbId], (err, groupsCount) => {
            if (err) console.log(err);
            db.query(requestsSql, [adviserDbId], (err, requestsCount) => {
                if (err) console.log(err);
                db.query(docsSql, [adviserDbId], (err, docsResult) => {
                    if (err) console.log(err);
                    db.query(topGroupsSql, [adviserDbId], (err, topGroupsResult) => {
                        if (err) console.log(err);

                        const assignedGroupsCount = groupsCount && groupsCount.length > 0 ? groupsCount[0].total : 0;
                        const pendingRequestsCount = requestsCount && requestsCount.length > 0 ? requestsCount[0].total : 0;
                        const docs = docsResult || [];
                        const pendingReviewsCount = docs.filter(d => d.review_status === "Pending Review").length;
                        const approvedDocumentsCount = docs.filter(d => d.review_status === "Approved").length;

                        res.json({
                            success: true,
                            faculty: adviser,
                            stats: {
                                assignedGroups: assignedGroupsCount,
                                pendingRequests: pendingRequestsCount,
                                documentsForReview: pendingReviewsCount,
                                approvedDocuments: approvedDocumentsCount
                            },
                            topGroups: topGroupsResult || []
                        });
                    });
                });
            });
        });
    });
});

/* ================= LOAD STUDENT DOCUMENTS ================= */

app.get("/student-documents/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const groupSql = `
        SELECT
            cg.id AS group_db_id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            adviser.user_id AS adviser_user_id,
            instructor.user_id AS instructor_user_id
        FROM group_members gm

        JOIN capstone_groups cg
            ON gm.group_id = cg.id

        JOIN users u
            ON gm.student_id = u.id

        LEFT JOIN users adviser
            ON cg.adviser_id = adviser.id

        LEFT JOIN users instructor
            ON instructor.user_id = u.enrolled_by_user_id
            AND instructor.role IN ('faculty', 'admin')

        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [userId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while loading group."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:false,
                message:"You must belong to a group before uploading documents."
            });

        }

        const group =
            groupResult[0];

        const documentsSql = `
            SELECT
                sd.id,
                sd.document_code,
                sd.document_type,
                sd.document_title,
                sd.file_name,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,
                sd.document_status,
                sd.is_sent,
                sd.sent_to_role,
                sd.submitted_at,
                sd.created_at,

                uploader.user_id AS uploaded_by_user_id,
                uploader.fullname AS uploaded_by_name,

                (
                    SELECT COUNT(*)
                    FROM document_submissions ds
                    WHERE ds.document_id = sd.id
                ) AS submission_count,

                (
                    SELECT ds.review_status
                    FROM document_submissions ds
                    WHERE ds.document_id = sd.id
                    AND ds.review_status IS NOT NULL
                    AND TRIM(ds.review_status) != ''
                    AND ds.review_status != 'Pending Review'
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS latest_review_status,

                (
                    SELECT ds.review_comment
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.adviser_access = 1
                    AND ds.review_comment IS NOT NULL
                    AND TRIM(ds.review_comment) != ''
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS latest_adviser_comment,

                (
                    SELECT COUNT(*)
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND ds.review_status = 'Approved'
                    AND reviewer.adviser_access = 1
                ) AS adviser_approval_count

            FROM student_documents sd

            JOIN users uploader
                ON sd.uploaded_by = uploader.id

            WHERE sd.group_id = ?

            ORDER BY sd.id DESC
        `;

        db.query(documentsSql, [group.group_db_id], (err, documentsResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load documents."
                });
            }

            // Get latest verdict per defense_type (most recent completed defense wins)
            const verdictsSql = `
                SELECT defense_type, panel_result, id
                FROM defense_schedules
                WHERE group_id = ?
                AND defense_status = 'Completed'
                AND panel_result IS NOT NULL
                ORDER BY id DESC
            `;
            db.query(verdictsSql, [group.group_db_id], (verdictErr, verdictRows) => {
                // Build: latest verdict per defense_type
                const latestVerdictByType = {};
                const redefensePhases = new Set();
                if (!verdictErr && verdictRows) {
                    verdictRows.forEach(vRow => {
                        const defType = String(vRow.defense_type || "").trim();
                        const resVal = String(vRow.panel_result || "").trim();
                        // Only store the first (latest by id DESC) verdict for each type
                        if (!latestVerdictByType[defType]) {
                            latestVerdictByType[defType] = resVal;
                        }
                    });
                    // Determine re-defense phases: latest verdict is Conditional Passed or For Re-Defense
                    Object.entries(latestVerdictByType).forEach(([defType, resVal]) => {
                        if (resVal === "Conditional Passed" || resVal === "Conditional Pass" || resVal === "For Re-Defense") {
                            redefensePhases.add(defType);
                        }
                    });
                }

                // Build array of { defense_type, latest_result } for the client
                const defenseVerdicts = Object.entries(latestVerdictByType).map(([defense_type, latest_result]) => ({
                    defense_type,
                    latest_result
                }));

                const documents =
                    (documentsResult || []).map(row => {

                        let adviserLocked =
                            String(row.document_status || "").trim() === "Approved";

                        let matchDefenseType = null;
                        const docTypeStr = String(row.document_type || "").toLowerCase();
                        if (docTypeStr.startsWith("concept presentation")) {
                            matchDefenseType = "Concept Presentation";
                        } else if (docTypeStr.startsWith("outline defense")) {
                            matchDefenseType = "Outline Defense";
                        } else if (docTypeStr.startsWith("pre-final defense")) {
                            matchDefenseType = "Pre-Final Defense";
                        } else if (docTypeStr.startsWith("final defense")) {
                            matchDefenseType = "Final Defense";
                        }

                        if (matchDefenseType && redefensePhases.has(matchDefenseType)) {
                            adviserLocked = false;
                        }

                        const submissionCount =
                            Number(row.submission_count || 0);

                        return {
                            ...row,
                            adviser_locked:adviserLocked,
                            can_send:!adviserLocked && slotHasStudentDocumentFile(row),
                            can_upload_replace:!adviserLocked
                        };

                    });

                const proposalsSql = `
                    SELECT
                        id,
                        title_number,
                        proposed_title,
                        file_name,
                        file_path,
                        status,
                        created_at
                    FROM title_proposals
                    WHERE group_id = ?
                    ORDER BY title_number ASC
                `;

                db.query(proposalsSql, [group.group_db_id], (err2, proposalsResult) => {

                    if(err2){
                        console.log(err2);
                    }

                    res.json({
                        success:true,
                        group,
                        documents,
                        title_proposals:proposalsResult || [],
                        defense_verdicts:defenseVerdicts || []
                    });

                });

            });

        });

    });

});

function slotHasStudentDocumentFile(documentRow){

    return !!(
        documentRow
        && documentRow.file_path
        && String(documentRow.file_path).trim()
    );

}

function syncTitleProposalFromStudentDocument(groupDbId, documentType, documentTitle, fileName, filePath, uploadedBy, callback){

    const match =
        String(documentType || "").match(/^Concept Presentation • Proposed concept paper \((\d)\)$/);

    if(!match){
        return callback(null);
    }

    const titleNumber =
        parseInt(match[1], 10);

    const saveSql = `
        INSERT INTO title_proposals
        (
            group_id,
            title_number,
            proposed_title,
            file_name,
            file_path,
            uploaded_by,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Pending Review')

        ON DUPLICATE KEY UPDATE
            proposed_title = VALUES(proposed_title),
            file_name = VALUES(file_name),
            file_path = VALUES(file_path),
            uploaded_by = VALUES(uploaded_by),
            status = 'Pending Review',
            updated_at = CURRENT_TIMESTAMP
    `;

    db.query(
        saveSql,
        [
            groupDbId,
            titleNumber,
            documentTitle,
            fileName,
            filePath,
            uploadedBy
        ],
        callback
    );

}


/* ================= UPLOAD STUDENT DOCUMENT ================= */

app.post(
    "/upload-student-document",
    studentDocumentUpload.single("documentFile"),
    (req, res) => {

        const {
            studentUserId,
            documentType,
            documentTitle
        } = req.body;

        if(
            !studentUserId
            ||
            !documentType
            ||
            !documentTitle
            ||
            !req.file
        ){

            return res.json({
                success:false,
                message:"Please complete all document information and upload a file."
            });

        }

        const groupSql = `
            SELECT
                cg.id AS group_db_id,
                u.id AS uploaded_by
            FROM group_members gm

            JOIN capstone_groups cg
                ON gm.group_id = cg.id

            JOIN users u
                ON gm.student_id = u.id

            WHERE u.user_id = ?
            LIMIT 1
        `;

        db.query(groupSql, [studentUserId], (err, groupResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking group."
                });
            }

            if(groupResult.length === 0){

                return res.json({
                    success:false,
                    message:"You must belong to a group before uploading documents."
                });

            }

            const groupDbId =
                groupResult[0].group_db_id;

            const uploadedBy =
                groupResult[0].uploaded_by;

            const filePath =
                "/uploads/student_documents/" + req.file.filename;

            const fileFormat =
                path.extname(req.file.originalname)
                    .replace(".", "")
                    .toUpperCase();

            const existingSql = `
                SELECT id, document_status
                FROM student_documents
                WHERE group_id = ?
                AND document_type = ?
                ORDER BY id DESC
                LIMIT 1
            `;

            db.query(
                existingSql,
                [groupDbId, documentType],
                (err, existingResult) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to check existing document slot."
                        });
                    }

                    const saveDocument = (doneCallback) => {

                        if(
                            existingResult.length > 0
                        ){

                            const updateSql = `
                                UPDATE student_documents
                                SET
                                    document_title = ?,
                                    file_name = ?,
                                    file_path = ?,
                                    file_format = ?,
                                    document_status = 'Uploaded',
                                    is_sent = 0,
                                    uploaded_by = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `;

                            return db.query(
                                updateSql,
                                [
                                    documentTitle,
                                    req.file.originalname,
                                    filePath,
                                    fileFormat,
                                    uploadedBy,
                                    existingResult[0].id
                                ],
                                doneCallback
                            );

                        }

                        const lastDocumentSql = `
                            SELECT document_code
                            FROM student_documents
                            WHERE document_code LIKE 'DOC2026-%'
                            ORDER BY CAST(SUBSTRING_INDEX(document_code, '-', -1) AS UNSIGNED) DESC
                            LIMIT 1
                        `;

                        db.query(lastDocumentSql, (err2, lastResult) => {

                            if(err2){
                                console.log(err2);

                                return res.json({
                                    success:false,
                                    message:"Failed to generate document code."
                                });
                            }

                            let nextNumber = 1;

                            if(lastResult.length > 0){

                                const lastCode =
                                    lastResult[0].document_code;

                                const numberPart =
                                    parseInt(lastCode.split("-")[1], 10);

                                nextNumber =
                                    numberPart + 1;

                            }

                            const documentCode =
                                `DOC2026-${String(nextNumber).padStart(4, "0")}`;

                            const insertSql = `
                                INSERT INTO student_documents
                                (
                                    document_code,
                                    group_id,
                                    uploaded_by,
                                    document_type,
                                    document_title,
                                    file_name,
                                    file_path,
                                    file_format,
                                    document_status,
                                    is_sent
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Uploaded', 0)
                            `;

                            db.query(
                                insertSql,
                                [
                                    documentCode,
                                    groupDbId,
                                    uploadedBy,
                                    documentType,
                                    documentTitle,
                                    req.file.originalname,
                                    filePath,
                                    fileFormat
                                ],
                                doneCallback
                            );

                        });

                    };

                    const saveAndSync = () => {
                        saveDocument((err3) => {

                            if(err3){
                                console.log(err3);

                                return res.json({
                                    success:false,
                                    message:"Failed to save document."
                                });
                            }

                            syncTitleProposalFromStudentDocument(
                                groupDbId,
                                documentType,
                                documentTitle,
                                req.file.originalname,
                                filePath,
                                uploadedBy,
                                (err4) => {

                                    if(err4){
                                        console.log(err4);
                                    }

                                    res.json({
                                        success:true,
                                        message:"Document uploaded successfully."
                                    });

                                }
                            );

                        });
                    };

                    const checkApprovedAndAllowResubmit = () => {
                        if (existingResult.length > 0 && String(existingResult[0].document_status || "").trim() === "Approved") {
                            let matchDefenseType = null;
                            const docTypeStr = String(documentType).toLowerCase();
                            if (docTypeStr.startsWith("concept presentation")) {
                                matchDefenseType = "Concept Presentation";
                            } else if (docTypeStr.startsWith("outline defense")) {
                                matchDefenseType = "Outline Defense";
                            } else if (docTypeStr.startsWith("pre-final defense")) {
                                matchDefenseType = "Pre-Final Defense";
                            } else if (docTypeStr.startsWith("final defense")) {
                                matchDefenseType = "Final Defense";
                            }

                            if (matchDefenseType) {
                                const checkVerdictSql = `
                                    SELECT panel_result
                                    FROM defense_schedules
                                    WHERE group_id = ?
                                    AND defense_type = ?
                                    AND defense_status = 'Completed'
                                    ORDER BY defense_date DESC, id DESC
                                    LIMIT 1
                                `;
                                db.query(checkVerdictSql, [groupDbId, matchDefenseType], (verdictErr, verdictResult) => {
                                    if (!verdictErr && verdictResult.length > 0) {
                                        const resVal = String(verdictResult[0].panel_result || "").trim();
                                        if (resVal === "Conditional Passed" || resVal === "Conditional Pass" || resVal === "For Re-Defense") {
                                            saveAndSync();
                                            return;
                                        }
                                    }
                                    return res.json({
                                        success:false,
                                        message:"This document was approved by your adviser and cannot be replaced."
                                    });
                                });
                                return;
                            }

                            return res.json({
                                success:false,
                                message:"This document was approved by your adviser and cannot be replaced."
                            });
                        }

                        saveAndSync();
                    };

                    checkApprovedAndAllowResubmit();

                }
            );

        });

    }
);


/* ================= DELETE STUDENT DOCUMENT ================= */

app.delete("/delete-student-document/:documentId", (req, res) => {

    const documentId =
        req.params.documentId;

    const {
        studentUserId
    } = req.body;

    if(!documentId || !studentUserId){

        return res.json({
            success:false,
            message:"Missing document information."
        });

    }

    const checkSql = `
        SELECT
            sd.id,
            sd.file_path,
            sd.is_sent,
            sd.document_type,
            sd.group_id,
            uploader.user_id AS uploader_user_id
        FROM student_documents sd

        JOIN users uploader
            ON sd.uploaded_by = uploader.id

        WHERE sd.id = ?
        AND uploader.user_id = ?
    `;

    db.query(
        checkSql,
        [
            documentId,
            studentUserId
        ],
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking document."
                });
            }

            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Document not found or you do not have permission to delete it."
                });

            }

            const document =
                result[0];

            if(String(document.document_status || "").trim() === "Approved"){

                return res.json({
                    success:false,
                    message:"This document was approved by your adviser and cannot be deleted."
                });

            }

            const fullPath =
                path.join(
                    __dirname,
                    document.file_path.replace("/uploads", "uploads")
                );

            if(fs.existsSync(fullPath)){

                fs.unlinkSync(fullPath);

            }

            const deleteSql = `
                DELETE FROM student_documents
                WHERE id = ?
            `;

            db.query(deleteSql, [documentId], (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to delete document record."
                    });
                }

                // Sync with title_proposals if it's a Proposed concept paper (1-3)
                const docType = String(document.document_type || "");
                const docTypeMatch = docType.match(/^Concept Presentation • Proposed concept paper \((\d)\)$/);
                if(docTypeMatch){
                    const titleNumber = parseInt(docTypeMatch[1]);
                    const deleteProposalSql = `
                        DELETE FROM title_proposals
                        WHERE group_id = ? AND title_number = ?
                    `;
                    db.query(deleteProposalSql, [document.group_id, titleNumber], (errProposal) => {
                        if(errProposal){
                            console.log("Error deleting synchronized title proposal:", errProposal);
                        }
                        return res.json({
                            success:true,
                            message:"Document deleted successfully."
                        });
                    });
                } else {
                    res.json({
                        success:true,
                        message:"Document deleted successfully."
                    });
                }

            });

        }
    );

});

/* ================= STUDENT RECEIVED DOCUMENTS FROM FACULTY ================= */

app.get("/student-received-documents/:userId", (req, res) => {

    const userId = req.params.userId;

    if(!userId){
        return res.json({
            success: false,
            message: "Missing user ID."
        });
    }

    const studentSql = `
        SELECT id FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(studentSql, [userId], (err, studentResult) => {

        if(err){
            console.log(err);
            return res.json({ success: false, message: "Failed to find student account." });
        }

        if(studentResult.length === 0){
            return res.json({ success: false, message: "Student account not found." });
        }

        const studentDbId = studentResult[0].id;

        const receivedSql = `
            SELECT
                fds.id AS submission_id,
                fds.submission_message,
                fds.submission_status,
                fds.sent_at,

                fd.id AS document_id,
                fd.document_code,
                fd.document_title,
                fd.document_type,
                fd.file_name,
                fd.file_path,
                fd.file_format,

                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name,
                sender.role AS sender_role,
                sender.position AS sender_position,
                CASE
                    WHEN sender.adviser_access = 1 AND sender.instructor_access = 1 THEN 'Adviser / Instructor'
                    WHEN sender.adviser_access = 1 THEN 'Adviser'
                    WHEN sender.instructor_access = 1 THEN 'Instructor'
                    ELSE sender.role
                END AS sender_type

            FROM faculty_document_submissions fds

            JOIN faculty_documents fd
                ON fds.document_id = fd.id

            JOIN users sender
                ON fds.sender_id = sender.id

            WHERE fds.receiver_id = ?

            ORDER BY fds.sent_at DESC
        `;

        db.query(receivedSql, [studentDbId], (err, receivedDocuments) => {

            if(err){
                console.log(err);
                return res.json({ success: false, message: "Failed to load received documents." });
            }

            res.json({
                success: true,
                receivedDocuments: receivedDocuments || []
            });

        });

    });

});


/* ================= CREATE ANNOUNCEMENT ================= */

app.post("/create-announcement", (req, res) => {

    const {
        adminUserId,
        announcementTitle,
        announcementType,
        audience,
        targetProgram,
        announcementContent
    } = req.body;

    if(
        !adminUserId ||
        !announcementTitle ||
        !announcementType ||
        !audience ||
        !announcementContent
    ){
        return res.json({
            success:false,
            message:"Please complete all required announcement fields."
        });
    }

    const adminSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Only admin accounts can create announcements."
            });
        }

        const createdBy =
            adminResult[0].id;

        const announcementCode =
            "ANN2026-" + Date.now();

        const insertSql = `
            INSERT INTO announcements
            (
                announcement_code,
                created_by,
                announcement_title,
                announcement_type,
                audience,
                target_program,
                announcement_content,
                announcement_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Published')
        `;

        db.query(
            insertSql,
            [
                announcementCode,
                createdBy,
                announcementTitle,
                announcementType,
                audience,
                targetProgram || null,
                announcementContent
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to create announcement."
                    });
                }

                notifyUsersAboutAnnouncement(announcementTitle, announcementContent, audience, targetProgram);

                return res.json({
                    success:true,
                    message:"Announcement published successfully."
                });

            }
        );

    });

});

/* ================= ADMIN CREATE ANNOUNCEMENT ================= */

app.post("/create-announcement", (req, res) => {

    const {
        adminUserId,
        announcementTitle,
        announcementType,
        audience,
        targetProgram,
        announcementContent
    } = req.body;

    if(
        !adminUserId ||
        !announcementTitle ||
        !announcementType ||
        !audience ||
        !announcementContent
    ){
        return res.json({
            success:false,
            message:"Please complete all required announcement fields."
        });
    }

    const adminSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Only admin accounts can create announcements."
            });
        }

        const createdBy =
            adminResult[0].id;

        const announcementCode =
            "ANN2026-" + Date.now();

        const insertSql = `
            INSERT INTO announcements
            (
                announcement_code,
                created_by,
                announcement_title,
                announcement_type,
                audience,
                target_program,
                announcement_content,
                announcement_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Published')
        `;

        db.query(
            insertSql,
            [
                announcementCode,
                createdBy,
                announcementTitle,
                announcementType,
                audience,
                targetProgram || null,
                announcementContent
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to create announcement."
                    });
                }

                notifyUsersAboutAnnouncement(announcementTitle, announcementContent, audience, targetProgram);

                res.json({
                    success:true,
                    message:"Announcement published successfully."
                });

            }
        );

    });

});


/* ================= ADMIN LOAD ANNOUNCEMENTS ================= */

app.get("/admin-announcements", (req, res) => {

    const sql = `
        SELECT
            a.id,
            a.announcement_code,
            a.announcement_title,
            a.announcement_type,
            a.audience,
            a.target_program,
            a.announcement_content,
            a.announcement_status,
            a.created_at,
            a.updated_at,

            u.user_id AS created_by_user_id,
            u.fullname AS created_by_name

        FROM announcements a

        JOIN users u
            ON a.created_by = u.id

        ORDER BY a.id DESC
    `;

    db.query(sql, (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load announcements."
            });
        }

        res.json({
            success:true,
            announcements:result
        });

    });

});


/* ================= ADMIN UPDATE ANNOUNCEMENT ================= */

app.put("/update-announcement/:announcementId", (req, res) => {

    const announcementId =
        req.params.announcementId;

    const {
        adminUserId,
        announcementTitle,
        announcementType,
        audience,
        targetProgram,
        announcementContent,
        announcementStatus
    } = req.body;

    if(
        !announcementId ||
        !adminUserId ||
        !announcementTitle ||
        !announcementType ||
        !audience ||
        !announcementContent ||
        !announcementStatus
    ){
        return res.json({
            success:false,
            message:"Please complete all required announcement fields."
        });
    }

    const adminSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Only admin accounts can update announcements."
            });
        }

        const updateSql = `
            UPDATE announcements
            SET
                announcement_title = ?,
                announcement_type = ?,
                audience = ?,
                target_program = ?,
                announcement_content = ?,
                announcement_status = ?
            WHERE id = ?
        `;

        db.query(
            updateSql,
            [
                announcementTitle,
                announcementType,
                audience,
                targetProgram || null,
                announcementContent,
                announcementStatus,
                announcementId
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to update announcement."
                    });
                }

                res.json({
                    success:true,
                    message:"Announcement updated successfully."
                });

            }
        );

    });

});


/* ================= ADMIN DELETE ANNOUNCEMENT ================= */

app.delete("/delete-announcement/:announcementId", (req, res) => {

    const announcementId =
        req.params.announcementId;

    const {
        adminUserId
    } = req.body;

    if(!announcementId || !adminUserId){
        return res.json({
            success:false,
            message:"Missing announcement information."
        });
    }

    const adminSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Only admin accounts can delete announcements."
            });
        }

        const deleteSql = `
            DELETE FROM announcements
            WHERE id = ?
        `;

        db.query(deleteSql, [announcementId], (err) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to delete announcement."
                });
            }

            res.json({
                success:true,
                message:"Announcement deleted successfully."
            });

        });

    });

});

/* ================= USER DIGITAL SIGNATURE ================= */

function saveUserDigitalSignature(req, res){

    const portalUserId =
        req.body.portalUserId
        || req.body.studentUserId
        || req.body.facultyUserId
        || req.body.adminUserId;

    if(!portalUserId){

        return res.json({
            success:false,
            message:"Missing account ID. Please log in again."
        });

    }

    if(!req.file){

        return res.json({
            success:false,
            message:"Please select a signature image to upload."
        });

    }

    const getOldSql = `
        SELECT digital_signature
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(getOldSql, [portalUserId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check current signature."
            });
        }

        if(!result || result.length === 0){

            return res.json({
                success:false,
                message:"Account not found."
            });

        }

        const oldSignature =
            result[0].digital_signature;

        const newSignaturePath =
            `/uploads/signatures/${req.file.filename}`;

        const updateSql = `
            UPDATE users
            SET digital_signature = ?
            WHERE user_id = ?
        `;

        db.query(
            updateSql,
            [newSignaturePath, portalUserId],
            (updateErr) => {

                if(updateErr){
                    console.log(updateErr);

                    return res.json({
                        success:false,
                        message:"Failed to save digital signature."
                    });
                }

                if(
                    oldSignature
                    && oldSignature !== newSignaturePath
                ){

                    const oldFilePath =
                        path.join(
                            __dirname,
                            oldSignature.replace(/^\//, "")
                        );

                    if(fs.existsSync(oldFilePath)){
                        fs.unlinkSync(oldFilePath);
                    }

                }

                res.json({
                    success:true,
                    message:"Digital signature saved successfully.",
                    digital_signature:newSignaturePath
                });

            }
        );

    });

}

app.post("/update-user-digital-signature", (req, res) => {

    signatureImageUpload.single("signatureImage")(
        req,
        res,
        (uploadErr) => {

            if(uploadErr instanceof multer.MulterError){

                if(uploadErr.code === "LIMIT_FILE_SIZE"){

                    return res.json({
                        success:false,
                        message:"Signature image must be 5 MB or smaller."
                    });

                }

                return res.json({
                    success:false,
                    message:uploadErr.message
                });

            }

            if(uploadErr){

                return res.json({
                    success:false,
                    message:uploadErr.message || "Invalid signature file."
                });

            }

            saveUserDigitalSignature(req, res);

        }
    );

});

app.put("/remove-user-digital-signature", (req, res) => {

    const portalUserId =
        req.body.portalUserId
        || req.body.studentUserId
        || req.body.facultyUserId
        || req.body.adminUserId;

    if(!portalUserId){

        return res.json({
            success:false,
            message:"Missing user account."
        });

    }

    const getOldSql = `
        SELECT digital_signature
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(getOldSql, [portalUserId], (err, result) => {

        if(err || !result || result.length === 0){

            return res.json({
                success:false,
                message:"Account not found."
            });

        }

        const oldSignature =
            result[0].digital_signature;

        db.query(
            `UPDATE users SET digital_signature = NULL WHERE user_id = ?`,
            [portalUserId],
            (updateErr) => {

                if(updateErr){
                    console.log(updateErr);

                    return res.json({
                        success:false,
                        message:"Failed to remove digital signature."
                    });
                }

                if(oldSignature){

                    const oldFilePath =
                        path.join(
                            __dirname,
                            oldSignature.replace(/^\//, "")
                        );

                    if(fs.existsSync(oldFilePath)){
                        fs.unlinkSync(oldFilePath);
                    }

                }

                res.json({
                    success:true,
                    message:"Digital signature removed."
                });

            }
        );

    });

});


/* ================= LOAD STUDENT SETTINGS ================= */

app.get("/student-settings/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const sql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.password,
            u.role,
            u.program,
            u.year_level,
            u.student_position,
            u.profile_image,
            u.digital_signature,
            cg.group_id,
            cg.group_name,
            cg.project_title
        FROM users u

        LEFT JOIN group_members gm
            ON u.id = gm.student_id

        LEFT JOIN capstone_groups cg
            ON gm.group_id = cg.id

        WHERE u.user_id = ?
        AND u.role = 'student'
        LIMIT 1
    `;

    db.query(sql, [userId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load student settings."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Student account not found."
            });

        }

        res.json({
            success:true,
            student:result[0]
        });

    });

});


/* ================= UPDATE STUDENT PROFILE ================= */

app.put("/update-student-profile", (req, res) => {

    const {
        studentUserId,
        fullname,
        program,
        yearLevel,
        studentPosition
    } = req.body;

    if(
        !studentUserId ||
        !fullname ||
        !program ||
        !yearLevel ||
        !studentPosition
    ){
        return res.json({
            success:false,
            message:"Please complete all profile fields."
        });
    }

    const sql = `
        UPDATE users
        SET
            fullname = ?,
            program = ?,
            year_level = ?,
            student_position = ?
        WHERE user_id = ?
        AND role = 'student'
    `;

    db.query(
        sql,
        [
            fullname,
            program,
            yearLevel,
            studentPosition,
            studentUserId
        ],
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to update student profile."
                });
            }

            if(result.affectedRows === 0){

                return res.json({
                    success:false,
                    message:"Student account not found."
                });

            }

            res.json({
                success:true,
                message:"Profile updated successfully."
            });

        }
    );

});


/* ================= CHANGE STUDENT PASSWORD ================= */

app.put("/change-student-password", (req, res) => {

    const {
        studentUserId,
        currentPassword,
        newPassword
    } = req.body;

    if(
        !studentUserId ||
        !currentPassword ||
        !newPassword
    ){
        return res.json({
            success:false,
            message:"Please complete all password fields."
        });
    }

    if(newPassword.length < 6){

        return res.json({
            success:false,
            message:"New password must be at least 6 characters."
        });

    }

    const checkSql = `
        SELECT id, password
        FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(checkSql, [studentUserId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking password."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Student account not found."
            });

        }

        if(result[0].password !== currentPassword){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const updateSql = `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            AND role = 'student'
        `;

        db.query(
            updateSql,
            [
                newPassword,
                studentUserId
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to change password."
                    });
                }

                const studentDbId = result[0].id;
                const notifSql = `
                    INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                    VALUES (?, 'Security Update', 'Your password has been changed successfully.', 'System')
                `;
                db.query(notifSql, [studentDbId], (notifErr) => {
                    if (notifErr) console.error("Failed to insert password change notification:", notifErr);
                });

                res.json({
                    success:true,
                    message:"Password changed successfully."
                });

            }
        );

    });

});


/* ================= UPDATE STUDENT PROFILE IMAGE ================= */

app.post(
    "/update-student-profile-image",
    profileImageUpload.single("profileImage"),
    (req, res) => {

        const {
            studentUserId
        } = req.body;

        if(!studentUserId || !req.file){

            return res.json({
                success:false,
                message:"Please select an image to upload."
            });

        }

        const getOldSql = `
            SELECT profile_image
            FROM users
            WHERE user_id = ?
            AND role = 'student'
            LIMIT 1
        `;

        db.query(getOldSql, [studentUserId], (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to check current profile image."
                });
            }

            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Student account not found."
                });

            }

            const oldImage =
                result[0].profile_image;

            const newImagePath =
                `/uploads/profile_images/${req.file.filename}`;

            const updateSql = `
                UPDATE users
                SET profile_image = ?
                WHERE user_id = ?
                AND role = 'student'
            `;

            db.query(
                updateSql,
                [
                    newImagePath,
                    studentUserId
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update profile image."
                        });
                    }

                    if(oldImage){

                        const oldImagePath =
                            path.join(
                                __dirname,
                                oldImage.replace("/uploads", "uploads")
                            );

                        if(fs.existsSync(oldImagePath)){

                            fs.unlinkSync(oldImagePath);

                        }

                    }

                    res.json({
                        success:true,
                        message:"Profile image updated successfully.",
                        profileImage:newImagePath
                    });

                }
            );

        });

    }
);

/* ================= LOAD DOCUMENT RECIPIENTS ================= */

app.get("/document-recipients", (req, res) => {

    const studentUserId =
        String(req.query.studentUserId || "").trim();

    if(!studentUserId){

        return res.json({
            success:false,
            message:"Missing student user id."
        });

    }

    const groupSql = `
        SELECT
            cg.id AS group_db_id,
            cg.adviser_id,
            u.enrolled_by_user_id
        FROM group_members gm

        JOIN capstone_groups cg
            ON gm.group_id = cg.id

        JOIN users u
            ON gm.student_id = u.id

        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [studentUserId], (err, groupResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load group for recipients."
            });
        }

        if(groupResult.length === 0){

            return res.json({
                success:true,
                recipients:[]
            });

        }

        const group =
            groupResult[0];

        const usersSql = `
            SELECT
                id,
                user_id,
                fullname,
                role,
                position,
                adviser_access,
                panelist_access,
                instructor_access
            FROM users
            WHERE role IN ('faculty', 'admin')
            ORDER BY fullname ASC
        `;

        db.query(usersSql, [], (err2, usersResult) => {

            if(err2){
                console.log(err2);

                return res.json({
                    success:false,
                    message:"Failed to load faculty recipients."
                });
            }

            const recipients = (usersResult || []).map(user => {
                let recipient_type = null;

                if (group.adviser_id && user.id === group.adviser_id) {
                    recipient_type = "adviser";
                } else if (group.enrolled_by_user_id && user.user_id === group.enrolled_by_user_id) {
                    recipient_type = "instructor";
                }

                return {
                    ...user,
                    recipient_type
                };
            });

            // Sort recipients: adviser first, instructor second, then the rest
            const ordered = recipients.sort((a, b) => {
                if(a.recipient_type === "adviser") return -1;
                if(b.recipient_type === "adviser") return 1;
                if(a.recipient_type === "instructor") return -1;
                if(b.recipient_type === "instructor") return 1;
                return 0;
            });

            res.json({
                success:true,
                recipients:ordered
            });

        });

    });

});


/* ================= SEND STUDENT DOCUMENT ================= */

app.post("/send-student-document", (req, res) => {

    const {
        studentUserId,
        documentId,
        recipientIds,
        submissionMessage
    } = req.body;

    if(
        !studentUserId ||
        !documentId ||
        !recipientIds ||
        recipientIds.length === 0
    ){
        return res.json({
            success:false,
            message:"Please select at least one recipient."
        });
    }

    const senderSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(senderSql, [studentUserId], (err, senderResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking student."
            });
        }

        if(senderResult.length === 0){
            return res.json({
                success:false,
                message:"Student account not found."
            });
        }

        const senderId =
            senderResult[0].id;

        const checkDocumentSql = `
            SELECT
                sd.id,
                sd.document_status,
                sd.file_path,
                sd.document_title,
                sd.document_type,
                cg.id AS group_db_id,
                cg.group_id AS group_code,
                cg.group_name,
                u.fullname AS student_name
            FROM student_documents sd

            JOIN group_members gm
                ON sd.group_id = gm.group_id

            JOIN capstone_groups cg
                ON gm.group_id = cg.id

            JOIN users u
                ON gm.student_id = u.id

            WHERE sd.id = ?
            AND gm.student_id = ?
            LIMIT 1
        `;

        db.query(
            checkDocumentSql,
            [
                documentId,
                senderId
            ],
            (err, documentResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Database error while checking document."
                    });
                }

                if(documentResult.length === 0){
                    return res.json({
                        success:false,
                        message:"Document not found or you do not have permission to send it."
                    });
                }

                const documentRow =
                    documentResult[0];

                if(String(documentRow.document_status || "").trim() === "Approved"){
                    return res.json({
                        success:false,
                        message:"This document was approved by your adviser and is locked. It cannot be sent again."
                    });
                }

                if(!slotHasStudentDocumentFile(documentRow)){
                    return res.json({
                        success:false,
                        message:"Please upload a file before sending this document."
                    });
                }

                const processSubmission = (idx, callback) => {
                    if (idx >= recipientIds.length) {
                        return callback(null);
                    }

                    const receiverId = recipientIds[idx];

                    const checkExistSql = `
                        SELECT id FROM document_submissions
                        WHERE document_id = ? AND receiver_id = ?
                        LIMIT 1
                    `;

                    db.query(checkExistSql, [documentId, receiverId], (errExist, existResult) => {
                        if (errExist) {
                            return callback(errExist);
                        }

                        if (existResult && existResult.length > 0) {
                            // Update existing submission, reset review fields and status to pending review
                            const updateSubmissionSql = `
                                UPDATE document_submissions
                                SET
                                    submission_message = ?,
                                    review_status = NULL,
                                    review_comment = NULL,
                                    reviewed_by = NULL,
                                    reviewed_at = NULL,
                                    submission_status = 'Sent',
                                    sent_at = NOW()
                                WHERE id = ?
                            `;
                            db.query(updateSubmissionSql, [submissionMessage || "", existResult[0].id], (errUpdate) => {
                                if (errUpdate) {
                                    return callback(errUpdate);
                                }
                                processSubmission(idx + 1, callback);
                            });
                        } else {
                            // Insert a new submission
                            const insertSubmissionSql = `
                                INSERT INTO document_submissions
                                (
                                    document_id,
                                    sender_id,
                                    receiver_id,
                                    submission_message
                                )
                                VALUES (?, ?, ?, ?)
                            `;
                            db.query(
                                insertSubmissionSql,
                                [documentId, senderId, receiverId, submissionMessage || ""],
                                (errInsert) => {
                                    if (errInsert) {
                                        return callback(errInsert);
                                    }
                                    processSubmission(idx + 1, callback);
                                }
                            );
                        }
                    });
                };

                processSubmission(0, (err) => {

                    if (err) {
                        console.log(err);

                        return res.json({
                            success: false,
                            message: "Failed to send document."
                        });
                    }

                    const updateSql = `
                        UPDATE student_documents
                        SET
                            is_sent = 1,
                            document_status = 'Sent',
                            submitted_at = NOW()
                        WHERE id = ?
                        AND document_status != 'Approved'
                    `;

                    db.query(updateSql, [documentId], (err2) => {

                        if (err2) {
                            console.log(err2);

                            return res.json({
                                success: false,
                                message: "Document sent, but failed to update document status."
                            });
                        }

                        // Send notification to selected faculty recipients
                        insertUserNotificationsByDbIds(
                            recipientIds,
                            "New Document Submission",
                            `Student ${documentRow.student_name} from group "${documentRow.group_name || documentRow.group_code}" has submitted a ${documentRow.document_type || "document"} ("${documentRow.document_title}").`,
                            "Document"
                        );

                        res.json({
                            success: true,
                            message: "Document sent to selected faculty."
                        });

                    });

                });

            }
        );

    });

});

/* ================= LOAD FACULTY SETTINGS ================= */

app.get("/faculty-settings/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const sql = `
        SELECT
            id,
            user_id,
            fullname,
            password,
            role,
            position,
            program,
            adviser_access,
            panelist_access,
            instructor_access,
            profile_image,
            digital_signature
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(sql, [userId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load faculty settings."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Faculty account not found."
            });

        }

        res.json({
            success:true,
            faculty:result[0]
        });

    });

});


/* ================= UPDATE FACULTY PROFILE ================= */

app.put("/update-faculty-profile", (req, res) => {

    const {
        facultyUserId,
        fullname,
        position,
        program
    } = req.body;

    if(
        !facultyUserId ||
        !fullname ||
        !position ||
        !program
    ){
        return res.json({
            success:false,
            message:"Please complete all profile fields."
        });
    }

    const sql = `
        UPDATE users
        SET
            fullname = ?,
            position = ?,
            program = ?
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
    `;

    db.query(
        sql,
        [
            fullname,
            position,
            program,
            facultyUserId
        ],
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to update faculty profile."
                });
            }

            if(result.affectedRows === 0){

                return res.json({
                    success:false,
                    message:"Faculty account not found."
                });

            }

            res.json({
                success:true,
                message:"Profile updated successfully."
            });

        }
    );

});


/* ================= CHANGE FACULTY PASSWORD ================= */

app.put("/change-faculty-password", (req, res) => {

    const {
        facultyUserId,
        currentPassword,
        newPassword
    } = req.body;

    if(
        !facultyUserId ||
        !currentPassword ||
        !newPassword
    ){
        return res.json({
            success:false,
            message:"Please complete all password fields."
        });
    }

    if(newPassword.length < 6){

        return res.json({
            success:false,
            message:"New password must be at least 6 characters."
        });

    }

    const checkSql = `
        SELECT id, password
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(checkSql, [facultyUserId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking password."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Faculty account not found."
            });

        }

        if(result[0].password !== currentPassword){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const updateSql = `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            AND role IN ('faculty', 'admin')
        `;

        db.query(
            updateSql,
            [
                newPassword,
                facultyUserId
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to change password."
                    });
                }

                const facultyDbId = result[0].id;
                const notifSql = `
                    INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                    VALUES (?, 'Security Update', 'Your password has been changed successfully.', 'System')
                `;
                db.query(notifSql, [facultyDbId], (notifErr) => {
                    if (notifErr) console.error("Failed to insert password change notification:", notifErr);
                });

                res.json({
                    success:true,
                    message:"Password changed successfully."
                });

            }
        );

    });

});


/* ================= UPDATE FACULTY PROFILE IMAGE ================= */

app.post(
    "/update-faculty-profile-image",
    profileImageUpload.single("profileImage"),
    (req, res) => {

        const {
            facultyUserId
        } = req.body;

        if(!facultyUserId || !req.file){

            return res.json({
                success:false,
                message:"Please select an image to upload."
            });

        }

        const getOldSql = `
            SELECT profile_image
            FROM users
            WHERE user_id = ?
            AND role IN ('faculty', 'admin')
            LIMIT 1
        `;

        db.query(getOldSql, [facultyUserId], (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to check current profile image."
                });
            }

            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Faculty account not found."
                });

            }

            const oldImage =
                result[0].profile_image;

            const newImagePath =
                `/uploads/profile_images/${req.file.filename}`;

            const updateSql = `
                UPDATE users
                SET profile_image = ?
                WHERE user_id = ?
                AND role IN ('faculty', 'admin')
            `;

            db.query(
                updateSql,
                [
                    newImagePath,
                    facultyUserId
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update profile image."
                        });
                    }

                    if(oldImage){

                        const oldImagePath =
                            path.join(
                                __dirname,
                                oldImage.replace("/uploads", "uploads")
                            );

                        if(fs.existsSync(oldImagePath)){

                            fs.unlinkSync(oldImagePath);

                        }

                    }

                    res.json({
                        success:true,
                        message:"Profile image updated successfully.",
                        profileImage:newImagePath
                    });

                }
            );

        });

    }
);

/* ================= LOAD ADMIN SETTINGS ================= */

app.get("/admin-settings/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const sql = `
        SELECT
            id,
            user_id,
            fullname,
            password,
            role,
            position,
            program,
            adviser_access,
            panelist_access,
            instructor_access,
            profile_image,
            digital_signature
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(sql, [userId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load admin settings."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Admin account not found."
            });

        }

        res.json({
            success:true,
            admin:result[0]
        });

    });

});


/* ================= UPDATE ADMIN PROFILE ================= */

app.put("/update-admin-profile", (req, res) => {

    const {
        adminUserId,
        fullname,
        position,
        program
    } = req.body;

    if(
        !adminUserId ||
        !fullname ||
        !position ||
        !program
    ){
        return res.json({
            success:false,
            message:"Please complete all profile fields."
        });
    }

    const executeUpdate = () => {
        const sql = `
            UPDATE users
            SET
                fullname = ?,
                position = ?,
                program = ?
            WHERE user_id = ?
            AND role = 'admin'
        `;

        db.query(
            sql,
            [
                fullname,
                position,
                program,
                adminUserId
            ],
            (err, result) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to update admin profile."
                    });
                }

                if(result.affectedRows === 0){

                    return res.json({
                        success:false,
                        message:"Admin account not found."
                    });

                }

                res.json({
                    success:true,
                    message:"Admin profile updated successfully."
                });

            }
        );
    };

    if (position === "Dean" || position === "Program Chairperson IS" || position === "Program Chairperson IT") {
        const checkSql = `
            SELECT fullname 
            FROM users 
            WHERE position = ? 
            AND user_id != ? 
            AND role = 'admin'
            LIMIT 1
        `;
        db.query(checkSql, [position, adminUserId], (err, rows) => {
            if (err) {
                console.log(err);
                return res.json({
                    success: false,
                    message: "Database check failed."
                });
            }
            if (rows.length > 0) {
                return res.json({
                    success: false,
                    message: `Position "${position}" is already occupied by admin ${rows[0].fullname}.`
                });
            }
            executeUpdate();
        });
    } else {
        executeUpdate();
    }

});


/* ================= CHANGE ADMIN PASSWORD ================= */

app.put("/change-admin-password", (req, res) => {

    const {
        adminUserId,
        currentPassword,
        newPassword
    } = req.body;

    if(
        !adminUserId ||
        !currentPassword ||
        !newPassword
    ){
        return res.json({
            success:false,
            message:"Please complete all password fields."
        });
    }

    if(newPassword.length < 6){

        return res.json({
            success:false,
            message:"New password must be at least 6 characters."
        });

    }

    const checkSql = `
        SELECT id, password
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(checkSql, [adminUserId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking password."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Admin account not found."
            });

        }

        if(result[0].password !== currentPassword){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const updateSql = `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            AND role = 'admin'
        `;

        db.query(
            updateSql,
            [
                newPassword,
                adminUserId
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to change password."
                    });
                }

                const adminDbId = result[0].id;
                const notifSql = `
                    INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                    VALUES (?, 'Security Update', 'Your password has been changed successfully.', 'System')
                `;
                db.query(notifSql, [adminDbId], (notifErr) => {
                    if (notifErr) console.error("Failed to insert password change notification:", notifErr);
                });

                res.json({
                    success:true,
                    message:"Password changed successfully."
                });

            }
        );

    });

});


/* ================= UPDATE ADMIN PROFILE IMAGE ================= */

app.post(
    "/update-admin-profile-image",
    profileImageUpload.single("profileImage"),
    (req, res) => {

        const {
            adminUserId
        } = req.body;

        if(!adminUserId || !req.file){

            return res.json({
                success:false,
                message:"Please select an image to upload."
            });

        }

        const getOldSql = `
            SELECT profile_image
            FROM users
            WHERE user_id = ?
            AND role = 'admin'
            LIMIT 1
        `;

        db.query(getOldSql, [adminUserId], (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to check current profile image."
                });
            }

            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Admin account not found."
                });

            }

            const oldImage =
                result[0].profile_image;

            const newImagePath =
                `/uploads/profile_images/${req.file.filename}`;

            const updateSql = `
                UPDATE users
                SET profile_image = ?
                WHERE user_id = ?
                AND role = 'admin'
            `;

            db.query(
                updateSql,
                [
                    newImagePath,
                    adminUserId
                ],
                (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to update profile image."
                        });
                    }

                    if(oldImage){

                        const oldImagePath =
                            path.join(
                                __dirname,
                                oldImage.replace("/uploads", "uploads")
                            );

                        if(fs.existsSync(oldImagePath)){

                            fs.unlinkSync(oldImagePath);

                        }

                    }

                    res.json({
                        success:true,
                        message:"Profile image updated successfully.",
                        profileImage:newImagePath
                    });

                }
            );

        });

    }
);


/* ================= TOGGLE ADMIN ROLE ACCESS ================= */

app.put("/toggle-admin-role-access", (req, res) => {

    const {
        adminUserId,
        accessType,
        accessValue
    } = req.body;

    if(
        !adminUserId ||
        !accessType ||
        accessValue === undefined
    ){
        return res.json({
            success:false,
            message:"Missing role access information."
        });
    }

    const allowedColumns = {
        adviser:"adviser_access",
        panelist:"panelist_access",
        instructor:"instructor_access"
    };

    const column =
        allowedColumns[accessType];

    if(!column){

        return res.json({
            success:false,
            message:"Invalid access type."
        });

    }

    const sql = `
        UPDATE users
        SET ${column} = ?
        WHERE user_id = ?
        AND role = 'admin'
    `;

    db.query(
        sql,
        [
            Number(accessValue),
            adminUserId
        ],
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to update role access."
                });
            }

            if(result.affectedRows === 0){

                return res.json({
                    success:false,
                    message:"Admin account not found."
                });

            }

            res.json({
                success:true,
                message:"Role access updated successfully."
            });

        }
    );

});

/* ================= FACULTY CREATE ANNOUNCEMENT ================= */

app.post("/faculty-create-announcement", (req, res) => {

    const {
        facultyUserId,
        announcementTitle,
        announcementType,
        audience,
        targetProgram,
        announcementContent
    } = req.body;

    if(
        !facultyUserId ||
        !announcementTitle ||
        !announcementType ||
        !audience ||
        !announcementContent
    ){
        return res.json({
            success:false,
            message:"Please complete all required announcement fields."
        });
    }

    if(audience !== "Students" && audience !== "Program"){
        return res.json({
            success:false,
            message:"Faculty can only send announcements to students or specific programs."
        });
    }

    if(audience === "Program" && !targetProgram){
        return res.json({
            success:false,
            message:"Please select a target program."
        });
    }

    const facultySql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(facultySql, [facultyUserId], (err, facultyResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking faculty account."
            });
        }

        if(facultyResult.length === 0){
            return res.json({
                success:false,
                message:"Faculty account not found."
            });
        }

        const createdBy =
            facultyResult[0].id;

        const announcementCode =
            "ANN2026-" + Date.now();

        const insertSql = `
            INSERT INTO announcements
            (
                announcement_code,
                created_by,
                announcement_title,
                announcement_type,
                audience,
                target_program,
                announcement_content,
                announcement_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Published')
        `;

        db.query(
            insertSql,
            [
                announcementCode,
                createdBy,
                announcementTitle,
                announcementType,
                audience,
                targetProgram || null,
                announcementContent
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to create announcement."
                    });
                }

                res.json({
                    success:true,
                    message:"Announcement published successfully."
                });

            }
        );

    });

});


/* ================= FACULTY LOAD OWN ANNOUNCEMENTS ================= */

app.get("/faculty-announcements/:facultyUserId", (req, res) => {

    const facultyUserId =
        req.params.facultyUserId;

    const facultySql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(facultySql, [facultyUserId], (err, facultyResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking faculty account."
            });
        }

        if(facultyResult.length === 0){
            return res.json({
                success:false,
                message:"Faculty account not found."
            });
        }

        const facultyDbId =
            facultyResult[0].id;

        const sql = `
            SELECT
                a.id,
                a.announcement_code,
                a.announcement_title,
                a.announcement_type,
                a.audience,
                a.target_program,
                a.announcement_content,
                a.announcement_status,
                a.created_at,
                a.updated_at,

                u.user_id AS created_by_user_id,
                u.fullname AS created_by_name

            FROM announcements a

            JOIN users u
                ON a.created_by = u.id

            WHERE a.created_by = ?

            ORDER BY a.id DESC
        `;

        db.query(sql, [facultyDbId], (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load announcements."
                });
            }

            res.json({
                success:true,
                announcements:result
            });

        });

    });

});


/* ================= FACULTY UPDATE ANNOUNCEMENT ================= */

app.put("/faculty-update-announcement/:announcementId", (req, res) => {

    const announcementId =
        req.params.announcementId;

    const {
        facultyUserId,
        announcementTitle,
        announcementType,
        audience,
        targetProgram,
        announcementContent
    } = req.body;

    if(
        !announcementId ||
        !facultyUserId ||
        !announcementTitle ||
        !announcementType ||
        !audience ||
        !announcementContent
    ){
        return res.json({
            success:false,
            message:"Please complete all required announcement fields."
        });
    }

    if(audience !== "Students" && audience !== "Program"){
        return res.json({
            success:false,
            message:"Faculty can only send announcements to students or specific programs."
        });
    }

    if(audience === "Program" && !targetProgram){
        return res.json({
            success:false,
            message:"Please select a target program."
        });
    }

    const facultySql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(facultySql, [facultyUserId], (err, facultyResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking faculty account."
            });
        }

        if(facultyResult.length === 0){
            return res.json({
                success:false,
                message:"Faculty account not found."
            });
        }

        const facultyDbId =
            facultyResult[0].id;

        const updateSql = `
            UPDATE announcements
            SET
                announcement_title = ?,
                announcement_type = ?,
                audience = ?,
                target_program = ?,
                announcement_content = ?,
                announcement_status = 'Published'
            WHERE id = ?
            AND created_by = ?
        `;

        db.query(
            updateSql,
            [
                announcementTitle,
                announcementType,
                audience,
                targetProgram || null,
                announcementContent,
                announcementId,
                facultyDbId
            ],
            (err, result) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to update announcement."
                    });
                }

                if(result.affectedRows === 0){
                    return res.json({
                        success:false,
                        message:"Announcement not found or you do not have permission to edit it."
                    });
                }

                res.json({
                    success:true,
                    message:"Announcement updated successfully."
                });

            }
        );

    });

});


/* ================= FACULTY DELETE ANNOUNCEMENT ================= */

app.delete("/faculty-delete-announcement/:announcementId", (req, res) => {

    const announcementId =
        req.params.announcementId;

    const {
        facultyUserId
    } = req.body;

    if(!announcementId || !facultyUserId){
        return res.json({
            success:false,
            message:"Missing announcement information."
        });
    }

    const facultySql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(facultySql, [facultyUserId], (err, facultyResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking faculty account."
            });
        }

        if(facultyResult.length === 0){
            return res.json({
                success:false,
                message:"Faculty account not found."
            });
        }

        const facultyDbId =
            facultyResult[0].id;

        const deleteSql = `
            DELETE FROM announcements
            WHERE id = ?
            AND created_by = ?
        `;

        db.query(
            deleteSql,
            [
                announcementId,
                facultyDbId
            ],
            (err, result) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to delete announcement."
                    });
                }

                if(result.affectedRows === 0){
                    return res.json({
                        success:false,
                        message:"Announcement not found or you do not have permission to delete it."
                    });
                }

                res.json({
                    success:true,
                    message:"Announcement deleted successfully."
                });

            }
        );

    });

});

/* ================= LOAD DEFENSE SCHEDULE DATA ================= */

app.get("/defense-schedule-data", (req, res) => {

    const groupsSql = `
        SELECT
            cg.id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,
            GROUP_CONCAT(DISTINCT u.enrolled_by_user_id) AS instructor_ids
        FROM capstone_groups cg
        LEFT JOIN group_members gm ON cg.id = gm.group_id
        LEFT JOIN users u ON gm.student_id = u.id
        GROUP BY cg.id
        ORDER BY cg.group_id ASC
    `;

    const panelistsSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            position,
            program
        FROM users
        WHERE role IN ('faculty', 'admin')
        AND panelist_access = 1
        ORDER BY fullname ASC
    `;

    db.query(groupsSql, (err, groups) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load capstone groups."
            });
        }

        db.query(panelistsSql, (err, panelists) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load panelists."
                });
            }

            res.json({
                success:true,
                groups,
                panelists
            });

        });

    });

});


/* ================= LOAD GROUP MEMBERS FOR DEFENSE ================= */

app.get("/defense-group-members/:groupDbId", (req, res) => {

    const groupDbId =
        req.params.groupDbId;

    const sql = `
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.program,
            u.year_level,
            gm.member_position
        FROM group_members gm

        JOIN users u
            ON gm.student_id = u.id

        WHERE gm.group_id = ?

        ORDER BY
            CASE
                WHEN gm.member_position = 'Project Manager' THEN 1
                ELSE 2
            END,
            u.fullname ASC
    `;

    db.query(sql, [groupDbId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load group members."
            });
        }

        res.json({
            success:true,
            members:result
        });

    });

});


/* ================= LOAD DEFENSE SCHEDULES ================= */

app.get("/defense-schedules", (req, res) => {

    const loggedInUserId =
        req.query.userId || "";

    const schedulesSql = `
        SELECT
            ds.id,
            ds.schedule_code,
            ds.group_id AS group_db_id,
            ds.panelist_id,
            ds.created_by,
            ds.room_name,
            ds.defense_date,
            ds.start_time,
            ds.end_time,
            ds.defense_type,
            ds.defense_status,
            ds.score,
            ds.panel_result,
            ds.comments,
            ds.recommendations,
            ds.approved_title_id,
            ds.concept_evaluation_details,
            ds.outline_evaluation_details,
            ds.notes,
            ds.created_at,
            ds.updated_at,

            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program,

            creator.user_id AS creator_user_id,
            creator.user_id AS created_by_user_id,
            creator.fullname AS creator_name,

            CASE
                WHEN creator.user_id = ? THEN 1
                ELSE 0
            END AS is_owner

        FROM defense_schedules ds

        JOIN capstone_groups cg
            ON ds.group_id = cg.id

        JOIN users creator
            ON ds.created_by = creator.id

        ORDER BY ds.defense_date DESC, ds.start_time DESC
    `;

    db.query(schedulesSql, [loggedInUserId], (err, schedules) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load defense schedules."
            });
        }

        const membersSql = `
            SELECT
                gm.group_id,
                u.id,
                u.user_id,
                u.fullname,
                gm.member_position,
                u.profile_image
            FROM group_members gm

            JOIN users u
                ON gm.student_id = u.id

            ORDER BY u.fullname ASC
        `;

        db.query(membersSql, (err, members) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load schedule members."
                });
            }

            const panelistsSql = `
                SELECT
                    dsp.schedule_id,
                    u.id,
                    u.user_id,
                    u.fullname,
                    u.position,
                    u.role,
                    u.profile_image
                FROM defense_schedule_panelists dsp

                JOIN users u
                    ON dsp.panelist_id = u.id

                ORDER BY u.fullname ASC
            `;

            db.query(panelistsSql, (err, panelists) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load schedule panelists."
                    });
                }

                const scheduleIds =
                    (schedules || []).map(schedule => schedule.id);

                const finishScheduleList = (evaluationCounts) => {

                    const scheduleList =
                        schedules.map(schedule => {

                            const schedulePanelists =
                                panelists.filter(panelistItem =>
                                    Number(panelistItem.schedule_id)
                                    === Number(schedule.id)
                                );

                            const evaluationsRequired =
                                schedulePanelists.length;

                            const countRow =
                                (evaluationCounts || []).find(row =>
                                    Number(row.schedule_id)
                                    === Number(schedule.id)
                                );

                            const evaluationsSubmitted =
                                Number(countRow?.evaluation_count || 0);

                            const evaluationsComplete =
                                evaluationsRequired > 0
                                && evaluationsSubmitted >= evaluationsRequired;

                            return {
                                ...schedule,

                                is_owner:
                                    Number(schedule.is_owner) === 1,

                                members:members.filter(member =>
                                    Number(member.group_id)
                                    === Number(schedule.group_db_id)
                                ),

                                panelists:schedulePanelists,

                                evaluations_required:evaluationsRequired,

                                evaluations_submitted:evaluationsSubmitted,

                                evaluations_complete:evaluationsComplete,

                                evaluation:evaluationsSubmitted > 0
                                    ? {
                                        score:schedule.score,
                                        panel_result:schedule.panel_result,
                                        comments:schedule.comments,
                                        recommendations:schedule.recommendations,
                                        approved_title_id:schedule.approved_title_id,
                                        concept_evaluation_details:
                                            schedule.concept_evaluation_details,
                                        outline_evaluation_details:
                                            schedule.outline_evaluation_details
                                    }
                                    : null
                            };

                        });

                    res.json({
                        success:true,
                        schedules:scheduleList
                    });

                };

                if(scheduleIds.length === 0){

                    return finishScheduleList([]);

                }

                const evaluationCountsSql = `
                    SELECT
                        schedule_id,
                        COUNT(*) AS evaluation_count
                    FROM defense_panel_evaluations
                    WHERE schedule_id IN (?)
                    GROUP BY schedule_id
                `;

                db.query(
                    evaluationCountsSql,
                    [scheduleIds],
                    (countErr, evaluationCounts) => {

                        if(countErr){
                            console.log(countErr);

                            return res.json({
                                success:false,
                                message:"Failed to load panel evaluation counts."
                            });
                        }

                        finishScheduleList(evaluationCounts);

                    }
                );

            });

        });

    });

});


/* ================= UPDATE DEFENSE SCHEDULE - OWNER ONLY ================= */

app.put("/update-defense-schedule/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    const {
        instructorUserId,
        groupDbId,
        panelistIds,
        roomName,
        defenseDate,
        startTime,
        endTime,
        defenseType,
        defenseStatus,
        notes
    } = req.body;

    if(
        !scheduleId ||
        !instructorUserId ||
        !groupDbId ||
        !panelistIds ||
        panelistIds.length === 0 ||
        !roomName ||
        !defenseDate ||
        !startTime ||
        !endTime ||
        !defenseStatus
    ){
        return res.json({
            success:false,
            message:"Please complete all required schedule fields and select at least one panelist."
        });
    }

    const instructorSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking instructor account."
            });
        }

        if(instructorResult.length === 0){
            return res.json({
                success:false,
                message:"Instructor account not found or no instructor access."
            });
        }

        const instructorDbId =
            instructorResult[0].id;

        const ownerCheckSql = `
            SELECT id
            FROM defense_schedules
            WHERE id = ?
            AND created_by = ?
            LIMIT 1
        `;

        db.query(
            ownerCheckSql,
            [
                scheduleId,
                instructorDbId
            ],
            (err, ownerResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Database error while checking schedule ownership."
                    });
                }

                if(ownerResult.length === 0){

                    return res.json({
                        success:false,
                        message:"You can only update defense schedules that you created."
                    });

                }

                const conflictSql = `
                    SELECT id
                    FROM defense_schedules
                    WHERE defense_date = ?
                    AND room_name = ?
                    AND id != ?
                    AND (
                        (? < end_time AND ? > start_time)
                    )
                    LIMIT 1
                `;

                db.query(
                    conflictSql,
                    [
                        defenseDate,
                        roomName,
                        scheduleId,
                        startTime,
                        endTime
                    ],
                    (err, conflictResult) => {

                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Database error while checking room conflict."
                            });
                        }

                        if(conflictResult.length > 0){

                            return res.json({
                                success:false,
                                message:"This room is already scheduled during the selected time."
                            });

                        }

                        const panelistSql = `
                            SELECT id
                            FROM users
                            WHERE id IN (?)
                            AND role IN ('faculty', 'admin')
                            AND panelist_access = 1
                        `;

                        db.query(panelistSql, [panelistIds], (err, panelistResult) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Database error while checking panelists."
                                });
                            }

                            if(panelistResult.length !== panelistIds.length){

                                return res.json({
                                    success:false,
                                    message:"One or more selected panelists are invalid."
                                });

                            }

                            const primaryPanelistId =
                                panelistIds[0];

                            const updateSql = `
                                UPDATE defense_schedules
                                SET
                                    group_id = ?,
                                    panelist_id = ?,
                                    room_name = ?,
                                    defense_date = ?,
                                    start_time = ?,
                                    end_time = ?,
                                    defense_type = ?,
                                    defense_status = ?,
                                    notes = ?
                                WHERE id = ?
                                AND created_by = ?
                            `;

                            db.query(
                                updateSql,
                                [
                                    groupDbId,
                                    primaryPanelistId,
                                    roomName,
                                    defenseDate,
                                    startTime,
                                    endTime,
                                    defenseType || "Capstone Defense",
                                    defenseStatus,
                                    notes || "",
                                    scheduleId,
                                    instructorDbId
                                ],
                                (err, result) => {

                                    if(err){
                                        console.log(err);

                                        return res.json({
                                            success:false,
                                            message:"Failed to update defense schedule."
                                        });
                                    }

                                    if(result.affectedRows === 0){

                                        return res.json({
                                            success:false,
                                            message:"No defense schedule was updated."
                                        });

                                    }

                                    const deleteOldPanelistsSql = `
                                        DELETE FROM defense_schedule_panelists
                                        WHERE schedule_id = ?
                                    `;

                                    db.query(deleteOldPanelistsSql, [scheduleId], (err) => {

                                        if(err){
                                            console.log(err);

                                            return res.json({
                                                success:false,
                                                message:"Schedule updated, but failed to reset panelists."
                                            });
                                        }

                                        const panelistValues =
                                            panelistIds.map(panelistId => [
                                                scheduleId,
                                                panelistId
                                            ]);

                                        const insertPanelistsSql = `
                                            INSERT INTO defense_schedule_panelists
                                            (
                                                schedule_id,
                                                panelist_id
                                            )
                                            VALUES ?
                                        `;

                                        db.query(insertPanelistsSql, [panelistValues], (err) => {

                                            if(err){
                                                console.log(err);

                                                return res.json({
                                                    success:false,
                                                    message:"Schedule updated, but failed to save panelists."
                                                });
                                            }

                                            notifyDefenseUsersWithDetails(
                                                groupDbId,
                                                panelistIds,
                                                "Defense Schedule Updated",
                                                "updated",
                                                defenseDate,
                                                startTime,
                                                endTime,
                                                roomName
                                            );

                                            if (defenseStatus === 'Completed') {
                                                const membersSql = `
                                                    SELECT student_id
                                                    FROM group_members
                                                    WHERE group_id = ?
                                                `;
                                                db.query(membersSql, [groupDbId], (memberErr, memberRows) => {
                                                    if (!memberErr && memberRows) {
                                                        insertUserNotificationsByDbIds(
                                                            memberRows.map(row => row.student_id),
                                                            "Defense Completed",
                                                            `Your ${defenseType || "defense"} has been marked as Completed.`,
                                                            "Defense Evaluation"
                                                        );
                                                    }
                                                });
                                            }

                                            res.json({
                                                success:true,
                                                message:"Defense schedule updated successfully."
                                            });

                                        });

                                    });

                                }
                            );

                        });

                    }
                );

            }
        );

    });

});


/* ================= DELETE DEFENSE SCHEDULE - OWNER ONLY ================= */

app.delete("/delete-defense-schedule/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    const {
        instructorUserId
    } = req.body;

    if(!scheduleId || !instructorUserId){

        return res.json({
            success:false,
            message:"Missing schedule information."
        });

    }

    const instructorSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking instructor account."
            });
        }

        if(instructorResult.length === 0){

            return res.json({
                success:false,
                message:"Instructor account not found or no instructor access."
            });

        }

        const instructorDbId =
            instructorResult[0].id;

        const scheduleSql = `
            SELECT
                id,
                group_id,
                defense_date,
                start_time,
                end_time,
                room_name
            FROM defense_schedules
            WHERE id = ?
            AND created_by = ?
            LIMIT 1
        `;

        db.query(
            scheduleSql,
            [
                scheduleId,
                instructorDbId
            ],
            (err, scheduleResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Database error while checking schedule."
                    });
                }

                if(scheduleResult.length === 0){

                    return res.json({
                        success:false,
                        message:"You can only delete defense schedules that you created."
                    });

                }

                const schedule =
                    scheduleResult[0];

                const panelistsSql = `
                    SELECT panelist_id
                    FROM defense_schedule_panelists
                    WHERE schedule_id = ?
                `;

                db.query(panelistsSql, [scheduleId], (err, panelistResult) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Database error while checking schedule panelists."
                        });
                    }

                    const panelistIds =
                        panelistResult.map(item =>
                            item.panelist_id
                        );

                    const deleteSql = `
                        DELETE FROM defense_schedules
                        WHERE id = ?
                        AND created_by = ?
                    `;

                    db.query(
                        deleteSql,
                        [
                            scheduleId,
                            instructorDbId
                        ],
                        (err, result) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to delete defense schedule."
                                });
                            }

                            if(result.affectedRows === 0){

                                return res.json({
                                    success:false,
                                    message:"No defense schedule was deleted."
                                });

                            }

                            notifyDefenseUsersWithDetails(
                                schedule.group_id,
                                panelistIds,
                                "Defense Schedule Deleted",
                                "deleted",
                                schedule.defense_date,
                                schedule.start_time,
                                schedule.end_time,
                                schedule.room_name
                            );

                            res.json({
                                success:true,
                                message:"Defense schedule deleted successfully."
                            });

                        }
                    );

                });

            }
        );

    });

});


/* ================= UPDATE ENVIRONMENTAL SCANNING STATUS & DECLINE REASON ================= */

app.post("/update-environmental-scanning-status", (req, res) => {
    const { studentUserId, documentId, reasonCategory, reasonText, newStatus } = req.body;

    if (!studentUserId || !documentId || !reasonCategory) {
        return res.json({
            success: false,
            message: "Missing required fields (studentUserId, documentId, reasonCategory)."
        });
    }

    const findStudentSql = `
        SELECT u.id, u.user_id, u.fullname, u.program,
               COALESCE(u.group_id, gm.group_id) AS group_id,
               cg.group_name, cg.instructor_id
        FROM users u
        LEFT JOIN group_members gm ON u.id = gm.student_id
        LEFT JOIN capstone_groups cg ON COALESCE(u.group_id, gm.group_id) = cg.id
        WHERE u.user_id = ? OR u.id = ?
        LIMIT 1
    `;

    db.query(findStudentSql, [studentUserId, studentUserId], (errStudent, studentRows) => {
        if (errStudent || !studentRows || studentRows.length === 0) {
            return res.json({
                success: false,
                message: "Student user not found."
            });
        }

        const student = studentRows[0];
        const studentDbId = student.id;
        const groupDbId = student.group_id;
        const studentName = student.fullname || student.user_id || "Student";
        const groupName = student.group_name || `Group ${groupDbId || ''}`;
        const instructorDbId = student.instructor_id;

        const findDocSql = `
            SELECT id, document_type, document_title, group_id
            FROM student_documents
            WHERE id = ?
            LIMIT 1
        `;

        db.query(findDocSql, [documentId], (errDoc, docRows) => {
            if (errDoc || !docRows || docRows.length === 0) {
                return res.json({
                    success: false,
                    message: "Environmental scanning document not found."
                });
            }

            const doc = docRows[0];
            const docTitle = doc.document_title || doc.document_type || "Environmental Scanning";
            const fullReason = reasonCategory + (reasonText && reasonText.trim() ? ` - ${reasonText.trim()}` : "");
            const statusToSet = newStatus || "Declined by Organization";

            const updateDocSql = `
                UPDATE student_documents
                SET document_status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.query(updateDocSql, [statusToSet, documentId], (errUpdate) => {
                if (errUpdate) {
                    console.log("Failed to update environmental scanning status:", errUpdate);
                    return res.json({
                        success: false,
                        message: "Failed to update environmental scanning status in database."
                    });
                }

                const updateSubmissionsSql = `
                    UPDATE document_submissions
                    SET review_status = ?,
                        review_comment = ?,
                        reviewed_at = NOW()
                    WHERE document_id = ?
                `;
                db.query(updateSubmissionsSql, [statusToSet, `Declined by Organization: ${fullReason}`, documentId], () => {});

                const prog = String(student.program || "").toUpperCase();
                let chairPosition = 'Program Chairperson IT';
                if (prog.includes("IS")) {
                    chairPosition = 'Program Chairperson IS';
                }

                const findRecipientsSql = `
                    SELECT id, role, position FROM users
                    WHERE (id = ?)
                       OR (role = 'admin' AND position = ?)
                       OR (position = 'Dean')
                       OR (role = 'admin' AND position LIKE 'Program Chairperson%')
                `;

                db.query(findRecipientsSql, [instructorDbId || 0, chairPosition], (errRecip, recipientRows) => {
                    const notifyUserIds = new Set();
                    if (recipientRows && recipientRows.length > 0) {
                        recipientRows.forEach(r => notifyUserIds.add(r.id));
                    }

                    if (notifyUserIds.size === 0) {
                        return res.json({
                            success: true,
                            message: "Status updated successfully."
                        });
                    }

                    const notifyTitle = "Environmental Scanning Declined by Organization";
                    const notifyMessage = `${groupName} (${studentName}) updated status for ${docTitle}: The organization declined the proposed system. Reason: ${fullReason}`;

                    const notificationValues = Array.from(notifyUserIds).map(uid => [
                        uid,
                        notifyTitle,
                        notifyMessage,
                        "Document Review"
                    ]);

                    const insertNotifSql = `
                        INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                        VALUES ?
                    `;

                    db.query(insertNotifSql, [notificationValues], (errNotif) => {
                        if (errNotif) {
                            console.log("Error sending decline notifications:", errNotif);
                        }

                        res.json({
                            success: true,
                            message: "Environmental scanning status updated and rationale sent to Instructor, Chairperson, and Dean."
                        });
                    });
                });
            });
        });
    });
});


/* ================= CONSULTATION DOCUMENT GATES ================= */

const CONSULTATION_CATALOG = [
    {
        category:"Concept Presentation",
        items:[
            { label:"Proposed concept paper", slots:3 },
            { label:"Adviser acceptance for advisory", slots:1 },
            { label:"Environmental scanning", slots:3 },
            { label:"Recommendation for concept presentation", slots:1 }
        ]
    },
    {
        category:"Outline Defense",
        items:[
            { label:"Chapter 1 and 2", slots:1 },
            { label:"Recommendation for outline defense", slots:1 },
            { label:"Outline defense evaluation sheet", slots:1 },
            { label:"Defense minutes", slots:1 }
        ]
    },
    {
        category:"Pre-Final Defense",
        items:[
            { label:"Chapter 3-4", slots:1 },
            { label:"Defense minutes", slots:1 }
        ]
    },
    {
        category:"Final Defense",
        items:[
            { label:"Chapter 3-4", slots:1 },
            { label:"Defense minutes", slots:1 }
        ]
    }
];

function buildConsultationSlotDocumentType(category, baseLabel, slotIndex, totalSlots){

    if(totalSlots > 1){
        return `${category} • ${baseLabel} (${slotIndex})`;
    }

    return `${category} • ${baseLabel}`;

}

function getConsultationSlotTypeCandidates(category, baseLabel, slotIndex, totalSlots){

    const candidates = [
        buildConsultationSlotDocumentType(
            category,
            baseLabel,
            slotIndex,
            totalSlots
        )
    ];

    if(slotIndex === 1 && totalSlots > 1){
        candidates.push(
            `${category} • ${baseLabel} (${totalSlots})`
        );
    }

    if(totalSlots === 1){
        candidates.push(`${category} • ${baseLabel}`);
    }

    return candidates;

}

function isDefenseMinutesCatalogItem(label, documentType){

    const labelValue =
        String(label || "").trim().toLowerCase();

    const typeValue =
        String(documentType || "").trim().toLowerCase();

    return labelValue === "defense minutes"
        || labelValue.endsWith("defense minutes")
        || typeValue.includes("defense minutes");

}

function getConsultationPhaseCategoryForDefenseType(defenseType){

    const value =
        String(defenseType || "").toLowerCase().trim();

    if(value.includes("pre-final") || value.includes("prefinal")){
        return "Pre-Final Defense";
    }

    if(value.includes("outline")){
        return "Outline Defense";
    }

    if(value.includes("final") && !value.includes("pre")){
        return "Final Defense";
    }

    return "Concept Presentation";

}

function defenseTypesMatch(storedType, expectedType){

    const stored =
        String(storedType || "").toLowerCase().trim();

    const expected =
        String(expectedType || "").toLowerCase().trim();

    if(!stored || !expected){
        return false;
    }

    if(stored === expected){
        return true;
    }

    const storedCategory =
        getConsultationPhaseCategoryForDefenseType(storedType);

    const expectedCategory =
        getConsultationPhaseCategoryForDefenseType(expectedType);

    return storedCategory === expectedCategory;

}

function formatConsultationDocumentLabel(documentType){

    const parts =
        String(documentType || "")
        .split(" • ")
        .map(part => part.trim())
        .filter(Boolean);

    if(parts.length > 1){
        return parts.slice(1).join(" • ");
    }

    return String(documentType || "Document");

}

function documentMatchesDefenseScheduleType(documentType, defenseType){

    const phaseCategory =
        getConsultationPhaseCategoryForDefenseType(defenseType);

    const normalizedType =
        String(documentType || "").trim();

    return normalizedType.startsWith(`${phaseCategory} •`);

}

function normalizeTitleProposalRow(row){

    return {
        id:row.id,
        group_id:row.group_id,
        title_number:row.title_number,
        title:row.proposed_title,
        proposed_title:row.proposed_title,
        summary:"",
        file_name:row.file_name,
        file_path:row.file_path,
        status:row.status,
        created_at:row.created_at
    };

}

function getCatalogPhasesForScheduleCheck(defenseType, requireAllPhases){

    if(requireAllPhases){
        return CONSULTATION_CATALOG;
    }

    const targetCategory =
        getConsultationPhaseCategoryForDefenseType(defenseType);

    const phase =
        CONSULTATION_CATALOG.find(item =>
            item.category === targetCategory
        );

    return phase
        ? [phase]
        : [CONSULTATION_CATALOG[0]];

}

function findDocumentForConsultationSlot(documents, category, baseLabel, slotIndex, totalSlots){

    const candidates =
        getConsultationSlotTypeCandidates(
            category,
            baseLabel,
            slotIndex,
            totalSlots
        );

    for(const docType of candidates){

        const matches =
            (documents || []).filter(doc =>
                String(doc.document_type || "") === docType
            );

        if(matches.length > 0){

            return matches.sort((a, b) =>
                Number(b.id) - Number(a.id)
            )[0];

        }

    }

    return null;

}

function buildPhaseApprovalSummary(documents, phase, options){

    const excludeDefenseMinutes =
        options && options.excludeDefenseMinutesFromSchedule;

    const missing = [];
    let approvedCount = 0;
    let requiredSlots = 0;

    (phase.items || []).forEach(item => {

        for(let slotIndex = 1; slotIndex <= item.slots; slotIndex++){

            const documentType =
                buildConsultationSlotDocumentType(
                    phase.category,
                    item.label,
                    slotIndex,
                    item.slots
                );

            if(
                excludeDefenseMinutes
                && isDefenseMinutesCatalogItem(item.label, documentType)
            ){
                continue;
            }

            requiredSlots++;

            const documentRecord =
                findDocumentForConsultationSlot(
                    documents,
                    phase.category,
                    item.label,
                    slotIndex,
                    item.slots
                );

            const slotLabel =
                item.slots > 1
                ? `${item.label} (${slotIndex})`
                : item.label;

            if(
                documentRecord
                && String(documentRecord.document_status || "") === "Approved"
            ){

                approvedCount++;

            }else{

                missing.push({
                    phase:phase.category,
                    label:slotLabel,
                    status:documentRecord
                        ? String(documentRecord.document_status || "Pending")
                        : "Not uploaded",
                    document_type:documentType
                });

            }

        }

    });

    return {
        category:phase.category,
        missing,
        approved_count:approvedCount,
        total_slots:requiredSlots,
        complete:missing.length === 0
    };

}

function buildMissingApprovedForDefenseSchedule(documents, defenseType, options){

    const phases =
        getCatalogPhasesForScheduleCheck(
            defenseType,
            options && options.requireAllPhases
        );

    const summaries =
        phases.map(phase =>
            buildPhaseApprovalSummary(documents, phase, options)
        );

    const missing =
        summaries.flatMap(phase => phase.missing);

    return {
        summaries,
        missing
    };

}

function fetchGroupStudentDocuments(groupDbId, callback){

    const sql = `
        SELECT
            sd.id,
            sd.document_code,
            sd.document_type,
            sd.document_title,
            sd.file_name,
            sd.file_path,
            sd.file_format,
            sd.document_status,
            sd.is_sent,
            sd.created_at,
            sd.signed_file_path
        FROM student_documents sd
        WHERE sd.group_id = ?
        ORDER BY sd.id DESC
    `;

    db.query(sql, [groupDbId], callback);

}

function getPriorDefenseTypeForSchedule(defenseType){

    const value =
        String(defenseType || "").toLowerCase().trim();

    if(value.includes("pre-final") || value.includes("prefinal")){
        return "Outline Defense";
    }

    if(value.includes("outline")){
        return "Concept Presentation";
    }

    if(value.includes("final") && !value.includes("pre")){
        return "Pre-Final Defense";
    }

    return null;

}

function fetchPriorDefensePanelEvaluationStatus(groupDbId, defenseType, callback){

    const priorDefenseType =
        getPriorDefenseTypeForSchedule(defenseType);

    if(!priorDefenseType){

        return callback(null, {
            ok:true,
            prior_defense_type:null
        });

    }

    const schedulesSql = `
        SELECT
            ds.id,
            ds.defense_type,
            ds.defense_status
        FROM defense_schedules ds
        WHERE ds.group_id = ?
        AND ds.defense_status != 'Cancelled'
        ORDER BY ds.defense_date DESC, ds.id DESC
    `;

    db.query(schedulesSql, [groupDbId], (scheduleErr, scheduleRows) => {

        if(scheduleErr){
            return callback(scheduleErr);
        }

        const priorSchedule =
            (scheduleRows || []).find(row =>
                defenseTypesMatch(row.defense_type, priorDefenseType)
            );

        if(!priorSchedule){

            return callback(null, {
                ok:false,
                prior_defense_type:priorDefenseType,
                evaluations_submitted:0,
                evaluations_required:0,
                message:`No ${priorDefenseType} schedule found. Complete that defense before scheduling ${defenseType}.`
            });

        }

        const panelistsSql = `
            SELECT COUNT(*) AS panelist_count
            FROM defense_schedule_panelists
            WHERE schedule_id = ?
        `;

        db.query(
            panelistsSql,
            [priorSchedule.id],
            (panelistErr, panelistRows) => {

                if(panelistErr){
                    return callback(panelistErr);
                }

                const evaluationsRequired =
                    Number(panelistRows[0]?.panelist_count || 0);

                const evaluationsSql = `
                    SELECT COUNT(*) AS evaluation_count
                    FROM defense_panel_evaluations
                    WHERE schedule_id = ?
                `;

                db.query(
                    evaluationsSql,
                    [priorSchedule.id],
                    (evaluationErr, evaluationRows) => {

                        if(evaluationErr){
                            return callback(evaluationErr);
                        }

                        const evaluationsSubmitted =
                            Number(evaluationRows[0]?.evaluation_count || 0);

                        const ok =
                            evaluationsRequired > 0
                            && evaluationsSubmitted >= evaluationsRequired;

                        callback(null, {
                            ok,
                            prior_defense_type:priorDefenseType,
                            evaluations_submitted:evaluationsSubmitted,
                            evaluations_required:evaluationsRequired,
                            message:ok
                                ? null
                                : `${priorDefenseType} panel evaluations are incomplete (${evaluationsSubmitted}/${evaluationsRequired}). All panelists must submit grades before scheduling ${defenseType}.`
                        });

                    }
                );

            }
        );

    });

}

function validateGroupDocumentsForScheduleCreate(groupDbId, defenseType, options, callback){

    fetchGroupStudentDocuments(groupDbId, (docErr, documents) => {

        if(docErr){
            return callback(docErr);
        }

        const scheduleOptions = {
            excludeDefenseMinutesFromSchedule:true,
            requireAllPhases:
                options && options.requireAllPhases
        };

        const approvalResult =
            buildMissingApprovedForDefenseSchedule(
                documents || [],
                defenseType,
                scheduleOptions
            );

        callback(null, {
            documents:documents || [],
            summaries:approvalResult.summaries,
            missing:approvalResult.missing,
            documents_ready_for_schedule:
                approvalResult.missing.length === 0
        });

    });

}

function validateGroupReadyForScheduleCreate(groupDbId, defenseType, options, callback){

    const excludeScheduleId = options && options.excludeScheduleId ? Number(options.excludeScheduleId) : null;

    // First fetch all non-cancelled schedules for this group to check status and outcomes
    const schedulesSql = `
        SELECT id, defense_type, defense_status, panel_result
        FROM defense_schedules
        WHERE group_id = ?
        AND defense_status != 'Cancelled'
        ORDER BY defense_date DESC, id DESC
    `;

    db.query(schedulesSql, [groupDbId], (schedulesErr, scheduleRows) => {
        if(schedulesErr){
            return callback(schedulesErr);
        }

        const rows = scheduleRows || [];

        // 1. Check for ongoing/pending schedules (Scheduled or Ongoing)
        const ongoingSchedule = rows.find(row => 
            (row.defense_status === 'Scheduled' || row.defense_status === 'Ongoing') &&
            (!excludeScheduleId || Number(row.id) !== excludeScheduleId)
        );

        if(ongoingSchedule){
            return callback(null, {
                documents: [],
                summaries: [],
                missing: [],
                documents_ready_for_schedule: false,
                prior_panel_evaluations: null,
                ready_for_schedule: false,
                message: `Cannot create defense schedule. This group already has an ongoing or pending defense schedule (${ongoingSchedule.defense_type} - ${ongoingSchedule.defense_status}).`
            });
        }

        // 2. Check if already passed or passed with revisions in this particular presentation type
        const completedPassedSchedule = rows.find(row =>
            row.defense_status === 'Completed' &&
            defenseTypesMatch(row.defense_type, defenseType) &&
            (row.panel_result === 'Passed' || row.panel_result === 'Passed with Revisions')
        );

        if(completedPassedSchedule){
            return callback(null, {
                documents: [],
                summaries: [],
                missing: [],
                documents_ready_for_schedule: false,
                prior_panel_evaluations: null,
                ready_for_schedule: false,
                already_passed: true,
                message: `Cannot create defense schedule. This group has already completed and passed the "${defenseType}" (Result: ${completedPassedSchedule.panel_result}).`
            });
        }

        validateGroupDocumentsForScheduleCreate(
            groupDbId,
            defenseType,
            options,
            (docErr, documentResult) => {

                if(docErr){
                    return callback(docErr);
                }

                fetchPriorDefensePanelEvaluationStatus(
                    groupDbId,
                    defenseType,
                    (panelErr, priorPanel) => {

                        if(panelErr){
                            return callback(panelErr);
                        }

                        const documentsReady =
                            documentResult.documents_ready_for_schedule;

                        const panelReady =
                            !priorPanel
                            || priorPanel.ok !== false;

                        const readyForSchedule =
                            documentsReady
                            && panelReady;

                        let message =
                            "This group is ready for scheduling.";

                        if(!documentsReady){

                            message =
                                `Cannot create defense schedule. All required consultation documents for "${defenseType}" must be approved first.`;

                        }else if(!panelReady){

                            message =
                                priorPanel.message
                                || "Prior defense panel evaluations are incomplete.";

                            // If not all panelists graded, ensure readyForSchedule is false
                        }

                        callback(null, {
                            ...documentResult,
                            prior_panel_evaluations:priorPanel,
                            ready_for_schedule:readyForSchedule,
                            message
                        });

                    }
                );

            }
        );
    });

}

app.get("/group-documents/:groupDbId", (req, res) => {

    const groupDbId =
        req.params.groupDbId;

    if(!groupDbId){

        return res.json({
            success:false,
            message:"Missing group."
        });

    }

    fetchGroupStudentDocuments(groupDbId, (err, documents) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to load group documents."
            });
        }

        res.json({
            success:true,
            documents:documents || []
        });

    });

});

app.get("/group-consultation-approval-status/:groupDbId", (req, res) => {

    const groupDbId =
        req.params.groupDbId;

    const defenseType =
        req.query.defenseType || "";

    const requireAllPhases =
        req.query.requireAllPhases === "1"
        || req.query.requireAllPhases === "true";

    if(!groupDbId){

        return res.json({
            success:false,
            message:"Missing group."
        });

    }

    validateGroupReadyForScheduleCreate(
        groupDbId,
        defenseType,
        { requireAllPhases },
        (err, result) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to verify group document approvals."
                });
            }

            res.json({
                success:true,
                ready_for_schedule:result.ready_for_schedule,
                already_passed:result.already_passed || false,
                documents_ready_for_schedule:result.documents_ready_for_schedule,
                message:result.message,
                missing_for_schedule:result.missing || [],
                required_phase_summaries:result.summaries || [],
                prior_panel_evaluations:result.prior_panel_evaluations || null
            });

        }
    );

});


/* ================= CREATE DEFENSE SCHEDULE ================= */

app.post("/create-defense-schedule", (req, res) => {

    const {
        instructorUserId,
        groupDbId,
        panelistIds,
        roomName,
        defenseDate,
        startTime,
        endTime,
        defenseType,
        notes
    } = req.body;

    if(
        !instructorUserId ||
        !groupDbId ||
        !panelistIds ||
        panelistIds.length === 0 ||
        !roomName ||
        !defenseDate ||
        !startTime ||
        !endTime
    ){
        return res.json({
            success:false,
            message:"Please complete all required schedule fields and select at least one panelist."
        });
    }

    validateGroupReadyForScheduleCreate(
        groupDbId,
        defenseType || "Concept Presentation",
        { requireAllPhases:false },
        (validationErr, validationResult) => {

            if(validationErr){
                console.log(validationErr);

                return res.json({
                    success:false,
                    message:"Could not verify group document approvals. Please try again."
                });
            }

            if(!validationResult.ready_for_schedule){

                return res.json({
                    success:false,
                    message:validationResult.message
                        || "This group is not ready for scheduling yet.",
                    missing_documents:validationResult.missing || [],
                    prior_panel_evaluations:validationResult.prior_panel_evaluations || null
                });

            }

            const groupInstructorSql = `
                SELECT u.enrolled_by_user_id
                FROM group_members gm
                JOIN users u ON gm.student_id = u.id
                WHERE gm.group_id = ?
            `;
            db.query(groupInstructorSql, [groupDbId], (groupInsErr, groupInsResult) => {
                if (groupInsErr) {
                    console.log(groupInsErr);
                    return res.json({
                        success: false,
                        message: "Database error while validating group instructor."
                    });
                }

                const instructorIds = (groupInsResult || []).map(r => r.enrolled_by_user_id);
                if (!instructorIds.includes(instructorUserId)) {
                    return res.json({
                        success: false,
                        message: "You cannot create a defense schedule for this group because you are not their instructor."
                    });
                }

                const instructorSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking instructor account."
            });
        }

        if(instructorResult.length === 0){
            return res.json({
                success:false,
                message:"Instructor account not found or no instructor access."
            });
        }

        const createdBy =
            instructorResult[0].id;

        const panelistSql = `
            SELECT id
            FROM users
            WHERE id IN (?)
            AND role IN ('faculty', 'admin')
            AND panelist_access = 1
        `;

        db.query(panelistSql, [panelistIds], (err, panelistResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking panelists."
                });
            }

            if(panelistResult.length !== panelistIds.length){
                return res.json({
                    success:false,
                    message:"One or more selected panelists are invalid."
                });
            }

            const conflictSql = `
                SELECT id
                FROM defense_schedules
                WHERE defense_date = ?
                AND room_name = ?
                AND (
                    (? < end_time AND ? > start_time)
                )
                LIMIT 1
            `;

            db.query(
                conflictSql,
                [
                    defenseDate,
                    roomName,
                    startTime,
                    endTime
                ],
                (err, conflictResult) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Database error while checking room conflict."
                        });
                    }

                    if(conflictResult.length > 0){
                        return res.json({
                            success:false,
                            message:"This room is already scheduled during the selected time."
                        });
                    }

                    const scheduleCode =
                        "DEF2026-" + Date.now();

                    const primaryPanelistId =
                        panelistIds[0];

                    const insertScheduleSql = `
                        INSERT INTO defense_schedules
                        (
                            schedule_code,
                            group_id,
                            panelist_id,
                            created_by,
                            room_name,
                            defense_date,
                            start_time,
                            end_time,
                            defense_type,
                            notes
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertScheduleSql,
                        [
                            scheduleCode,
                            groupDbId,
                            primaryPanelistId,
                            createdBy,
                            roomName,
                            defenseDate,
                            startTime,
                            endTime,
                            defenseType || "Capstone Defense",
                            notes || ""
                        ],
                        (err, insertResult) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to create defense schedule."
                                });
                            }

                            const scheduleId =
                                insertResult.insertId;

                            const panelistValues =
                                panelistIds.map(panelistId => [
                                    scheduleId,
                                    panelistId
                                ]);

                            const insertPanelistsSql = `
                                INSERT INTO defense_schedule_panelists
                                (
                                    schedule_id,
                                    panelist_id
                                )
                                VALUES ?
                            `;

                            db.query(insertPanelistsSql, [panelistValues], (err) => {

                                if(err){
                                    console.log(err);

                                    return res.json({
                                        success:false,
                                        message:"Schedule created, but failed to save panelists."
                                    });
                                }

                                notifyDefenseUsersWithDetails(
                                    groupDbId,
                                    panelistIds,
                                    "Defense Schedule Created",
                                    "created",
                                    defenseDate,
                                    startTime,
                                    endTime,
                                    roomName
                                );

                                res.json({
                                    success:true,
                                    message:"Defense schedule created successfully."
                                });

                            });

                        }
                    );

                }
            );

        });

    });

            });

        }
    );

});


/* ================= UPDATE DEFENSE SCHEDULE ================= */

app.put("/update-defense-schedule/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    const {
        instructorUserId,
        groupDbId,
        panelistIds,
        roomName,
        defenseDate,
        startTime,
        endTime,
        defenseType,
        defenseStatus,
        notes
    } = req.body;

    if(
        !scheduleId ||
        !instructorUserId ||
        !groupDbId ||
        !panelistIds ||
        panelistIds.length === 0 ||
        !roomName ||
        !defenseDate ||
        !startTime ||
        !endTime ||
        !defenseStatus
    ){
        return res.json({
            success:false,
            message:"Please complete all required schedule fields and select at least one panelist."
        });
    }

    const instructorSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking instructor account."
            });
        }

        if(instructorResult.length === 0){
            return res.json({
                success:false,
                message:"Instructor account not found or no instructor access."
            });
        }

        const groupInstructorSql = `
            SELECT u.enrolled_by_user_id
            FROM group_members gm
            JOIN users u ON gm.student_id = u.id
            WHERE gm.group_id = ?
        `;
        db.query(groupInstructorSql, [groupDbId], (groupInsErr, groupInsResult) => {
            if (groupInsErr) {
                console.log(groupInsErr);
                return res.json({
                    success: false,
                    message: "Database error while validating group instructor."
                });
            }

            const instructorIds = (groupInsResult || []).map(r => r.enrolled_by_user_id);
            if (!instructorIds.includes(instructorUserId)) {
                return res.json({
                    success: false,
                    message: "You cannot update a defense schedule for this group because you are not their instructor."
                });
            }

            const panelistSql = `
            SELECT id
            FROM users
            WHERE id IN (?)
            AND role IN ('faculty', 'admin')
            AND panelist_access = 1
        `;

        db.query(panelistSql, [panelistIds], (err, panelistResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking panelists."
                });
            }

            if(panelistResult.length !== panelistIds.length){
                return res.json({
                    success:false,
                    message:"One or more selected panelists are invalid."
                });
            }

            const conflictSql = `
                SELECT id
                FROM defense_schedules
                WHERE defense_date = ?
                AND room_name = ?
                AND id != ?
                AND (
                    (? < end_time AND ? > start_time)
                )
                LIMIT 1
            `;

            db.query(
                conflictSql,
                [
                    defenseDate,
                    roomName,
                    scheduleId,
                    startTime,
                    endTime
                ],
                (err, conflictResult) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Database error while checking room conflict."
                        });
                    }

                    if(conflictResult.length > 0){
                        return res.json({
                            success:false,
                            message:"This room is already scheduled during the selected time."
                        });
                    }

                    const primaryPanelistId =
                        panelistIds[0];

                    const updateSql = `
                        UPDATE defense_schedules
                        SET
                            group_id = ?,
                            panelist_id = ?,
                            room_name = ?,
                            defense_date = ?,
                            start_time = ?,
                            end_time = ?,
                            defense_type = ?,
                            defense_status = ?,
                            notes = ?
                        WHERE id = ?
                    `;

                    db.query(
                        updateSql,
                        [
                            groupDbId,
                            primaryPanelistId,
                            roomName,
                            defenseDate,
                            startTime,
                            endTime,
                            defenseType || "Capstone Defense",
                            defenseStatus,
                            notes || "",
                            scheduleId
                        ],
                        (err, result) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to update defense schedule."
                                });
                            }

                            if(result.affectedRows === 0){
                                return res.json({
                                    success:false,
                                    message:"Defense schedule not found."
                                });
                            }

                            const deleteOldPanelistsSql = `
                                DELETE FROM defense_schedule_panelists
                                WHERE schedule_id = ?
                            `;

                            db.query(deleteOldPanelistsSql, [scheduleId], (err) => {

                                if(err){
                                    console.log(err);

                                    return res.json({
                                        success:false,
                                        message:"Schedule updated, but failed to reset panelists."
                                    });
                                }

                                const panelistValues =
                                    panelistIds.map(panelistId => [
                                        scheduleId,
                                        panelistId
                                    ]);

                                const insertPanelistsSql = `
                                    INSERT INTO defense_schedule_panelists
                                    (
                                        schedule_id,
                                        panelist_id
                                    )
                                    VALUES ?
                                `;

                                db.query(insertPanelistsSql, [panelistValues], (err) => {

                                    if(err){
                                        console.log(err);

                                        return res.json({
                                            success:false,
                                            message:"Schedule updated, but failed to save panelists."
                                        });
                                    }

                                    notifyDefenseUsersWithDetails(
                                        groupDbId,
                                        panelistIds,
                                        "Defense Schedule Updated",
                                        "updated",
                                        defenseDate,
                                        startTime,
                                        endTime,
                                        roomName
                                    );

                                    if (defenseStatus === 'Completed') {
                                        const membersSql = `
                                            SELECT student_id
                                            FROM group_members
                                            WHERE group_id = ?
                                        `;
                                        db.query(membersSql, [groupDbId], (memberErr, memberRows) => {
                                            if (!memberErr && memberRows) {
                                                insertUserNotificationsByDbIds(
                                                    memberRows.map(row => row.student_id),
                                                    "Defense Completed",
                                                    `Your ${defenseType || "defense"} has been marked as Completed.`,
                                                    "Defense Evaluation"
                                                );
                                            }
                                        });
                                    }

                                    res.json({
                                        success:true,
                                        message:"Defense schedule updated successfully."
                                    });

                                });

                            });

                        }
                    );

                }
            );

        });

    });

});

});


/* ================= DELETE DEFENSE SCHEDULE ================= */

app.delete("/delete-defense-schedule/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    const {
        instructorUserId
    } = req.body;

    if(!scheduleId || !instructorUserId){
        return res.json({
            success:false,
            message:"Missing schedule information."
        });
    }

    const scheduleSql = `
        SELECT
            ds.group_id,
            ds.defense_date,
            ds.start_time,
            ds.end_time,
            ds.room_name
        FROM defense_schedules ds
        WHERE ds.id = ?
        LIMIT 1
    `;

    db.query(scheduleSql, [scheduleId], (err, scheduleResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking schedule."
            });
        }

        if(scheduleResult.length === 0){
            return res.json({
                success:false,
                message:"Defense schedule not found."
            });
        }

        const schedule =
            scheduleResult[0];

        const panelistsSql = `
            SELECT panelist_id
            FROM defense_schedule_panelists
            WHERE schedule_id = ?
        `;

        db.query(panelistsSql, [scheduleId], (err, panelistResult) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Database error while checking schedule panelists."
                });
            }

            const panelistIds =
                panelistResult.map(item => item.panelist_id);

            const instructorSql = `
                SELECT id
                FROM users
                WHERE user_id = ?
                AND role IN ('faculty', 'admin')
                AND instructor_access = 1
                LIMIT 1
            `;

            db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Database error while checking instructor account."
                    });
                }

                if(instructorResult.length === 0){
                    return res.json({
                        success:false,
                        message:"Instructor account not found or no instructor access."
                    });
                }

                const deleteSql = `
                    DELETE FROM defense_schedules
                    WHERE id = ?
                `;

                db.query(deleteSql, [scheduleId], (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to delete defense schedule."
                        });
                    }

                    notifyDefenseUsersWithDetails(
                        schedule.group_id,
                        panelistIds,
                        "Defense Schedule Deleted",
                        "deleted",
                        schedule.defense_date,
                        schedule.start_time,
                        schedule.end_time,
                        schedule.room_name
                    );

                    res.json({
                        success:true,
                        message:"Defense schedule deleted successfully."
                    });

                });

            });

        });

    });

});


/* ================= DEFENSE NOTIFICATION HELPER ================= */

function getPanelistNamesText(panelistIds, callback){

    const ids =
        Array.isArray(panelistIds)
        ? panelistIds.filter(Boolean)
        : panelistIds
        ? [panelistIds]
        : [];

    if(ids.length === 0){

        callback("No panelists listed");

        return;

    }

    const namesSql = `
        SELECT fullname
        FROM users
        WHERE id IN (?)
        ORDER BY fullname ASC
    `;

    db.query(namesSql, [ids], (err, rows) => {

        if(err || !rows || rows.length === 0){

            callback("No panelists listed");

            return;

        }

        callback(
            rows
                .map(row => row.fullname)
                .filter(Boolean)
                .join(", ")
        );

    });

}

function buildDefenseNotificationMessage(action, defenseDate, startTime, endTime, roomName, panelistNamesText){

    const panelLine =
        `Panel: ${panelistNamesText || "No panelists listed"}.`;

    if(action === "created"){

        return `A defense schedule has been created on ${defenseDate} from ${startTime} to ${endTime} at ${roomName}. ${panelLine}`;

    }

    if(action === "updated"){

        return `A defense schedule was updated. New schedule: ${defenseDate} from ${startTime} to ${endTime} at ${roomName}. ${panelLine}`;

    }

    if(action === "deleted"){

        return `A defense schedule on ${defenseDate} from ${startTime} to ${endTime} at ${roomName} has been deleted. ${panelLine}`;

    }

    return `${panelLine}`;

}

function notifyDefenseUsersWithDetails(groupDbId, panelistIds, title, action, defenseDate, startTime, endTime, roomName){

    getPanelistNamesText(panelistIds, (panelistNamesText) => {

        const message =
            buildDefenseNotificationMessage(
                action,
                defenseDate,
                startTime,
                endTime,
                roomName,
                panelistNamesText
            );

        notifyDefenseUsers(
            groupDbId,
            panelistIds,
            title,
            message
        );

    });

}

function notifyDefenseUsers(groupDbId, panelistIds, title, message){

    const membersSql = `
        SELECT student_id AS user_id
        FROM group_members
        WHERE group_id = ?
    `;

    db.query(membersSql, [groupDbId], (err, members) => {

        if(err){
            console.log(err);
            return;
        }

        const receiverIds =
            members.map(member => member.user_id);

        if(Array.isArray(panelistIds)){

            panelistIds.forEach(panelistId => {
                receiverIds.push(panelistId);
            });

        }else{

            receiverIds.push(panelistIds);

        }

        const uniqueReceiverIds =
            [...new Set(receiverIds)];

        if(uniqueReceiverIds.length === 0){
            return;
        }

        const values =
            uniqueReceiverIds.map(userId => [
                userId,
                title,
                message,
                "Defense Schedule"
            ]);

        const insertSql = `
            INSERT INTO user_notifications
            (
                user_id,
                notification_title,
                notification_message,
                notification_type
            )
            VALUES ?
        `;

        db.query(insertSql, [values], (err) => {

            if(err){
                console.log(err);
            }

        });

    });

}

/* ================= STUDENT NOTIFICATIONS PAGE ================= */

app.get("/student-notifications/:studentUserId", (req, res) => {

    const studentUserId =
        req.params.studentUserId;

    const studentSql = `
        SELECT
            id,
            user_id,
            fullname,
            program,
            year_level,
            student_position
        FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(studentSql, [studentUserId], (err, studentResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check student account."
            });
        }

        if(studentResult.length === 0){

            return res.json({
                success:false,
                message:"Student account not found."
            });

        }

        const student =
            studentResult[0];

        const studentDbId =
            student.id;

        const studentProgram =
            student.program;

        const announcementsSql = `
            SELECT
                a.id,
                a.announcement_code,
                a.announcement_title,
                a.announcement_type,
                a.audience,
                a.target_program,
                a.announcement_content,
                a.announcement_status,
                a.created_at,
                a.updated_at,

                u.user_id AS created_by_user_id,
                u.fullname AS created_by_name,
                u.role AS created_by_role,
                u.position AS created_by_position

            FROM announcements a

            JOIN users u
                ON a.created_by = u.id

            WHERE a.announcement_status = 'Published'
            AND (
                a.audience IN ('All Users', 'All', 'Students')
                OR (
                    a.audience = 'Program'
                    AND a.target_program = ?
                )
            )

            ORDER BY a.created_at DESC
        `;

        db.query(announcementsSql, [studentProgram], (err, announcements) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load announcements."
                });
            }

            const defenseSql = `
                SELECT
                    ds.id,
                    ds.schedule_code,
                    ds.room_name,
                    ds.defense_date,
                    ds.start_time,
                    ds.end_time,
                    ds.defense_type,
                    ds.defense_status,
                    ds.notes,
                    ds.created_at,
                    ds.updated_at,

                    cg.group_id,
                    cg.group_name,
                    cg.project_title,
                    cg.program AS group_program

                FROM defense_schedules ds

                JOIN capstone_groups cg
                    ON ds.group_id = cg.id

                JOIN group_members gm
                    ON cg.id = gm.group_id

                WHERE gm.student_id = ?

                ORDER BY ds.defense_date DESC, ds.start_time DESC
            `;

            db.query(defenseSql, [studentDbId], (err, defenseSchedules) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load defense schedules."
                    });
                }

                const panelistsSql = `
                    SELECT
                        dsp.schedule_id,
                        u.id,
                        u.user_id,
                        u.fullname,
                        u.position,
                        u.role
                    FROM defense_schedule_panelists dsp

                    JOIN users u
                        ON dsp.panelist_id = u.id

                    ORDER BY u.fullname ASC
                `;

                db.query(panelistsSql, (err, panelists) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to load defense panelists."
                        });
                    }

                    const schedulesWithPanelists =
                        defenseSchedules.map(schedule => {

                            return {
                                ...schedule,
                                panelists:panelists.filter(panelist =>
                                    Number(panelist.schedule_id) === Number(schedule.id)
                                )
                            };

                        });

                    const notificationsSql = `
                        SELECT
                            id,
                            notification_title,
                            notification_message,
                            notification_type,
                            is_read,
                            created_at
                        FROM user_notifications
                        WHERE user_id = ?
                        ORDER BY created_at DESC
                    `;

                    db.query(notificationsSql, [studentDbId], (err, notifications) => {

                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Failed to load system notifications."
                            });
                        }

                        const hiddenSql = `
                            SELECT
                                update_type,
                                update_id
                            FROM student_hidden_updates
                            WHERE student_id = ?
                        `;

                        db.query(hiddenSql, [studentDbId], (err, hiddenUpdates) => {

                            if(err){
                                console.log(err);

                                return res.json({
                                    success:false,
                                    message:"Failed to load hidden updates."
                                });
                            }

                            const isHidden = (type, id) => {

                                return hiddenUpdates.some(hidden =>
                                    hidden.update_type === type &&
                                    Number(hidden.update_id) === Number(id)
                                );

                            };

                            const visibleAnnouncements =
                                announcements.filter(item =>
                                    !isHidden("announcement", item.id)
                                );

                            const visibleDefenseSchedules =
                                schedulesWithPanelists.filter(item =>
                                    !isHidden("defense", item.id)
                                );

                            const visibleNotifications =
                                notifications.filter(item =>
                                    !isHidden("system", item.id)
                                );

                            res.json({
                                success:true,
                                student,
                                announcements:visibleAnnouncements,
                                defenseSchedules:visibleDefenseSchedules,
                                notifications:visibleNotifications
                            });

                        });

                    });

                });

            });

        });

    });

});


/* ================= MARK STUDENT NOTIFICATION AS READ ================= */

app.put("/mark-student-notification-read/:notificationId", (req, res) => {

    const notificationId =
        req.params.notificationId;

    const {
        studentUserId
    } = req.body;

    if(!notificationId || !studentUserId){

        return res.json({
            success:false,
            message:"Missing notification information."
        });

    }

    const studentSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(studentSql, [studentUserId], (err, studentResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check student account."
            });
        }

        if(studentResult.length === 0){

            return res.json({
                success:false,
                message:"Student account not found."
            });

        }

        const studentDbId =
            studentResult[0].id;

        const updateSql = `
            UPDATE user_notifications
            SET is_read = 1
            WHERE id = ?
            AND user_id = ?
        `;

        db.query(
            updateSql,
            [
                notificationId,
                studentDbId
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to mark notification as read."
                    });
                }

                res.json({
                    success:true,
                    message:"Notification marked as read."
                });

            }
        );

    });

});


/* ================= MARK ALL STUDENT NOTIFICATIONS AS READ ================= */

app.put("/mark-all-student-notifications-read", (req, res) => {

    const {
        studentUserId
    } = req.body;

    if(!studentUserId){

        return res.json({
            success:false,
            message:"Missing student information."
        });

    }

    const studentSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(studentSql, [studentUserId], (err, studentResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check student account."
            });
        }

        if(studentResult.length === 0){

            return res.json({
                success:false,
                message:"Student account not found."
            });

        }

        const studentDbId =
            studentResult[0].id;

        const updateSql = `
            UPDATE user_notifications
            SET is_read = 1
            WHERE user_id = ?
        `;

        db.query(updateSql, [studentDbId], (err) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to mark notifications as read."
                });
            }

            res.json({
                success:true,
                message:"All system notifications marked as read."
            });

        });

    });

});


/* ================= SHARED PORTAL NOTIFICATIONS ================= */

app.get("/portal-notifications/:userId", (req, res) => {
    const userId = req.params.userId;
    let limit = 100;
    if (req.query.limit !== undefined) {
        const parsed = parseInt(req.query.limit);
        if (!isNaN(parsed)) {
            limit = parsed;
        }
    }

    if (!userId) {
        return res.json({
            success: false,
            message: "Missing user ID."
        });
    }

    const userSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(userSql, [userId], (err, userResult) => {
        if (err) {
            console.log(err);
            return res.json({
                success: false,
                message: "Failed to verify account."
            });
        }

        if (userResult.length === 0) {
            return res.json({
                success: false,
                message: "Account not found."
            });
        }

        const userDbId = userResult[0].id;

        const countSql = `
            SELECT COUNT(*) AS unread_count
            FROM user_notifications
            WHERE user_id = ?
            AND is_read = 0
        `;

        db.query(countSql, [userDbId], (countErr, countResult) => {
            if (countErr) {
                console.log(countErr);
                return res.json({
                    success: false,
                    message: "Failed to count unread notifications."
                });
            }

            const unreadCount = Number(countResult[0]?.unread_count || 0);

            if (limit <= 0) {
                return res.json({
                    success: true,
                    unread_count: unreadCount,
                    notifications: []
                });
            }

            const notifSql = `
                SELECT
                    id,
                    notification_title,
                    notification_message,
                    notification_type,
                    is_read,
                    created_at
                FROM user_notifications
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            db.query(notifSql, [userDbId, limit], (notifErr, notifications) => {
                if (notifErr) {
                    console.log(notifErr);
                    return res.json({
                        success: false,
                        message: "Failed to load notifications."
                    });
                }

                res.json({
                    success: true,
                    unread_count: unreadCount,
                    notifications: notifications || []
                });
            });
        });
    });
});

app.put("/portal-notifications-read-all", (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.json({
            success: false,
            message: "Missing user information."
        });
    }

    const userSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(userSql, [userId], (err, userResult) => {
        if (err) {
            console.log(err);
            return res.json({
                success: false,
                message: "Failed to check account."
            });
        }

        if (userResult.length === 0) {
            return res.json({
                success: false,
                message: "Account not found."
            });
        }

        const userDbId = userResult[0].id;

        const updateSql = `
            UPDATE user_notifications
            SET is_read = 1
            WHERE user_id = ?
        `;

        db.query(updateSql, [userDbId], (updateErr) => {
            if (updateErr) {
                console.log(updateErr);
                return res.json({
                    success: false,
                    message: "Failed to mark notifications as read."
                });
            }

            res.json({
                success: true,
                message: "All notifications marked as read."
            });
        });
    });
});

app.put("/portal-notification-read/:notificationId", (req, res) => {
    const notificationId = req.params.notificationId;
    const { userId } = req.body;

    if (!notificationId || !userId) {
        return res.json({
            success: false,
            message: "Missing notification or user information."
        });
    }

    const userSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(userSql, [userId], (err, userResult) => {
        if (err) {
            console.log(err);
            return res.json({
                success: false,
                message: "Failed to check account."
            });
        }

        if (userResult.length === 0) {
            return res.json({
                success: false,
                message: "Account not found."
            });
        }

        const userDbId = userResult[0].id;

        const updateSql = `
            UPDATE user_notifications
            SET is_read = 1
            WHERE id = ? AND user_id = ?
        `;

        db.query(updateSql, [notificationId, userDbId], (updateErr) => {
            if (updateErr) {
                console.log(updateErr);
                return res.json({
                    success: false,
                    message: "Failed to mark notification as read."
                });
            }

            res.json({
                success: true,
                message: "Notification marked as read."
            });
        });
    });
});


/* ================= HIDE STUDENT UPDATE ================= */

app.post("/hide-student-update", (req, res) => {

    const {
        studentUserId,
        updateType,
        updateId
    } = req.body;

    if(
        !studentUserId ||
        !updateType ||
        !updateId
    ){
        return res.json({
            success:false,
            message:"Missing update information."
        });
    }

    const allowedTypes = [
        "announcement",
        "defense",
        "system"
    ];

    if(!allowedTypes.includes(updateType)){

        return res.json({
            success:false,
            message:"Invalid update type."
        });

    }

    const studentSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role = 'student'
        LIMIT 1
    `;

    db.query(studentSql, [studentUserId], (err, studentResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check student account."
            });
        }

        if(studentResult.length === 0){

            return res.json({
                success:false,
                message:"Student account not found."
            });

        }

        const studentDbId =
            studentResult[0].id;

        const insertSql = `
            INSERT IGNORE INTO student_hidden_updates
            (
                student_id,
                update_type,
                update_id
            )
            VALUES (?, ?, ?)
        `;

        db.query(
            insertSql,
            [
                studentDbId,
                updateType,
                updateId
            ],
            (err) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to hide update."
                    });
                }

                res.json({
                    success:true,
                    message:"Update removed from your view."
                });

            }
        );

    });

});

/* ================= ADVISER REQUEST NOTIFICATION HELPER ================= */

function notifyGroupMembersAboutAdviserRequest(groupDbId, title, message){

    const membersSql = `
        SELECT student_id
        FROM group_members
        WHERE group_id = ?
    `;

    db.query(membersSql, [groupDbId], (err, members) => {

        if(err){
            console.log(err);
            return;
        }

        if(members.length === 0){
            return;
        }

        const values =
            members.map(member => [
                member.student_id,
                title,
                message,
                "Adviser Request"
            ]);

        const insertSql = `
            INSERT INTO user_notifications
            (
                user_id,
                notification_title,
                notification_message,
                notification_type
            )
            VALUES ?
        `;

        db.query(insertSql, [values], (err) => {

            if(err){
                console.log(err);
            }

        });

    });

}


/* ================= ANNOUNCEMENT NOTIFICATION HELPER ================= */

function notifyUsersAboutAnnouncement(announcementTitle, announcementContent, audience, targetProgram) {
    let sql = "SELECT id, role, program FROM users WHERE role != 'admin'";
    const params = [];
    if (audience === "Students") {
        sql += " AND role = 'student'";
    } else if (audience === "Faculty") {
        sql += " AND role = 'faculty'";
    } else if (audience === "Program" && targetProgram) {
        sql += " AND program = ?";
        params.push(targetProgram);
    }

    db.query(sql, params, (err, users) => {
        if (err) {
            console.log("Error querying users for announcement notification:", err);
            return;
        }
        if (!users || users.length === 0) {
            return;
        }

        const values = users.map(user => [
            user.id,
            `New Announcement: ${announcementTitle}`,
            announcementContent,
            "Announcement"
        ]);

        const insertSql = `
            INSERT INTO user_notifications
            (
                user_id,
                notification_title,
                notification_message,
                notification_type
            )
            VALUES ?
        `;

        db.query(insertSql, [values], (err) => {
            if (err) {
                console.log("Error inserting announcement notifications:", err);
            }
        });
    });
}


/* ================= RESPOND TO ADVISER REQUEST ================= */

app.post("/respond-adviser-request", (req, res) => {

    const requestId =
        req.body.requestId;

    const adviserUserId =
        req.body.adviserUserId;

    const responseStatus =
        req.body.responseStatus ||
        req.body.requestStatus ||
        req.body.status;

    const adviserFeedback =
        req.body.adviserFeedback || "";

    if(
        !requestId ||
        !adviserUserId ||
        !responseStatus
    ){
        return res.json({
            success:false,
            message:"Missing adviser request response information."
        });
    }

    const finalStatus =
        responseStatus === "Accept" || responseStatus === "Accepted"
        ? "Accepted"
        : responseStatus === "Decline" || responseStatus === "Declined"
        ? "Declined"
        : "";

    if(!finalStatus){

        return res.json({
            success:false,
            message:"Invalid adviser request response."
        });

    }

    const adviserSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            adviser_access
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [adviserUserId], (err, adviserResult) => {

        if(err){
            console.log("Adviser check error:", err);

            return res.json({
                success:false,
                message:"Database error while checking adviser account."
            });
        }

        

        if(adviserResult.length === 0){

            return res.json({
                success:false,
                message:"Adviser account not found or does not have adviser access."
            });

        }

        const adviserDbId =
            adviserResult[0].id;

        const adviserName =
            adviserResult[0].fullname;

        const requestSql = `
            SELECT
                ar.id,
                ar.group_id,
                ar.adviser_id,
                ar.request_status,

                cg.group_name,
                cg.project_title,
                cg.adviser_id AS current_adviser_id

            FROM adviser_requests ar

            JOIN capstone_groups cg
                ON ar.group_id = cg.id

            WHERE ar.id = ?
            AND ar.adviser_id = ?
            LIMIT 1
        `;

        db.query(
            requestSql,
            [
                requestId,
                adviserDbId
            ],
            (err, requestResult) => {

                if(err){
                    console.log("Request check error:", err);

                    return res.json({
                        success:false,
                        message:"Database error while checking adviser request."
                    });
                }

                

                if(requestResult.length === 0){

                    return res.json({
                        success:false,
                        message:"Adviser request not found for this adviser."
                    });

                }

                const request =
                    requestResult[0];

                if(request.request_status !== "Pending"){

                    return res.json({
                        success:false,
                        message:`This request is already ${request.request_status}.`
                    });

                }

                if(finalStatus === "Accepted"){

                    const acceptSql = `
                        UPDATE adviser_requests
                        SET request_status = 'Accepted',
                            adviser_feedback = ?
                        WHERE id = ?
                    `;

                    db.query(acceptSql, [adviserFeedback, requestId], (err, acceptResult) => {

                        if(err){
                            console.log("Accept update error:", err);

                            return res.json({
                                success:false,
                                message:"Cannot update request. SQL error while accepting."
                            });
                        }

                        

                        if(acceptResult.affectedRows === 0){

                            return res.json({
                                success:false,
                                message:"Cannot update request. No request row was changed."
                            });

                        }

                        const assignSql = `
                            UPDATE capstone_groups
                            SET adviser_id = ?
                            WHERE id = ?
                        `;

                        db.query(
                            assignSql,
                            [
                                adviserDbId,
                                request.group_id
                            ],
                            (err, assignResult) => {

                                if(err){
                                    console.log("Assign adviser error:", err);

                                    return res.json({
                                        success:false,
                                        message:"Request accepted, but adviser assignment failed."
                                    });
                                }

                                

                                const declineOtherSql = `
                                    UPDATE adviser_requests
                                    SET request_status = 'Declined'
                                    WHERE group_id = ?
                                    AND id != ?
                                    AND request_status = 'Pending'
                                `;

                                db.query(
                                    declineOtherSql,
                                    [
                                        request.group_id,
                                        requestId
                                    ],
                                    (err) => {

                                        if(err){
                                            console.log("Decline other pending requests error:", err);
                                        }

                                        let finalMessage = `${adviserName} accepted your adviser request for "${request.group_name}". Your group now has an assigned adviser.`;
                                        if(adviserFeedback){
                                            finalMessage += `\n\nAdviser Feedback:\n${adviserFeedback}`;
                                        }

                                        notifyGroupMembersAboutAdviserRequest(
                                            request.group_id,
                                            "Adviser Request Accepted",
                                            finalMessage
                                        );

                                        return res.json({
                                            success:true,
                                            message:"Adviser request accepted successfully."
                                        });

                                    }
                                );

                            }
                        );

                    });

                }else if(finalStatus === "Declined"){

                    const declineSql = `
                        UPDATE adviser_requests
                        SET request_status = 'Declined',
                            adviser_feedback = ?
                        WHERE id = ?
                    `;

                    db.query(declineSql, [adviserFeedback, requestId], (err, declineResult) => {

                        if(err){
                            console.log("Decline update error:", err);

                            return res.json({
                                success:false,
                                message:"Cannot update request. SQL error while declining."
                            });
                        }

                       

                        if(declineResult.affectedRows === 0){

                            return res.json({
                                success:false,
                                message:"Cannot update request. No request row was changed."
                            });

                        }

                        let finalMessage = `${adviserName} declined your adviser request for "${request.group_name}". You may request another available adviser.`;
                        if(adviserFeedback){
                            finalMessage += `\n\nAdviser Feedback:\n${adviserFeedback}`;
                        }

                        notifyGroupMembersAboutAdviserRequest(
                            request.group_id,
                            "Adviser Request Declined",
                            finalMessage
                        );

                        return res.json({
                            success:true,
                            message:"Adviser request declined successfully."
                        });

                    });

                }

            }
        );

    });

});

/* ================= PANELIST DASHBOARD DATA ================= */

app.get("/panelist-dashboard/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const panelistSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            position,
            program,
            adviser_access,
            panelist_access,
            instructor_access,
            profile_image
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND panelist_access = 1
        LIMIT 1
    `;

    db.query(panelistSql, [userId], (err, panelistResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check panelist account."
            });
        }

        if(panelistResult.length === 0){

            return res.json({
                success:false,
                message:"Panelist account not found or panelist access is disabled."
            });

        }

        const panelist =
            panelistResult[0];

        const panelistDbId =
            panelist.id;

        const schedulesSql = `
            SELECT
                ds.id,
                ds.schedule_code,
                ds.room_name,
                ds.defense_date,
                ds.start_time,
                ds.end_time,
                ds.defense_type,
                ds.defense_status,
                ds.notes,
                ds.created_at,
                ds.updated_at,

                cg.id AS group_db_id,
                cg.group_id,
                cg.group_name,
                cg.project_title,
                cg.program AS group_program,

                creator.fullname AS created_by_name,
                creator.user_id AS created_by_user_id

            FROM defense_schedule_panelists dsp

            JOIN defense_schedules ds
                ON dsp.schedule_id = ds.id

            JOIN capstone_groups cg
                ON ds.group_id = cg.id

            JOIN users creator
                ON ds.created_by = creator.id

            WHERE dsp.panelist_id = ?

            ORDER BY ds.defense_date ASC, ds.start_time ASC
        `;

        db.query(schedulesSql, [panelistDbId], (err, schedules) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load assigned defenses."
                });
            }

            const documentsSql = `
                SELECT
                    ds.id AS submission_id,
                    ds.submission_message,
                    ds.submission_status,
                    ds.sent_at,

                    sd.id AS document_id,
                    sd.document_code,
                    sd.document_title,
                    sd.document_type,
                    sd.file_name,
                    sd.file_path,
                    sd.file_format,
                    sd.document_status,

                    sender.user_id AS sender_user_id,
                    sender.fullname AS sender_name,

                    cg.group_id,
                    cg.group_name,
                    cg.project_title,
                    cg.program AS group_program

                FROM document_submissions ds

                JOIN student_documents sd
                    ON ds.document_id = sd.id

                JOIN users sender
                    ON ds.sender_id = sender.id

                LEFT JOIN group_members gm
                    ON sender.id = gm.student_id

                LEFT JOIN capstone_groups cg
                    ON gm.group_id = cg.id

                WHERE ds.receiver_id = ?

                ORDER BY ds.sent_at DESC
            `;

            db.query(documentsSql, [panelistDbId], (err, documents) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load received documents."
                    });
                }

                const today =
                    new Date();

                today.setHours(0, 0, 0, 0);

                const assignedDefenses =
                    schedules.length;

                const upcomingDefenses =
                    schedules.filter(schedule => {

                        const scheduleDate =
                            new Date(schedule.defense_date);

                        scheduleDate.setHours(0, 0, 0, 0);

                        return scheduleDate >= today
                            &&
                            schedule.defense_status === "Scheduled";

                    }).length;

                const completedDefenses =
                    schedules.filter(schedule =>
                        schedule.defense_status === "Completed"
                    ).length;

                const receivedDocuments =
                    documents.length;

                res.json({
                    success:true,
                    panelist,
                    stats:{
                        assignedDefenses,
                        upcomingDefenses,
                        completedDefenses,
                        receivedDocuments
                    },
                    schedules,
                    documents
                });

            });

        });

    });

});

/* ================= PANELIST ASSIGNED DEFENSES ================= */

app.get("/panelist-assigned-defenses/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const panelistSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            position,
            program,
            adviser_access,
            panelist_access,
            instructor_access,
            profile_image
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND panelist_access = 1
        LIMIT 1
    `;

    db.query(panelistSql, [userId], (err, panelistResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check panelist account."
            });
        }

        if(panelistResult.length === 0){

            return res.json({
                success:false,
                message:"Panelist account not found or panelist access is disabled."
            });

        }

        const panelist =
            panelistResult[0];

        const panelistDbId =
            panelist.id;

        const schedulesSql = `
            SELECT
                ds.id,
                ds.schedule_code,
                ds.panelist_id,
                ds.room_name,
                ds.defense_date,
                ds.start_time,
                ds.end_time,
                ds.defense_type,
                ds.defense_status,
                ds.notes,
                ds.created_at,
                ds.updated_at,

                cg.id AS group_db_id,
                cg.group_id,
                cg.group_name,
                cg.project_title,
                cg.program AS group_program,

                creator.user_id AS created_by_user_id,
                creator.fullname AS created_by_name

            FROM defense_schedule_panelists dsp

            JOIN defense_schedules ds
                ON dsp.schedule_id = ds.id

            JOIN capstone_groups cg
                ON ds.group_id = cg.id

            JOIN users creator
                ON ds.created_by = creator.id

            WHERE dsp.panelist_id = ?

            ORDER BY ds.defense_date DESC, ds.start_time DESC
        `;

        db.query(schedulesSql, [panelistDbId], (err, schedules) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load assigned defenses."
                });
            }

            const membersSql = `
                SELECT
                    gm.group_id,
                    gm.member_position,

                    u.id,
                    u.user_id,
                    u.fullname,
                    u.program,
                    u.year_level,
                    u.student_position
                FROM group_members gm

                JOIN users u
                    ON gm.student_id = u.id

                ORDER BY
                    CASE
                        WHEN gm.member_position = 'Project Manager' THEN 1
                        ELSE 2
                    END,
                    u.fullname ASC
            `;

            db.query(membersSql, (err, members) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load group members."
                    });
                }

                const panelistsSql = `
                    SELECT
                        dsp.schedule_id,

                        u.id,
                        u.user_id,
                        u.fullname,
                        u.position,
                        u.role
                    FROM defense_schedule_panelists dsp

                    JOIN users u
                        ON dsp.panelist_id = u.id

                    ORDER BY u.fullname ASC
                `;

                db.query(panelistsSql, (err, panelists) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to load defense panelists."
                        });
                    }

                    const groupDbIds = [
                        ...new Set(
                            schedules
                            .map(schedule => Number(schedule.group_db_id))
                            .filter(id => id > 0)
                        )
                    ];

                    const scheduleIds =
                        schedules.map(schedule => schedule.id);

                    const finishPanelistResponse = (
                        proposals,
                        documents,
                        myEvaluations,
                        evaluationCounts
                    ) => {

                        const schedulesWithDetails =
                            schedules.map(schedule => {

                                const schedulePanelists =
                                    panelists.filter(panelistItem =>
                                        Number(panelistItem.schedule_id)
                                        === Number(schedule.id)
                                    );

                                const titleProposals =
                                    (proposals || [])
                                    .filter(proposal =>
                                        Number(proposal.group_id)
                                        === Number(schedule.group_db_id)
                                    )
                                    .map(normalizeTitleProposalRow);

                                const scheduleDocuments =
                                    (documents || [])
                                    .filter(documentItem =>
                                        Number(documentItem.group_id)
                                        === Number(schedule.group_db_id)
                                        && documentMatchesDefenseScheduleType(
                                            documentItem.document_type,
                                            schedule.defense_type
                                        )
                                    )
                                    .map(documentItem => ({
                                        id:documentItem.id,
                                        label:formatConsultationDocumentLabel(
                                            documentItem.document_type
                                        ),
                                        document_type:documentItem.document_type,
                                        document_title:documentItem.document_title,
                                        file_name:documentItem.file_name,
                                        file_path:documentItem.file_path,
                                        document_status:documentItem.document_status
                                    }));

                                const myEvalRow =
                                    (myEvaluations || []).find(row =>
                                        Number(row.schedule_id)
                                        === Number(schedule.id)
                                    );

                                const myEvaluation =
                                    myEvalRow
                                    ? {
                                        id:myEvalRow.id,
                                        score:myEvalRow.score,
                                        panel_result:myEvalRow.panel_result,
                                        comments:myEvalRow.comments,
                                        recommendations:myEvalRow.recommendations,
                                        approved_title_id:myEvalRow.approved_title_id,
                                        concept_evaluation_details:
                                            myEvalRow.concept_evaluation_details,
                                        outline_evaluation_details:
                                            myEvalRow.outline_evaluation_details
                                    }
                                    : null;

                                const countRow =
                                    (evaluationCounts || []).find(row =>
                                        Number(row.schedule_id)
                                        === Number(schedule.id)
                                    );

                                const evaluationsSubmitted =
                                    Number(countRow?.evaluation_count || 0);

                                const evaluationsRequired =
                                    schedulePanelists.length;

                                return {
                                    ...schedule,

                                    members:members.filter(member =>
                                        Number(member.group_id)
                                        === Number(schedule.group_db_id)
                                    ),

                                    panelists:schedulePanelists,

                                    title_proposals:titleProposals,

                                    documents:scheduleDocuments,

                                    my_evaluation:myEvaluation,

                                    evaluation:myEvaluation,

                                    evaluations_required:evaluationsRequired,

                                    evaluations_submitted:evaluationsSubmitted,

                                    evaluations_complete:
                                        evaluationsRequired > 0
                                        && evaluationsSubmitted >= evaluationsRequired
                                };

                            });

                        const today =
                            new Date();

                        today.setHours(0, 0, 0, 0);

                        const assignedDefenses =
                            schedulesWithDetails.length;

                        const upcomingDefenses =
                            schedulesWithDetails.filter(schedule => {

                                const scheduleDate =
                                    new Date(schedule.defense_date);

                                scheduleDate.setHours(0, 0, 0, 0);

                                return scheduleDate >= today
                                    &&
                                    schedule.defense_status === "Scheduled";

                            }).length;

                        const completedDefenses =
                            schedulesWithDetails.filter(schedule =>
                                schedule.defense_status === "Completed"
                            ).length;

                        const cancelledDefenses =
                            schedulesWithDetails.filter(schedule =>
                                schedule.defense_status === "Cancelled"
                            ).length;

                        res.json({
                            success:true,
                            panelist,
                            stats:{
                                assignedDefenses,
                                upcomingDefenses,
                                completedDefenses,
                                cancelledDefenses
                            },
                            schedules:schedulesWithDetails
                        });

                    };

                    if(groupDbIds.length === 0){

                        return finishPanelistResponse([], [], [], []);

                    }

                    const proposalsSql = `
                        SELECT
                            id,
                            group_id,
                            title_number,
                            proposed_title,
                            file_name,
                            file_path,
                            status,
                            created_at
                        FROM title_proposals
                        WHERE group_id IN (?)
                        ORDER BY title_number ASC
                    `;

                    db.query(proposalsSql, [groupDbIds], (proposalErr, proposals) => {

                        if(proposalErr){
                            console.log(proposalErr);

                            return res.json({
                                success:false,
                                message:"Failed to load title proposals."
                            });
                        }

                        const documentsSql = `
                            SELECT
                                id,
                                group_id,
                                document_type,
                                document_title,
                                file_name,
                                file_path,
                                document_status,
                                created_at
                            FROM student_documents
                            WHERE group_id IN (?)
                            AND document_status = 'Approved'
                            ORDER BY id DESC
                        `;

                        db.query(documentsSql, [groupDbIds], (documentErr, documents) => {

                            if(documentErr){
                                console.log(documentErr);

                                return res.json({
                                    success:false,
                                    message:"Failed to load defense documents."
                                });
                            }

                            if(scheduleIds.length === 0){

                                return finishPanelistResponse(
                                    proposals,
                                    documents,
                                    [],
                                    []
                                );

                            }

                            const myEvaluationsSql = `
                                SELECT
                                    id,
                                    schedule_id,
                                    panelist_id,
                                    score,
                                    panel_result,
                                    comments,
                                    recommendations,
                                    approved_title_id,
                                    concept_evaluation_details,
                                    outline_evaluation_details
                                FROM defense_panel_evaluations
                                WHERE panelist_id = ?
                                AND schedule_id IN (?)
                            `;

                            db.query(
                                myEvaluationsSql,
                                [panelistDbId, scheduleIds],
                                (myEvalErr, myEvaluations) => {

                                    if(myEvalErr){
                                        console.log(myEvalErr);

                                        return res.json({
                                            success:false,
                                            message:"Failed to load panel evaluations."
                                        });
                                    }

                                    const evaluationCountsSql = `
                                        SELECT
                                            schedule_id,
                                            COUNT(*) AS evaluation_count
                                        FROM defense_panel_evaluations
                                        WHERE schedule_id IN (?)
                                        GROUP BY schedule_id
                                    `;

                                    db.query(
                                        evaluationCountsSql,
                                        [scheduleIds],
                                        (countErr, evaluationCounts) => {

                                            if(countErr){
                                                console.log(countErr);

                                                return res.json({
                                                    success:false,
                                                    message:"Failed to count panel evaluations."
                                                });
                                            }

                                            finishPanelistResponse(
                                                proposals,
                                                documents,
                                                myEvaluations,
                                                evaluationCounts
                                            );

                                        }
                                    );

                                }
                            );

                        });

                    });

                });

            });

        });

    });

});

/* ================= PANELIST DEFENSE DOCUMENTS ================= */

app.get("/panelist-documents/:userId", (req, res) => {

    const userId = req.params.userId;

    if (!userId) {
        return res.json({ success: false, message: "Missing user ID." });
    }

    const panelistSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND panelist_access = 1
        LIMIT 1
    `;

    db.query(panelistSql, [userId], (err, panelistRows) => {

        if (err) {
            console.log(err);
            return res.json({ success: false, message: "Failed to verify panelist account." });
        }

        if (!panelistRows || panelistRows.length === 0) {
            return res.json({ success: false, message: "Panelist account not found or access disabled." });
        }

        const panelistDbId = panelistRows[0].id;

        /* Get all distinct group IDs assigned to this panelist via schedules */
        const groupsSql = `
            SELECT DISTINCT ds.group_id
            FROM defense_schedule_panelists dsp
            JOIN defense_schedules ds ON dsp.schedule_id = ds.id
            WHERE dsp.panelist_id = ?
        `;

        db.query(groupsSql, [panelistDbId], (groupErr, groupRows) => {

            if (groupErr) {
                console.log(groupErr);
                return res.json({ success: false, message: "Failed to fetch assigned groups." });
            }

            if (!groupRows || groupRows.length === 0) {
                return res.json({ success: true, documents: [] });
            }

            const groupIds = groupRows.map(r => r.group_id);

            /* Fetch approved documents for those groups */
            const docsSql = `
                SELECT
                    sd.id,
                    sd.document_code,
                    sd.document_title,
                    sd.document_type,
                    sd.file_name,
                    sd.file_path,
                    sd.file_format,
                    sd.document_status,
                    sd.created_at,

                    cg.id AS group_id,
                    cg.group_name,
                    cg.program

                FROM student_documents sd

                JOIN capstone_groups cg
                    ON sd.group_id = cg.id

                WHERE sd.group_id IN (?)
                AND sd.document_status = 'Approved'

                ORDER BY cg.group_name ASC, sd.created_at DESC
            `;

            db.query(docsSql, [groupIds], (docErr, docs) => {

                if (docErr) {
                    console.log(docErr);
                    return res.json({ success: false, message: "Failed to load documents." });
                }

                return res.json({ success: true, documents: docs || [] });

            });

        });

    });

});

/* ================= PANEL EVALUATION SUBMIT / VIEW ================= */

function insertUserNotificationsByDbIds(
    userDbIds,
    title,
    message,
    notificationType
){

    const uniqueIds = [
        ...new Set(
            (userDbIds || [])
            .map(id => Number(id))
            .filter(id => id > 0)
        )
    ];

    if(uniqueIds.length === 0){
        return;
    }

    const values =
        uniqueIds.map(userId => [
            userId,
            title,
            message,
            notificationType || "Defense Evaluation"
        ]);

    const insertSql = `
        INSERT INTO user_notifications
        (
            user_id,
            notification_title,
            notification_message,
            notification_type
        )
        VALUES ?
    `;

    db.query(insertSql, [values], (err) => {
        if(err){
            console.log(err);
        }
    });

}

function aggregateCompiledPanelResult(evaluations){

    const results =
        (evaluations || [])
        .map(row => String(row.panel_result || "").trim())
        .filter(Boolean);

    if(results.length === 0){
        return "Pending";
    }

    if(results.some(result => result === "Failed")){
        return "Failed";
    }

    if(results.some(result => result === "For Re-Defense")){
        return "For Re-Defense";
    }

    if(results.some(result => result === "Conditional Passed" || result === "Conditional Pass")){
        return "Conditional Passed";
    }

    if(results.some(result => result === "Passed with Revisions")){
        return "Passed with Revisions";
    }

    if(results.every(result => result === "Passed")){
        return "Passed";
    }

    return results[0];

}

function aggregateCompiledScore(evaluations){

    const scores =
        (evaluations || [])
        .map(row => parseFloat(row.score))
        .filter(score => !isNaN(score));

    if(scores.length === 0){
        return null;
    }

    const average =
        scores.reduce((total, score) => total + score, 0)
        / scores.length;

    return average.toFixed(2);

}

function getGroupStageAfterDefense(defenseType, panelResult){

    const resultStr = String(panelResult || "").trim();
    if(resultStr === "Failed" || resultStr === "For Re-Defense" || resultStr === "Conditional Passed" || resultStr === "Conditional Pass"){
        return null;
    }

    const phaseCategory =
        getConsultationPhaseCategoryForDefenseType(defenseType);

    const stageMap = {
        "Concept Presentation":"Stage 2",
        "Outline Defense":"Stage 3",
        "Pre-Final Defense":"Stage 4",
        "Final Defense":"Final"
    };

    return stageMap[phaseCategory] || null;

}

function getProgressPercentForStage(stage){

    const progressMap = {
        "Stage 1":0,
        "Stage 2":25,
        "Stage 3":50,
        "Stage 4":75,
        "Final":100
    };

    return progressMap[stage] ?? 0;

}

function pickCompiledApprovedTitleId(evaluations){

    const counts = {};

    (evaluations || []).forEach(row => {

        const titleId =
            row.approved_title_id;

        if(titleId === null || titleId === undefined || titleId === ""){
            return;
        }

        const key =
            String(titleId);

        counts[key] =
            (counts[key] || 0) + 1;

    });

    const sorted =
        Object.entries(counts)
        .sort((a, b) => b[1] - a[1]);

    if(sorted.length === 0){
        return null;
    }

    return sorted[0][0];

}

function finalizeDefenseScheduleIfComplete(scheduleId, callback){

    const scheduleSql = `
        SELECT
            ds.id,
            ds.group_id,
            ds.defense_type,
            ds.defense_status,
            ds.created_by
        FROM defense_schedules ds
        WHERE ds.id = ?
        LIMIT 1
    `;

    db.query(scheduleSql, [scheduleId], (scheduleErr, scheduleRows) => {

        if(scheduleErr){
            return callback(scheduleErr);
        }

        if(!scheduleRows || scheduleRows.length === 0){
            return callback(null, { complete:false });
        }

        const schedule =
            scheduleRows[0];

        const panelistsSql = `
            SELECT COUNT(*) AS panelist_count
            FROM defense_schedule_panelists
            WHERE schedule_id = ?
        `;

        db.query(panelistsSql, [scheduleId], (panelistErr, panelistRows) => {

            if(panelistErr){
                return callback(panelistErr);
            }

            const evaluationsRequired =
                Number(panelistRows[0]?.panelist_count || 0);

            const evaluationsSql = `
                SELECT
                    dpe.id,
                    dpe.schedule_id,
                    dpe.panelist_id,
                    dpe.score,
                    dpe.panel_result,
                    dpe.comments,
                    dpe.recommendations,
                    dpe.approved_title_id,
                    dpe.concept_evaluation_details,
                    dpe.outline_evaluation_details
                FROM defense_panel_evaluations dpe
                WHERE dpe.schedule_id = ?
            `;

            db.query(evaluationsSql, [scheduleId], (evalErr, evaluations) => {

                if(evalErr){
                    return callback(evalErr);
                }

                const evaluationsSubmitted =
                    (evaluations || []).length;

                if(
                    evaluationsRequired <= 0
                    || evaluationsSubmitted < evaluationsRequired
                ){

                    return callback(null, {
                        complete:false,
                        evaluations_required:evaluationsRequired,
                        evaluations_submitted:evaluationsSubmitted
                    });

                }

                const compiledResult =
                    aggregateCompiledPanelResult(evaluations);

                const compiledScore =
                    aggregateCompiledScore(evaluations);

                const compiledApprovedTitleId =
                    pickCompiledApprovedTitleId(evaluations);

                const compiledComments =
                    (evaluations || [])
                    .map((row, index) =>
                        `Panelist ${index + 1}: ${row.comments || "None"}`
                    )
                    .join("\n");

                const compiledRecommendations =
                    (evaluations || [])
                    .map((row, index) =>
                        `Panelist ${index + 1}: ${row.recommendations || "None"}`
                    )
                    .join("\n");

                const compiledConceptDetails =
                    (evaluations || [])
                    .map(row => row.concept_evaluation_details)
                    .find(value => value) || null;

                const compiledOutlineDetails =
                    (evaluations || [])
                    .map(row => row.outline_evaluation_details)
                    .find(value => value) || null;

                const updateScheduleSql = `
                    UPDATE defense_schedules
                    SET
                        score = ?,
                        panel_result = ?,
                        comments = ?,
                        recommendations = ?,
                        approved_title_id = ?,
                        concept_evaluation_details = ?,
                        outline_evaluation_details = ?,
                        defense_status = 'Completed'
                    WHERE id = ?
                `;

                db.query(
                    updateScheduleSql,
                    [
                        compiledScore,
                        compiledResult,
                        compiledComments,
                        compiledRecommendations,
                        compiledApprovedTitleId,
                        compiledConceptDetails,
                        compiledOutlineDetails,
                        scheduleId
                    ],
                    (updateErr) => {

                        if(updateErr){
                            return callback(updateErr);
                        }

                        const nextStage =
                            getGroupStageAfterDefense(
                                schedule.defense_type,
                                compiledResult
                            );

                        const finishGroupUpdate = () => {

                            const membersSql = `
                                SELECT student_id
                                FROM group_members
                                WHERE group_id = ?
                            `;

                            db.query(
                                membersSql,
                                [schedule.group_id],
                                (memberErr, memberRows) => {

                                    if(!memberErr && memberRows){

                                        let studentMsg = `Your ${schedule.defense_type} panel evaluations are complete. Final result: ${compiledResult}.`;
                                        if (compiledResult === "Conditional Passed" || compiledResult === "Conditional Pass" || compiledResult === "For Re-Defense") {
                                            studentMsg += ` Feedback: ${compiledComments}\nRecommendations: ${compiledRecommendations}`;
                                        }

                                        insertUserNotificationsByDbIds(
                                            memberRows.map(row => row.student_id),
                                            "Defense Evaluation Complete",
                                            studentMsg,
                                            "Defense Evaluation"
                                        );

                                    }

                                    if(schedule.created_by){

                                        let instructorMsg = `All panelists submitted evaluations for ${schedule.defense_type}. Final result: ${compiledResult}.`;
                                        if (compiledResult === "Conditional Passed" || compiledResult === "Conditional Pass" || compiledResult === "For Re-Defense") {
                                            instructorMsg += ` Please create schedule again.`;
                                        }

                                        insertUserNotificationsByDbIds(
                                            [schedule.created_by],
                                            "Panel Evaluations Complete",
                                            instructorMsg,
                                            "Defense Evaluation"
                                        );

                                    }

                                    callback(null, {
                                        complete:true,
                                        evaluations_required:evaluationsRequired,
                                        evaluations_submitted:evaluationsSubmitted,
                                        panel_result:compiledResult,
                                        score:compiledScore
                                    });

                                }
                            );

                        };

                        if(!nextStage){
                            return finishGroupUpdate();
                        }

                        const progressPercent =
                            getProgressPercentForStage(nextStage);

                        const updateGroupSql = `
                            UPDATE capstone_groups
                            SET
                                stage = ?,
                                progress = ?
                            WHERE id = ?
                        `;

                        db.query(
                            updateGroupSql,
                            [
                                nextStage,
                                progressPercent,
                                schedule.group_id
                            ],
                            (groupErr) => {

                                if(groupErr){
                                    console.log(groupErr);
                                }

                                finishGroupUpdate();

                            }
                        );

                    }
                );

            });

        });

    });

}

app.get("/defense-panel-evaluations/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    if(!scheduleId){

        return res.json({
            success:false,
            message:"Missing schedule ID."
        });

    }

    const panelistsSql = `
        SELECT COUNT(*) AS panelist_count
        FROM defense_schedule_panelists
        WHERE schedule_id = ?
    `;

    db.query(panelistsSql, [scheduleId], (panelistErr, panelistRows) => {

        if(panelistErr){
            console.log(panelistErr);

            return res.json({
                success:false,
                message:"Failed to count assigned panelists."
            });
        }

        const evaluationsRequired =
            Number(panelistRows[0]?.panelist_count || 0);

        const evaluationsSql = `
            SELECT
                dpe.id,
                dpe.schedule_id,
                dpe.panelist_id,
                dpe.score,
                dpe.panel_result,
                dpe.comments,
                dpe.recommendations,
                dpe.approved_title_id,
                dpe.concept_evaluation_details,
                dpe.outline_evaluation_details,
                dpe.evaluated_at,
                dpe.updated_at,

                u.user_id AS panelist_user_id,
                u.fullname AS panelist_name,
                u.position AS panelist_position,
                u.role AS panelist_role,
                u.digital_signature AS panelist_signature
            FROM defense_panel_evaluations dpe

            JOIN users u
                ON dpe.panelist_id = u.id

            WHERE dpe.schedule_id = ?

            ORDER BY dpe.evaluated_at ASC
        `;

        db.query(evaluationsSql, [scheduleId], (evalErr, evaluations) => {

            if(evalErr){
                console.log(evalErr);

                return res.json({
                    success:false,
                    message:"Failed to load panel evaluations."
                });
            }

            const evaluationsSubmitted =
                (evaluations || []).length;

            const scheduleSql = `
                SELECT
                    panel_result,
                    score,
                    defense_status,
                    defense_type
                FROM defense_schedules
                WHERE id = ?
                LIMIT 1
            `;

            db.query(scheduleSql, [scheduleId], (scheduleErr, scheduleRows) => {

                if(scheduleErr){
                    console.log(scheduleErr);

                    return res.json({
                        success:false,
                        message:"Failed to load defense schedule."
                    });
                }

                const schedule =
                    scheduleRows[0] || {};

                const evaluationsComplete =
                    evaluationsRequired > 0
                    && evaluationsSubmitted >= evaluationsRequired;

                res.json({
                    success:true,
                    evaluations_required:evaluationsRequired,
                    evaluations_submitted:evaluationsSubmitted,
                    evaluations_complete:evaluationsComplete,
                    panel_result:evaluationsComplete
                        ? schedule.panel_result
                        : "Pending",
                    score:evaluationsComplete
                        ? schedule.score
                        : null,
                    panel_evaluations:evaluations || []
                });

            });

        });

    });

});

app.put("/submit-defense-evaluation/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    const {
        panelistUserId,
        score,
        panel_result,
        comments,
        recommendations,
        approved_title_id,
        concept_evaluation_details,
        outline_evaluation_details
    } = req.body;

    if(!scheduleId){

        return res.json({
            success:false,
            message:"Missing schedule ID."
        });

    }

    if(!panelistUserId){

        return res.json({
            success:false,
            message:"Missing panelist account. Please log in again."
        });

    }

    if(!panel_result){

        return res.json({
            success:false,
            message:"Please select a panel result."
        });

    }

    if((panel_result === "Conditional Passed" || panel_result === "Conditional Pass" || panel_result === "For Re-Defense") && (!comments || String(comments).trim() === "")){

        return res.json({
            success:false,
            message:`Comments and feedback are required when the result is "${panel_result}".`
        });

    }

    const isScoreOptional = panel_result === "Conditional Passed" || panel_result === "Conditional Pass" || panel_result === "For Re-Defense";
    if(!isScoreOptional && (score === undefined || score === null || String(score).trim() === "")){

        return res.json({
            success:false,
            message:"Please enter a score or complete the grading sheet."
        });

    }

    const panelistSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND panelist_access = 1
        LIMIT 1
    `;

    db.query(panelistSql, [panelistUserId], (panelistErr, panelistRows) => {

        if(panelistErr){
            console.log(panelistErr);

            return res.json({
                success:false,
                message:"Failed to verify panelist account."
            });
        }

        if(!panelistRows || panelistRows.length === 0){

            return res.json({
                success:false,
                message:"Panelist account not found or panelist access is disabled."
            });

        }

        const panelistDbId =
            panelistRows[0].id;

        const assignmentSql = `
            SELECT id
            FROM defense_schedule_panelists
            WHERE schedule_id = ?
            AND panelist_id = ?
            LIMIT 1
        `;

        db.query(
            assignmentSql,
            [scheduleId, panelistDbId],
            (assignmentErr, assignmentRows) => {

                if(assignmentErr){
                    console.log(assignmentErr);

                    return res.json({
                        success:false,
                        message:"Failed to verify panel assignment."
                    });
                }

                if(!assignmentRows || assignmentRows.length === 0){

                    return res.json({
                        success:false,
                        message:"You are not assigned as a panelist for this defense schedule."
                    });

                }

                const scheduleSql = `
                    SELECT
                        id,
                        group_id,
                        defense_type,
                        defense_status,
                        created_by
                    FROM defense_schedules
                    WHERE id = ?
                    LIMIT 1
                `;

                db.query(scheduleSql, [scheduleId], (scheduleErr, scheduleRows) => {

                    if(scheduleErr || !scheduleRows || scheduleRows.length === 0){

                        return res.json({
                            success:false,
                            message:"Defense schedule not found."
                        });

                    }

                    const schedule =
                        scheduleRows[0];

                    if(schedule.defense_status === "Cancelled"){

                        return res.json({
                            success:false,
                            message:"This defense schedule was cancelled."
                        });

                    }

                    const upsertSql = `
                        INSERT INTO defense_panel_evaluations
                        (
                            schedule_id,
                            panelist_id,
                            score,
                            panel_result,
                            comments,
                            recommendations,
                            approved_title_id,
                            concept_evaluation_details,
                            outline_evaluation_details
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            score = VALUES(score),
                            panel_result = VALUES(panel_result),
                            comments = VALUES(comments),
                            recommendations = VALUES(recommendations),
                            approved_title_id = VALUES(approved_title_id),
                            concept_evaluation_details = VALUES(concept_evaluation_details),
                            outline_evaluation_details = VALUES(outline_evaluation_details),
                            updated_at = CURRENT_TIMESTAMP
                    `;

                    db.query(
                        upsertSql,
                        [
                            scheduleId,
                            panelistDbId,
                            String(score),
                            panel_result,
                            comments || "",
                            recommendations || "",
                            approved_title_id || null,
                            concept_evaluation_details || null,
                            outline_evaluation_details || null
                        ],
                        (upsertErr) => {

                            if(upsertErr){
                                console.log(upsertErr);

                                return res.json({
                                    success:false,
                                    message:"Failed to save panel evaluation."
                                });
                            }

                            const countSql = `
                                SELECT COUNT(*) AS evaluation_count
                                FROM defense_panel_evaluations
                                WHERE schedule_id = ?
                            `;

                            db.query(countSql, [scheduleId], (countErr, countRows) => {

                                if(countErr){
                                    console.log(countErr);

                                    return res.json({
                                        success:false,
                                        message:"Evaluation saved, but progress could not be refreshed."
                                    });
                                }

                                const panelistsCountSql = `
                                    SELECT COUNT(*) AS panelist_count
                                    FROM defense_schedule_panelists
                                    WHERE schedule_id = ?
                                `;

                                db.query(
                                    panelistsCountSql,
                                    [scheduleId],
                                    (panelCountErr, panelCountRows) => {

                                        const evaluationsSubmitted =
                                            Number(countRows[0]?.evaluation_count || 0);

                                        const evaluationsRequired =
                                            Number(panelCountRows[0]?.panelist_count || 0);

                                        if(schedule.created_by){

                                            insertUserNotificationsByDbIds(
                                                [schedule.created_by],
                                                "Panel Evaluation Submitted",
                                                `${panelistRows[0].fullname} submitted a panel evaluation (${evaluationsSubmitted}/${evaluationsRequired}) for ${schedule.defense_type}.`,
                                                "Defense Evaluation"
                                            );

                                        }

                                        finalizeDefenseScheduleIfComplete(
                                            scheduleId,
                                            (finalizeErr, finalizeResult) => {

                                                if(finalizeErr){
                                                    console.log(finalizeErr);

                                                    return res.json({
                                                        success:true,
                                                        message:"Your evaluation was saved, but the system could not finalize the defense schedule.",
                                                        evaluations_submitted:evaluationsSubmitted,
                                                        evaluations_required:evaluationsRequired,
                                                        evaluations_complete:false
                                                    });
                                                }

                                                if(finalizeResult && finalizeResult.complete){

                                                    return res.json({
                                                        success:true,
                                                        message:"Evaluation saved. All panel evaluations are complete and the defense has been finalized.",
                                                        evaluations_submitted:evaluationsSubmitted,
                                                        evaluations_required:evaluationsRequired,
                                                        evaluations_complete:true,
                                                        panel_result:finalizeResult.panel_result,
                                                        score:finalizeResult.score
                                                    });

                                                }

                                                res.json({
                                                    success:true,
                                                    message:`Evaluation saved successfully (${evaluationsSubmitted}/${evaluationsRequired} panel evaluations received).`,
                                                    evaluations_submitted:evaluationsSubmitted,
                                                    evaluations_required:evaluationsRequired,
                                                    evaluations_complete:false
                                                });

                                            }
                                        );

                                    }
                                );

                            });

                        }
                    );

                });

            }
        );

    });

});

/* ================= INSTRUCTOR DOCUMENT REVIEW DATA ================= */

app.get("/instructor-document-review/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const instructorSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            position,
            program,
            adviser_access,
            panelist_access,
            instructor_access,
            digital_signature
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [userId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check instructor account."
            });
        }

        if(instructorResult.length === 0){

            return res.json({
                success:false,
                message:"Instructor account not found or instructor access is disabled."
            });

        }

        const instructor =
            instructorResult[0];

        const instructorDbId =
            instructor.id;

        const receivedSql = `
            SELECT
                ds.id AS submission_id,
                ds.submission_message,
                ds.submission_status,
                ds.sent_at,

                ds.review_status,
                ds.review_comment,
                ds.reviewed_at,

                sd.id AS document_id,
                sd.document_code,
                sd.document_title,
                sd.document_type,
                sd.file_name,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,
                sd.document_status,

                sender.id AS sender_db_id,
                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name,
                sender.program AS sender_program,
                sender.year_level AS sender_year_level,

                cg.group_id,
                cg.group_name,
                cg.project_title,
                cg.program AS group_program,

                reviewer.fullname AS reviewer_name

            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            JOIN users sender
                ON ds.sender_id = sender.id

            LEFT JOIN group_members gm
                ON sender.id = gm.student_id

            LEFT JOIN capstone_groups cg
                ON gm.group_id = cg.id

            LEFT JOIN users reviewer
                ON ds.reviewed_by = reviewer.id

            WHERE ds.receiver_id = ?

            ORDER BY ds.sent_at DESC
        `;

        db.query(receivedSql, [instructorDbId], (err, receivedDocuments) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load received documents."
                });
            }

            const recipientsSql = `
                SELECT
                    id,
                    user_id,
                    fullname,
                    role,
                    position,
                    program,
                    year_level
                FROM users
                WHERE role IN ('student', 'faculty', 'admin')
                AND user_id != ?
                ORDER BY role ASC, fullname ASC
            `;

            db.query(recipientsSql, [userId], (err, recipients) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load recipients."
                    });
                }

                const sentSql = `
                    SELECT
                        fds.id AS submission_id,
                        fds.submission_message,
                        fds.submission_status,
                        fds.sent_at,

                        fd.id AS document_id,
                        fd.document_code,
                        fd.document_title,
                        fd.document_type,
                        fd.file_name,
                        fd.file_path,
                        fd.file_format,

                        receiver.user_id AS receiver_user_id,
                        receiver.fullname AS receiver_name,
                        receiver.role AS receiver_role,
                        receiver.program AS receiver_program,
                        receiver.year_level AS receiver_year_level

                    FROM faculty_document_submissions fds

                    JOIN faculty_documents fd
                        ON fds.document_id = fd.id

                    JOIN users receiver
                        ON fds.receiver_id = receiver.id

                    WHERE fds.sender_id = ?

                    ORDER BY fds.sent_at DESC
                `;

                db.query(sentSql, [instructorDbId], (err, sentDocuments) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to load sent documents."
                        });
                    }

                    const pendingCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Pending Review"
                        ).length;

                    const approvedCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Approved"
                        ).length;

                    const subjectToChangeCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Subject to Change"
                        ).length;

                    res.json({
                        success:true,
                        instructor,
                        stats:{
                            receivedDocuments:receivedDocuments.length,
                            sentDocuments:sentDocuments.length,
                            pendingCount,
                            approvedCount,
                            subjectToChangeCount
                        },
                        receivedDocuments,
                        sentDocuments,
                        recipients
                    });

                });

            });

        });

    });

});


/* ================= INSTRUCTOR SEND DOCUMENT ================= */

app.post("/instructor-send-document", studentDocumentUpload.single("documentFile"), (req, res) => {

    const {
        instructorUserId,
        documentTitle,
        documentType,
        recipientIds,
        message
    } = req.body;

    if(
        !instructorUserId ||
        !documentTitle ||
        !documentType ||
        !recipientIds ||
        !req.file
    ){
        return res.json({
            success:false,
            message:"Please complete all required fields and attach a document."
        });
    }

    let selectedRecipients = [];

    try{

        selectedRecipients =
            JSON.parse(recipientIds);

    }catch(error){

        return res.json({
            success:false,
            message:"Invalid recipient list."
        });

    }

    if(selectedRecipients.length === 0){

        return res.json({
            success:false,
            message:"Please select at least one recipient."
        });

    }

    const instructorSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check instructor account."
            });
        }

        if(instructorResult.length === 0){

            return res.json({
                success:false,
                message:"Instructor account not found or instructor access is disabled."
            });

        }

        const instructorDbId =
            instructorResult[0].id;

        const instructorName =
            instructorResult[0].fullname;

        const documentCode =
            "FDOC" + Date.now();

        const filePath =
            "/uploads/" + req.file.filename;

        const fileFormat =
            req.file.mimetype;

        const insertDocumentSql = `
            INSERT INTO faculty_documents
            (
                document_code,
                uploaded_by,
                document_title,
                document_type,
                file_name,
                file_path,
                file_format,
                document_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Sent')
        `;

        db.query(
            insertDocumentSql,
            [
                documentCode,
                instructorDbId,
                documentTitle,
                documentType,
                req.file.originalname,
                filePath,
                fileFormat
            ],
            (err, documentResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to save uploaded document."
                    });
                }

                const documentDbId =
                    documentResult.insertId;

                const submissionValues =
                    selectedRecipients.map(receiverId => [
                        documentDbId,
                        instructorDbId,
                        receiverId,
                        message || "",
                        "Sent"
                    ]);

                const insertSubmissionSql = `
                    INSERT INTO faculty_document_submissions
                    (
                        document_id,
                        sender_id,
                        receiver_id,
                        submission_message,
                        submission_status
                    )
                    VALUES ?
                `;

                db.query(insertSubmissionSql, [submissionValues], (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Document uploaded but failed to send to recipients."
                        });
                    }

                    const notificationValues =
                        selectedRecipients.map(receiverId => [
                            receiverId,
                            "Document Received",
                            `${instructorName} sent you a document titled "${documentTitle}".`,
                            "Document"
                        ]);

                    const notifySql = `
                        INSERT INTO user_notifications
                        (
                            user_id,
                            notification_title,
                            notification_message,
                            notification_type
                        )
                        VALUES ?
                    `;

                    db.query(notifySql, [notificationValues], (err) => {

                        if(err){
                            console.log(err);
                        }

                        res.json({
                            success:true,
                            message:"Document sent successfully."
                        });

                    });

                });

            }
        );

    });

});


/* ================= REVIEW STUDENT DOCUMENT ================= */

app.put("/review-student-document/:submissionId", (req, res) => {

    const submissionId =
        req.params.submissionId;

    const {
        instructorUserId,
        reviewStatus,
        reviewComment,
        otherStatus
    } = req.body;

    if(
        !submissionId ||
        !instructorUserId ||
        !reviewStatus
    ){
        return res.json({
            success:false,
            message:"Missing review information."
        });
    }

    const finalStatus =
        reviewStatus === "Other"
        ? otherStatus
        : reviewStatus;

    if(!finalStatus){

        return res.json({
            success:false,
            message:"Please provide the review status."
        });

    }

    const instructorSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check instructor account."
            });
        }

        if(instructorResult.length === 0){

            return res.json({
                success:false,
                message:"Instructor account not found or instructor access is disabled."
            });

        }

        const instructorDbId =
            instructorResult[0].id;

        const instructorName =
            instructorResult[0].fullname;

        const submissionSql = `
            SELECT
                ds.id,
                ds.sender_id,
                ds.receiver_id,
                ds.document_id,

                sd.document_title,
                sd.document_type,
                sd.document_status

            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(
            submissionSql,
            [
                submissionId,
                instructorDbId
            ],
            (err, submissionResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to check document submission."
                    });
                }

                if(submissionResult.length === 0){

                    return res.json({
                        success:false,
                        message:"Document submission not found or you are not the assigned receiver."
                    });

                }

                const submission =
                    submissionResult[0];

                const updateSql = `
                    UPDATE document_submissions
                    SET
                        review_status = ?,
                        review_comment = ?,
                        reviewed_by = ?,
                        reviewed_at = NOW(),
                        submission_status = 'Reviewed'
                    WHERE id = ?
                    AND receiver_id = ?
                `;

                db.query(
                    updateSql,
                    [
                        finalStatus,
                        reviewComment || "",
                        instructorDbId,
                        submissionId,
                        instructorDbId
                    ],
                    (err) => {

                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Failed to submit document review."
                            });
                        }

                        const finishReview = () => {

                            const notifySql = `
                                INSERT INTO user_notifications
                                (
                                    user_id,
                                    notification_title,
                                    notification_message,
                                    notification_type
                                )
                                VALUES (?, ?, ?, 'Document Review')
                            `;

                            db.query(
                                notifySql,
                                [
                                    submission.sender_id,
                                    "Document Review Updated",
                                    `${instructorName} reviewed your "${submission.document_title}" document. Status: ${finalStatus}. Comment: ${reviewComment || "No comment provided."}`
                                ],
                                (err2) => {

                                    if(err2){
                                        console.log(err2);
                                    }

                                    res.json({
                                        success:true,
                                        message:"Document review submitted and student was notified."
                                    });

                                }
                            );

                        };

                        if(
                            finalStatus === "For Revision"
                            || finalStatus === "Rejected"
                            || finalStatus === "Subject to Change"
                        ){

                            const revisionSql = `
                                UPDATE student_documents
                                SET document_status = ?
                                WHERE id = ?
                                AND document_status != 'Approved'
                            `;

                            const revisionStatus =
                                finalStatus === "Rejected"
                                ? "Rejected"
                                : "For Revision";

                            return db.query(
                                revisionSql,
                                [revisionStatus, submission.document_id],
                                (err2) => {

                                    if(err2){
                                        console.log(err2);
                                    }

                                    finishReview();

                                }
                            );

                        }

                        finishReview();

                    }
                );

            }
        );

    });

});

/* ================= ADVISER DOCUMENTS DATA ================= */

app.get("/adviser-documents/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const adviserSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            position,
            program,
            adviser_access,
            panelist_access,
            instructor_access,
            digital_signature
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [userId], (err, adviserResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check adviser account."
            });
        }

        if(adviserResult.length === 0){

            return res.json({
                success:false,
                message:"Adviser account not found or adviser access is disabled."
            });

        }

        const adviser =
            adviserResult[0];

        const adviserDbId =
            adviser.id;

        const receivedSql = `
            SELECT
                ds.id AS submission_id,
                ds.submission_message,
                ds.submission_status,
                ds.sent_at,

                ds.review_status,
                ds.review_comment,
                ds.reviewed_at,

                sd.id AS document_id,
                sd.document_code,
                sd.document_title,
                sd.document_type,
                sd.file_name,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,
                sd.document_status,

                sender.id AS sender_db_id,
                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name,
                sender.program AS sender_program,
                sender.year_level AS sender_year_level,

                cg.group_id,
                cg.group_name,
                cg.project_title,
                cg.program AS group_program,

                reviewer.fullname AS reviewer_name

            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            JOIN users sender
                ON ds.sender_id = sender.id

            LEFT JOIN group_members gm
                ON sender.id = gm.student_id

            LEFT JOIN capstone_groups cg
                ON gm.group_id = cg.id

            LEFT JOIN users reviewer
                ON ds.reviewed_by = reviewer.id

            WHERE ds.receiver_id = ?

            ORDER BY ds.sent_at DESC
        `;

        db.query(receivedSql, [adviserDbId], (err, receivedDocuments) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to load received documents."
                });
            }

            const recipientsSql = `
                SELECT
                    id,
                    user_id,
                    fullname,
                    role,
                    position,
                    program,
                    year_level
                FROM users
                WHERE role IN ('student', 'faculty', 'admin')
                AND user_id != ?
                ORDER BY role ASC, fullname ASC
            `;

            db.query(recipientsSql, [userId], (err, recipients) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to load recipients."
                    });
                }

                const sentSql = `
                    SELECT
                        fds.id AS submission_id,
                        fds.submission_message,
                        fds.submission_status,
                        fds.sent_at,

                        fd.id AS document_id,
                        fd.document_code,
                        fd.document_title,
                        fd.document_type,
                        fd.file_name,
                        fd.file_path,
                        fd.file_format,

                        receiver.user_id AS receiver_user_id,
                        receiver.fullname AS receiver_name,
                        receiver.role AS receiver_role,
                        receiver.program AS receiver_program,
                        receiver.year_level AS receiver_year_level

                    FROM faculty_document_submissions fds

                    JOIN faculty_documents fd
                        ON fds.document_id = fd.id

                    JOIN users receiver
                        ON fds.receiver_id = receiver.id

                    WHERE fds.sender_id = ?

                    ORDER BY fds.sent_at DESC
                `;

                db.query(sentSql, [adviserDbId], (err, sentDocuments) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Failed to load sent documents."
                        });
                    }

                    const pendingCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Pending Review"
                        ).length;

                    const approvedCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Approved"
                        ).length;

                    const subjectToChangeCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Subject to Change"
                        ).length;

                    res.json({
                        success:true,
                        adviser,
                        stats:{
                            receivedDocuments:receivedDocuments.length,
                            sentDocuments:sentDocuments.length,
                            pendingCount,
                            approvedCount,
                            subjectToChangeCount
                        },
                        receivedDocuments,
                        sentDocuments,
                        recipients
                    });

                });

            });

        });

    });

});

/* ================= ADVISER SEND DOCUMENT ================= */

app.post("/adviser-send-document", studentDocumentUpload.single("documentFile"), (req, res) => {

    const {
        adviserUserId,
        documentTitle,
        documentType,
        recipientIds,
        message
    } = req.body;

    if(
        !adviserUserId ||
        !documentTitle ||
        !documentType ||
        !recipientIds ||
        !req.file
    ){
        return res.json({
            success:false,
            message:"Please complete all required fields and attach a document."
        });
    }

    let selectedRecipients = [];

    try{

        selectedRecipients =
            JSON.parse(recipientIds);

    }catch(error){

        return res.json({
            success:false,
            message:"Invalid recipient list."
        });

    }

    if(selectedRecipients.length === 0){

        return res.json({
            success:false,
            message:"Please select at least one recipient."
        });

    }

    const adviserSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [adviserUserId], (err, adviserResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check adviser account."
            });
        }

        if(adviserResult.length === 0){

            return res.json({
                success:false,
                message:"Adviser account not found or adviser access is disabled."
            });

        }

        const adviserDbId =
            adviserResult[0].id;

        const adviserName =
            adviserResult[0].fullname;

        const documentCode =
            "ADOC" + Date.now();

        const filePath =
            "/uploads/student_documents/" + req.file.filename;

        const fileFormat =
            req.file.mimetype;

        const insertDocumentSql = `
            INSERT INTO faculty_documents
            (
                document_code,
                uploaded_by,
                document_title,
                document_type,
                file_name,
                file_path,
                file_format,
                document_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Sent')
        `;

        db.query(
            insertDocumentSql,
            [
                documentCode,
                adviserDbId,
                documentTitle,
                documentType,
                req.file.originalname,
                filePath,
                fileFormat
            ],
            (err, documentResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to save uploaded document."
                    });
                }

                const documentDbId =
                    documentResult.insertId;

                const submissionValues =
                    selectedRecipients.map(receiverId => [
                        documentDbId,
                        adviserDbId,
                        receiverId,
                        message || "",
                        "Sent"
                    ]);

                const insertSubmissionSql = `
                    INSERT INTO faculty_document_submissions
                    (
                        document_id,
                        sender_id,
                        receiver_id,
                        submission_message,
                        submission_status
                    )
                    VALUES ?
                `;

                db.query(insertSubmissionSql, [submissionValues], (err) => {

                    if(err){
                        console.log(err);

                        return res.json({
                            success:false,
                            message:"Document uploaded but failed to send to recipients."
                        });
                    }

                    const notificationValues =
                        selectedRecipients.map(receiverId => [
                            receiverId,
                            "Document Received",
                            `${adviserName} sent you a document titled "${documentTitle}".`,
                            "Document"
                        ]);

                    const notifySql = `
                        INSERT INTO user_notifications
                        (
                            user_id,
                            notification_title,
                            notification_message,
                            notification_type
                        )
                        VALUES ?
                    `;

                    db.query(notifySql, [notificationValues], (err) => {

                        if(err){
                            console.log(err);
                        }

                        res.json({
                            success:true,
                            message:"Document sent successfully."
                        });

                    });

                });

            }
        );

    });

});

function isEnvironmentalScanningDoc(documentType, documentTitle) {
    const docType = String(documentType || "").toLowerCase();
    const docTitle = String(documentTitle || "").toLowerCase();
    return docType.includes("environmental scanning") || docTitle.includes("environmental scanning");
}

function isAdviserSigningDocumentType(documentType, documentTitle){

    const docType =
        String(documentType || "").toLowerCase();

    const docTitle =
        String(documentTitle || "").toLowerCase();

    return docType.includes("adviser acceptance")
        || docTitle.includes("adviser acceptance")
        || docType.includes("acceptance for advisory")
        || docTitle.includes("acceptance for advisory")
        || docType.includes("recommendation for concept")
        || docTitle.includes("recommendation for concept")
        || docType.includes("environmental scanning")
        || docTitle.includes("environmental scanning");

}

/* Acceptance for advisory = adviser signs THEN routes to Dean */
function isAdviserAcceptanceDoc(documentType, documentTitle){
    const docType  = String(documentType  || "").toLowerCase();
    const docTitle = String(documentTitle || "").toLowerCase();
    return docType.includes("adviser acceptance")
        || docTitle.includes("adviser acceptance")
        || docType.includes("acceptance for advisory")
        || docTitle.includes("acceptance for advisory");
}

/* Recommendation for concept presentation = adviser is the FINAL signer */
function isAdviserOnlyDoc(documentType, documentTitle){
    const docType  = String(documentType  || "").toLowerCase();
    const docTitle = String(documentTitle || "").toLowerCase();
    return docType.includes("recommendation for concept")
        || docTitle.includes("recommendation for concept");
}

function decodeSignatureImageData(signatureImage){

    const raw =
        String(signatureImage || "").trim();

    if(!raw){
        return null;
    }

    const base64 =
        raw.includes(",")
        ? raw.split(",")[1]
        : raw;

    return Buffer.from(base64, "base64");

}

async function embedSignatureOnPdfFile(sourcePath, signatureBuffer, placement){

    const existingPdfBytes =
        fs.readFileSync(sourcePath);

    const pdfDoc =
        await PDFDocument.load(existingPdfBytes);

    const pages =
        pdfDoc.getPages();

    const pageIndex =
        Math.max(0, Math.min(Number(placement.pageIndex || 0), pages.length - 1));

    const page =
        pages[pageIndex];

    const pageW =
        page.getWidth();

    const pageH =
        page.getHeight();

    const containerWidth =
        Number(placement.containerWidth || 1);

    const containerHeight =
        Number(placement.containerHeight || 1);

    const sigLeft =
        Number(placement.sigLeft || 0);

    const sigTop =
        Number(placement.sigTop || 0);

    const sigWidth =
        Number(placement.sigWidth || 120);

    const sigHeight =
        Number(placement.sigHeight || 50);

    const xRatio =
        sigLeft / containerWidth;

    const yRatio =
        sigTop / containerHeight;

    const wRatio =
        sigWidth / containerWidth;

    const hRatio =
        sigHeight / containerHeight;

    const drawW =
        pageW * wRatio;

    const drawH =
        pageH * hRatio;

    const drawX =
        pageW * xRatio;

    const drawY =
        pageH * (1 - yRatio - hRatio);

    const pngImage =
        await pdfDoc.embedPng(signatureBuffer);

    page.drawImage(pngImage, {
        x:drawX,
        y:drawY,
        width:drawW,
        height:drawH
    });

    return pdfDoc.save();

}

/* ================= ADVISER SIGNING DOCUMENT FILE ================= */

app.get("/adviser-signing-document-file/:submissionId", (req, res) => {

    const submissionId =
        req.params.submissionId;

    const adviserUserId =
        String(req.query.adviserUserId || "").trim();

    if(!submissionId || !adviserUserId){
        return res.status(400).json({
            success:false,
            message:"Missing submission or adviser information."
        });
    }

    const adviserSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [adviserUserId], (err, adviserResult) => {

        if(err){
            console.log(err);
            return res.status(500).json({
                success:false,
                message:"Failed to verify adviser account."
            });
        }

        if(adviserResult.length === 0){
            return res.status(403).json({
                success:false,
                message:"Adviser access denied."
            });
        }

        const adviserDbId =
            adviserResult[0].id;

        const submissionSql = `
            SELECT
                sd.file_path,
                sd.file_name,
                sd.file_format,
                sd.document_type,
                sd.document_title
            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(
            submissionSql,
            [submissionId, adviserDbId],
            (err2, rows) => {

                if(err2){
                    console.log(err2);
                    return res.status(500).json({
                        success:false,
                        message:"Failed to load signing document."
                    });
                }

                if(rows.length === 0){
                    return res.status(404).json({
                        success:false,
                        message:"Signing document not found."
                    });
                }

                const documentRow =
                    rows[0];

                if(!isAdviserSigningDocumentType(
                    documentRow.document_type,
                    documentRow.document_title
                )){
                    return res.status(400).json({
                        success:false,
                        message:"This submission is not an adviser e-signature document."
                    });
                }

                const relativePath =
                    String(documentRow.file_path || "")
                    .replace(/\\/g, "/")
                    .replace(/^\/+/, "");

                if(!relativePath){
                    return res.status(404).json({
                        success:false,
                        message:"Document file path is missing."
                    });
                }

                const absolutePath =
                    path.join(__dirname, relativePath);

                if(!fs.existsSync(absolutePath)){
                    console.log("Signing file missing:", absolutePath);
                    return res.status(404).json({
                        success:false,
                        message:"Document file was not found on the server."
                    });
                }

                const lowerName =
                    String(documentRow.file_name || relativePath).toLowerCase();

                if(
                    !lowerName.endsWith(".pdf")
                    && String(documentRow.file_format || "").toUpperCase() !== "PDF"
                ){
                    return res.status(400).json({
                        success:false,
                        message:"Only PDF files can be opened in the e-signature viewer."
                    });
                }

                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    `inline; filename="${path.basename(relativePath)}"`
                );

                return res.sendFile(absolutePath);

            }
        );

    });

});

/* ================= INSTRUCTOR SIGNING DOCUMENT FILE ================= */

app.get("/instructor-signing-document-file/:submissionId", (req, res) => {

    const submissionId =
        req.params.submissionId;

    const instructorUserId =
        String(req.query.instructorUserId || "").trim();

    if(!submissionId || !instructorUserId){
        return res.status(400).json({
            success:false,
            message:"Missing submission or instructor information."
        });
    }

    const instructorSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (err, instructorResult) => {

        if(err){
            console.log(err);
            return res.status(500).json({
                success:false,
                message:"Failed to verify instructor account."
            });
        }

        if(instructorResult.length === 0){
            return res.status(403).json({
                success:false,
                message:"Instructor access denied."
            });
        }

        const instructorDbId =
            instructorResult[0].id;

        const submissionSql = `
            SELECT
                sd.file_path,
                sd.signed_file_path,
                sd.file_name,
                sd.file_format,
                sd.document_type,
                sd.document_title
            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(
            submissionSql,
            [submissionId, instructorDbId],
            (err2, rows) => {

                if(err2){
                    console.log(err2);
                    return res.status(500).json({
                        success:false,
                        message:"Failed to load signing document."
                    });
                }

                if(rows.length === 0){
                    return res.status(404).json({
                        success:false,
                        message:"Signing document not found."
                    });
                }

                const documentRow =
                    rows[0];

                if(!isEnvironmentalScanningDoc(
                    documentRow.document_type,
                    documentRow.document_title
                )){
                    return res.status(400).json({
                        success:false,
                        message:"This submission is not an instructor e-signature document."
                    });
                }

                const chosenPath = documentRow.signed_file_path || documentRow.file_path;
                const relativePath =
                    String(chosenPath || "")
                    .replace(/\\/g, "/")
                    .replace(/^\/+/, "");

                if(!relativePath){
                    return res.status(404).json({
                        success:false,
                        message:"Document file path is missing."
                    });
                }

                const absolutePath =
                    path.join(__dirname, relativePath);

                if(!fs.existsSync(absolutePath)){
                    console.log("Signing file missing:", absolutePath);
                    return res.status(404).json({
                        success:false,
                        message:"Document file was not found on the server."
                    });
                }

                const lowerName =
                    String(documentRow.file_name || relativePath).toLowerCase();

                if(
                    !lowerName.endsWith(".pdf")
                    && String(documentRow.file_format || "").toUpperCase() !== "PDF"
                ){
                    return res.status(400).json({
                        success:false,
                        message:"Only PDF files can be opened in the e-signature viewer."
                    });
                }

                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    `inline; filename="${path.basename(relativePath)}"`
                );

                return res.sendFile(absolutePath);

            }
        );

    });

});

/* ================= INSTRUCTOR APPLY DOCUMENT SIGNATURE ================= */

app.put("/instructor-apply-document-signature/:submissionId", async (req, res) => {

    const submissionId =
        req.params.submissionId;

    const {
        instructorUserId,
        reviewStatus,
        reviewComment,
        signatureImage,
        signatureType,
        placement
    } = req.body;

    if(!submissionId || !instructorUserId || !reviewStatus){
        return res.json({
            success:false,
            message:"Missing signing information."
        });
    }

    const finalStatus =
        String(reviewStatus || "").trim();

    if(
        finalStatus === "Approved"
        && !placement
    ){
        return res.json({
            success:false,
            message:"Please place your e-signature on the document before approving."
        });
    }

    if(
        (finalStatus === "Rejected" || finalStatus === "Subject to Change" || finalStatus === "For Revision")
        && !String(reviewComment || "").trim()
    ){
        return res.json({
            success:false,
            message:"Please add notes explaining your decision."
        });
    }

    const instructorSql = `
        SELECT id, fullname, digital_signature
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], async (err, instructorResult) => {

        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to check instructor account."
            });
        }

        if(instructorResult.length === 0){
            return res.json({
                success:false,
                message:"Instructor account not found or access is disabled."
            });
        }

        const instructorDbId =
            instructorResult[0].id;

        const instructorName =
            instructorResult[0].fullname;

        const submissionSql = `
            SELECT
                ds.id,
                ds.sender_id,
                ds.document_id,

                sd.document_title,
                sd.document_type,
                sd.document_status,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,

                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name,
                cg.program AS group_program,
                sender.program AS sender_program

            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            JOIN users sender
                ON ds.sender_id = sender.id

            LEFT JOIN group_members gm
                ON sender.id = gm.student_id

            LEFT JOIN capstone_groups cg
                ON gm.group_id = cg.id

            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(
            submissionSql,
            [submissionId, instructorDbId],
            async (err2, submissionResult) => {

                if(err2){
                    console.log(err2);
                    return res.json({
                        success:false,
                        message:"Failed to check document submission."
                    });
                }

                if(submissionResult.length === 0){
                    return res.json({
                        success:false,
                        message:"Document submission not found or you are not the assigned receiver."
                    });
                }

                const submission =
                    submissionResult[0];

                if(!isEnvironmentalScanningDoc(
                    submission.document_type,
                    submission.document_title
                )){
                    return res.json({
                        success:false,
                        message:"This document is not an environmental scanning e-signature request."
                    });
                }

                let signedFilePath =
                    submission.signed_file_path || null;

                if(
                    (submission.document_status === 'Approved' || submission.document_status === 'Instructor Signed' || submission.document_status === 'Chairperson Signed')
                    && finalStatus !== 'Approved'
                ){
                    return res.json({
                        success: false,
                        message: 'This document has already been signed/approved. The decision cannot be changed.'
                    });
                }

                try{

                    if(finalStatus === "Approved"){

                        let signatureBuffer;
                        if (signatureType === "saved" && instructorResult[0].digital_signature) {
                            const localSigPath = path.join(__dirname, instructorResult[0].digital_signature.replace(/^\//, ""));
                            if (!fs.existsSync(localSigPath)) {
                                return res.json({
                                    success: false,
                                    message: "Saved signature file not found on the server. Please re-upload it in settings."
                                });
                            }
                            signatureBuffer = fs.readFileSync(localSigPath);
                        } else {
                            signatureBuffer = decodeSignatureImageData(signatureImage);
                        }

                        if(!signatureBuffer || signatureBuffer.length === 0){
                            return res.json({
                                success:false,
                                message:"Invalid signature image."
                            });
                        }

                        const srcRelative = submission.signed_file_path || submission.file_path;
                        const sourcePath =
                            path.join(
                                __dirname,
                                String(srcRelative || "").replace(/^\/uploads\//, "uploads/")
                            );

                        if(!fs.existsSync(sourcePath)){
                            return res.json({
                                success:false,
                                message:"Original document file was not found on the server."
                            });
                        }

                        const signedBytes =
                            await embedSignatureOnPdfFile(
                                sourcePath,
                                signatureBuffer,
                                placement
                            );

                        const signedDir =
                            path.join(__dirname, "uploads", "signed_documents");

                        if(!fs.existsSync(signedDir)){
                            fs.mkdirSync(signedDir, { recursive:true });
                        }

                        const signedFileName =
                            `signed-instructor-${Date.now()}-${submission.document_id}.pdf`;

                        const signedDiskPath =
                            path.join(signedDir, signedFileName);

                        fs.writeFileSync(signedDiskPath, signedBytes);

                        signedFilePath =
                            `/uploads/signed_documents/${signedFileName}`;

                    }

                }catch(signErr){
                    console.log(signErr);
                    return res.json({
                        success:false,
                        message:"Failed to apply e-signature to the PDF."
                    });
                }

                const revisionStatus =
                    finalStatus === "Rejected"
                    ? "Rejected"
                    : (
                        finalStatus === "Subject to Change"
                        || finalStatus === "For Revision"
                    )
                    ? "For Revision"
                    : finalStatus;

                const updateSubmissionSql = `
                    UPDATE document_submissions
                    SET
                        review_status = ?,
                        review_comment = ?,
                        reviewed_by = ?,
                        reviewed_at = NOW(),
                        submission_status = 'Reviewed'
                    WHERE id = ?
                    AND receiver_id = ?
                `;

                db.query(
                    updateSubmissionSql,
                    [
                        finalStatus,
                        reviewComment || "",
                        instructorDbId,
                        submissionId,
                        instructorDbId
                    ],
                    (err3) => {

                        if(err3){
                            console.log(err3);
                            return res.json({
                                success:false,
                                message:"Failed to save review status."
                            });
                        }

                        const updateDocumentSql =
                            (finalStatus === "Approved")
                            ? `
                                UPDATE student_documents
                                SET
                                    document_status = 'Instructor Signed',
                                    signed_file_path = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `
                            : `
                                UPDATE student_documents
                                SET
                                    document_status = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `;

                        const updateParams =
                            finalStatus === "Approved"
                            ? [signedFilePath, submission.document_id]
                            : [revisionStatus, submission.document_id];

                        db.query(
                            updateDocumentSql,
                            updateParams,
                            (err4) => {

                                if(err4){
                                    console.log(err4);
                                    return res.json({
                                        success:false,
                                        message:"Review saved, but failed to update student document."
                                    });
                                }

                                const proceedWithNotifications = () => {
                                    let notifyTitle, notifyMessage;
                                    if(finalStatus === 'Approved'){
                                        notifyTitle = 'Instructor Signed Environmental Scanning';
                                        notifyMessage = `${instructorName} (Instructor) signed your "${submission.document_title}" document. It has been forwarded to the Program Chairperson for review.`;
                                    } else if(finalStatus === 'Rejected'){
                                        notifyTitle = 'Document Rejected by Instructor';
                                        notifyMessage = `Your "${submission.document_title}" was rejected by ${instructorName} (Instructor). Reason: ${reviewComment || 'No reason provided.'}`;
                                    } else {
                                        notifyTitle = 'Instructor Requested Revision';
                                        notifyMessage = `${instructorName} (Instructor) requested a revision on your "${submission.document_title}". Notes: ${reviewComment || 'Please check the document and resubmit.'}`;
                                    }

                                    db.query(
                                        `
                                            INSERT INTO user_notifications
                                            (
                                                user_id,
                                                notification_title,
                                                notification_message,
                                                notification_type
                                            )
                                            VALUES (?, ?, ?, 'Document Review')
                                        `,
                                        [
                                            submission.sender_id,
                                            notifyTitle,
                                            notifyMessage
                                        ],
                                        (err5) => {
                                            if(err5){
                                                console.log(err5);
                                            }

                                            res.json({
                                                success: true,
                                                message:
                                                    finalStatus === 'Approved'
                                                    ? 'Document signed and forwarded to the Program Chairperson. Student notified.'
                                                    : 'Review submitted. Student notified.',
                                                signed_file_path: signedFilePath
                                            });
                                        }
                                    );
                                };

                                if (finalStatus === "Approved") {
                                    const prog = String(submission.group_program || submission.sender_program || "").toUpperCase();
                                    let chairPosition = 'Program Chairperson IT';
                                    if (prog.includes("IS")) {
                                        chairPosition = 'Program Chairperson IS';
                                    }

                                    const getChairSql = `
                                        SELECT id FROM users
                                        WHERE role = 'admin' AND position = ?
                                        LIMIT 1
                                    `;
                                    db.query(getChairSql, [chairPosition], (errChair, chairRows) => {
                                        if (errChair || !chairRows || chairRows.length === 0) {
                                            console.log("No Chairperson found for " + chairPosition, errChair);
                                            proceedWithNotifications();
                                        } else {
                                            const chairDbId = chairRows[0].id;
                                            db.query(
                                                `SELECT id FROM document_submissions WHERE document_id = ? AND receiver_id = ? LIMIT 1`,
                                                [submission.document_id, chairDbId],
                                                (errExist, existResult) => {
                                                    if (existResult && existResult.length > 0) {
                                                        db.query(
                                                            `UPDATE document_submissions
                                                             SET submission_message = ?, review_status = NULL, review_comment = NULL, reviewed_by = NULL, reviewed_at = NULL, submission_status = 'Sent', sent_at = NOW()
                                                             WHERE id = ?`,
                                                            ["Instructor signed. Pending Chairperson signature.", existResult[0].id],
                                                            () => {
                                                                db.query(
                                                                    `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                                                                     VALUES (?, ?, ?, 'Document Review')`,
                                                                    [chairDbId, "Environmental Scanning Pending Signature", `${instructorName} has signed the Environmental Scanning Form. It is now pending your signature.`, "Document Review"],
                                                                    () => {}
                                                                );
                                                                proceedWithNotifications();
                                                            }
                                                        );
                                                    } else {
                                                        db.query(
                                                            `INSERT INTO document_submissions (document_id, sender_id, receiver_id, submission_message)
                                                             VALUES (?, ?, ?, ?)`,
                                                             [submission.document_id, submission.sender_id, chairDbId, "Instructor signed. Pending Chairperson signature."],
                                                            () => {
                                                                db.query(
                                                                    `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                                                                     VALUES (?, ?, ?, 'Document Review')`,
                                                                    [chairDbId, "Environmental Scanning Pending Signature", `${instructorName} has signed the Environmental Scanning Form. It is now pending your signature.`, "Document Review"],
                                                                    () => {}
                                                                );
                                                                proceedWithNotifications();
                                                            }
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                    });
                                } else {
                                    proceedWithNotifications();
                                }

                            }
                        );

                    }
                );

            }
        );

    });

});

/* ================= ADMIN SIGNING DOCUMENT FILE ================= */

app.get("/admin-signing-document-file/:submissionId", (req, res) => {

    const submissionId = req.params.submissionId;
    const adminUserId = String(req.query.adminUserId || "").trim();

    if(!submissionId || !adminUserId){
        return res.status(400).json({
            success:false,
            message:"Missing submission or admin information."
        });
    }

    const adminSql = `
        SELECT id, position
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {
        if(err){
            console.log(err);
            return res.status(500).json({
                success:false,
                message:"Failed to verify admin account."
            });
        }

        if(adminResult.length === 0){
            return res.status(403).json({
                success:false,
                message:"Admin access denied."
            });
        }

        const positionLower = String(adminResult[0].position || "").toLowerCase();
        const isDean = positionLower === "dean";
        const isChairperson = positionLower.includes("program chairperson");

        if (!isDean && !isChairperson) {
            return res.status(403).json({
                success:false,
                message:"Only Dean or Program Chairperson can sign this document."
            });
        }

        const adminDbId = adminResult[0].id;

        /* For env scanning, the chairperson may not have a submission row yet — fetch by document_id instead */
        const submissionSql = `
            SELECT
                sd.file_path,
                sd.signed_file_path,
                sd.file_name,
                sd.file_format,
                sd.document_type,
                sd.document_title
            FROM document_submissions ds
            JOIN student_documents sd ON ds.document_id = sd.id
            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(submissionSql, [submissionId, adminDbId], (err2, rows) => {
            if(err2){
                console.log(err2);
                return res.status(500).json({
                    success:false,
                    message:"Failed to load signing document."
                });
            }

            if(rows.length === 0){
                return res.status(404).json({
                    success:false,
                    message:"Signing document not found."
                });
            }

            const documentRow = rows[0];
            console.log("[DEAN SIGNING FILE] signed_file_path:", documentRow.signed_file_path, "| file_path:", documentRow.file_path);
            const chosenPath = documentRow.signed_file_path || documentRow.file_path;
            console.log("[DEAN SIGNING FILE] chosenPath:", chosenPath);
            const relativePath = String(chosenPath || "")
                .replace(/\\/g, "/")
                .replace(/^\/+/, "");


            if(!relativePath){
                return res.status(404).json({
                    success:false,
                    message:"Document file path is missing."
                });
            }

            const absolutePath = path.join(__dirname, relativePath);

            if(!fs.existsSync(absolutePath)){
                console.log("Signing file missing:", absolutePath);
                return res.status(404).json({
                    success:false,
                    message:"Document file was not found on the server."
                });
            }

            const lowerName = String(documentRow.file_name || relativePath).toLowerCase();

            if(!lowerName.endsWith(".pdf") && String(documentRow.file_format || "").toUpperCase() !== "PDF"){
                return res.status(400).json({
                    success:false,
                    message:"Only PDF files can be opened in the e-signature viewer."
                });
            }

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${path.basename(relativePath)}"`);

            return res.sendFile(absolutePath);
        });
    });
});

/* ================= ADVISER APPLY DOCUMENT SIGNATURE ================= */

app.put("/adviser-apply-document-signature/:submissionId", async (req, res) => {

    const submissionId =
        req.params.submissionId;

    const {
        adviserUserId,
        reviewStatus,
        reviewComment,
        signatureImage,
        signatureType,
        placement
    } = req.body;

    if(!submissionId || !adviserUserId || !reviewStatus){
        return res.json({
            success:false,
            message:"Missing signing information."
        });
    }

    const finalStatus =
        String(reviewStatus || "").trim();

    if(
        finalStatus === "Approved"
        && !placement
    ){
        return res.json({
            success:false,
            message:"Please place your e-signature on the document before approving."
        });
    }

    if(
        (finalStatus === "Rejected" || finalStatus === "Subject to Change" || finalStatus === "For Revision")
        && !String(reviewComment || "").trim()
    ){
        return res.json({
            success:false,
            message:"Please add notes explaining your decision."
        });
    }

    const adviserSql = `
        SELECT id, fullname, digital_signature
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [adviserUserId], async (err, adviserResult) => {

        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to check adviser account."
            });
        }

        if(adviserResult.length === 0){
            return res.json({
                success:false,
                message:"Adviser account not found or adviser access is disabled."
            });
        }

        const adviserDbId =
            adviserResult[0].id;

        const adviserName =
            adviserResult[0].fullname;

        const submissionSql = `
            SELECT
                ds.id,
                ds.sender_id,
                ds.document_id,

                sd.document_title,
                sd.document_type,
                sd.document_status,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,

                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name

            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            JOIN users sender
                ON ds.sender_id = sender.id

            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(
            submissionSql,
            [submissionId, adviserDbId],
            async (err2, submissionResult) => {

                if(err2){
                    console.log(err2);
                    return res.json({
                        success:false,
                        message:"Failed to check document submission."
                    });
                }

                if(submissionResult.length === 0){
                    return res.json({
                        success:false,
                        message:"Document submission not found or you are not the assigned receiver."
                    });
                }

                const submission =
                    submissionResult[0];

                if(!isAdviserSigningDocumentType(
                    submission.document_type,
                    submission.document_title
                )){
                    return res.json({
                        success:false,
                        message:"This document is not an adviser e-signature request."
                    });
                }

                let signedFilePath =
                    submission.signed_file_path || null;

                /* ── Lock: if the document is already Approved or Adviser Signed (waiting for Dean),
                   the adviser cannot retroactively change their verdict ── */
                if(
                    (submission.document_status === 'Approved' || submission.document_status === 'Adviser Signed')
                    && finalStatus !== 'Approved'
                ){
                    const isRecoDoc = isAdviserOnlyDoc(submission.document_type, submission.document_title);
                    return res.json({
                        success: false,
                        message: submission.document_status === 'Approved'
                            ? (isRecoDoc
                                ? 'This document has already been signed and fully approved by you. The verdict cannot be changed.'
                                : 'This document has already been fully approved by the Dean. The verdict cannot be changed.')
                            : 'You have already signed this document. It is now waiting for the Dean. You cannot change your decision.'
                    });
                }

                try{


                    if(finalStatus === "Approved"){

                        let signatureBuffer;
                        if (signatureType === "saved" && adviserResult[0].digital_signature) {
                            const localSigPath = path.join(__dirname, adviserResult[0].digital_signature.replace(/^\//, ""));
                            if (!fs.existsSync(localSigPath)) {
                                return res.json({
                                    success: false,
                                    message: "Saved signature file not found on the server. Please re-upload it in settings."
                                });
                            }
                            signatureBuffer = fs.readFileSync(localSigPath);
                        } else {
                            signatureBuffer = decodeSignatureImageData(signatureImage);
                        }

                        if(!signatureBuffer || signatureBuffer.length === 0){
                            return res.json({
                                success:false,
                                message:"Invalid signature image."
                            });
                        }

                        const sourcePath =
                            path.join(
                                __dirname,
                                String(submission.file_path || "").replace(/^\/uploads\//, "uploads/")
                            );

                        if(!fs.existsSync(sourcePath)){
                            return res.json({
                                success:false,
                                message:"Original document file was not found on the server."
                            });
                        }

                        const signedBytes =
                            await embedSignatureOnPdfFile(
                                sourcePath,
                                signatureBuffer,
                                placement
                            );

                        const signedDir =
                            path.join(__dirname, "uploads", "signed_documents");

                        if(!fs.existsSync(signedDir)){
                            fs.mkdirSync(signedDir, { recursive:true });
                        }

                        const signedFileName =
                            `signed-${Date.now()}-${submission.document_id}.pdf`;

                        const signedDiskPath =
                            path.join(signedDir, signedFileName);

                        fs.writeFileSync(signedDiskPath, signedBytes);

                        signedFilePath =
                            `/uploads/signed_documents/${signedFileName}`;

                    }

                }catch(signErr){
                    console.log(signErr);
                    return res.json({
                        success:false,
                        message:"Failed to apply e-signature to the PDF."
                    });
                }

                const revisionStatus =
                    finalStatus === "Rejected"
                    ? "Rejected"
                    : (
                        finalStatus === "Subject to Change"
                        || finalStatus === "For Revision"
                    )
                    ? "For Revision"
                    : finalStatus;

                const updateSubmissionSql = `
                    UPDATE document_submissions
                    SET
                        review_status = ?,
                        review_comment = ?,
                        reviewed_by = ?,
                        reviewed_at = NOW(),
                        submission_status = 'Reviewed'
                    WHERE id = ?
                    AND receiver_id = ?
                `;

                db.query(
                    updateSubmissionSql,
                    [
                        finalStatus,
                        reviewComment || "",
                        adviserDbId,
                        submissionId,
                        adviserDbId
                    ],
                    (err3) => {

                        if(err3){
                            console.log(err3);
                            return res.json({
                                success:false,
                                message:"Failed to save review status."
                            });
                        }

                        const isAcceptanceDoc = isAdviserAcceptanceDoc(
                            submission.document_type,
                            submission.document_title
                        );
                        const isRecommendationDoc = isAdviserOnlyDoc(
                            submission.document_type,
                            submission.document_title
                        );

                        const updateDocumentSql =
                            (finalStatus === "Approved")
                            ? (isAcceptanceDoc
                                ? `
                                    UPDATE student_documents
                                    SET
                                        document_status = 'Adviser Signed',
                                        signed_file_path = ?,
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                `
                                : `
                                    UPDATE student_documents
                                    SET
                                        document_status = 'Approved',
                                        signed_file_path = ?,
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                `)
                            : `
                                UPDATE student_documents
                                SET
                                    document_status = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `;

                        const updateParams =
                            finalStatus === "Approved"
                            ? [signedFilePath, submission.document_id]
                            : [revisionStatus, submission.document_id];

                        db.query(
                            updateDocumentSql,
                            updateParams,
                            (err4) => {

                                if(err4){
                                    console.log(err4);
                                    return res.json({
                                        success:false,
                                        message:"Review saved, but failed to update student document."
                                    });
                                }

                                const proceedWithNotifications = () => {
                                    let notifyTitle, notifyMessage;
                                    if(finalStatus === 'Approved'){
                                        notifyTitle = isRecommendationDoc
                                            ? 'Adviser Signed Recommendation Document'
                                            : 'Adviser Signed Your Document';
                                        notifyMessage = isRecommendationDoc
                                            ? `${adviserName} (Adviser) signed and approved your "${submission.document_title}" document. It is now fully approved. ${reviewComment ? 'Notes: ' + reviewComment : ''}`
                                            : `${adviserName} (Adviser) signed your "${submission.document_title}" document. It has been forwarded to the Dean for final approval. ${reviewComment ? 'Notes: ' + reviewComment : ''}`;
                                    } else if(finalStatus === 'Rejected'){
                                        notifyTitle = 'Document Rejected by Adviser';
                                        notifyMessage = `Your "${submission.document_title}" was rejected by ${adviserName} (Adviser). Reason: ${reviewComment || 'No reason provided.'} Please review and resubmit if needed.`;
                                    } else {
                                        notifyTitle = 'Adviser Requested Revision';
                                        notifyMessage = `${adviserName} (Adviser) requested a revision on your "${submission.document_title}". Notes: ${reviewComment || 'Please check the document and resubmit.'}`;
                                    }

                                    db.query(
                                        `
                                            INSERT INTO user_notifications
                                            (
                                                user_id,
                                                notification_title,
                                                notification_message,
                                                notification_type
                                            )
                                            VALUES (?, ?, ?, 'Document Review')
                                        `,
                                        [
                                            submission.sender_id,
                                            notifyTitle,
                                            notifyMessage
                                        ],
                                        (err5) => {
                                            if(err5){
                                                console.log(err5);
                                            }

                                            res.json({
                                                success: true,
                                                message:
                                                    finalStatus === 'Approved'
                                                    ? (isRecommendationDoc ? 'Recommendation document signed and fully approved. Student notified.' : isAcceptanceDoc ? 'Document signed and forwarded to the Dean. Student has been notified.' : 'Document signed and returned to the student.')
                                                    : finalStatus === 'Rejected'
                                                    ? 'Document rejected. Student has been notified with your reason.'
                                                    : 'Revision requested. Student has been notified.',
                                                signed_file_path: signedFilePath
                                            });
                                        }
                                    );
                                };

                                /* Route to Dean only for acceptance docs, NOT for recommendation docs */
                                if (finalStatus === "Approved" && isAcceptanceDoc && !isRecommendationDoc) {
                                    const getDeansSql = `
                                        SELECT id FROM users
                                        WHERE role = 'admin' AND LOWER(position) = 'dean'
                                    `;
                                    db.query(getDeansSql, [], (errDeans, deanRows) => {
                                        if (errDeans || !deanRows || deanRows.length === 0) {
                                            console.log("No Dean found or query failed", errDeans);
                                            proceedWithNotifications();
                                        } else {
                                            const routeToDean = (idx) => {
                                                if (idx >= deanRows.length) {
                                                    proceedWithNotifications();
                                                    return;
                                                }
                                                const deanDbId = deanRows[idx].id;
                                                db.query(
                                                    `SELECT id FROM document_submissions WHERE document_id = ? AND receiver_id = ? LIMIT 1`,
                                                    [submission.document_id, deanDbId],
                                                    (errExist, existResult) => {
                                                        if (existResult && existResult.length > 0) {
                                                            db.query(
                                                                `UPDATE document_submissions
                                                                 SET submission_message = ?, review_status = 'Pending Review', review_comment = NULL, reviewed_by = NULL, reviewed_at = NULL, submission_status = 'Sent', sent_at = NOW()
                                                                 WHERE id = ?`,
                                                                ["Adviser signed. Pending Dean signature.", existResult[0].id],
                                                                (errUpd) => {
                                                                    db.query(
                                                                        `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                                                                         VALUES (?, ?, ?, 'Document Review')`,
                                                                        [deanDbId, "Adviser Acceptance Form Signed", `${adviserName} has signed the Adviser Acceptance Form. It is now pending your signature.`, "Document Review"],
                                                                        () => {}
                                                                    );
                                                                    routeToDean(idx + 1);
                                                                }
                                                            );
                                                        } else {
                                                            db.query(
                                                                `INSERT INTO document_submissions (document_id, sender_id, receiver_id, submission_message, review_status)
                                                                 VALUES (?, ?, ?, ?, 'Pending Review')`,
                                                                [submission.document_id, submission.sender_id, deanDbId, "Adviser signed. Pending Dean signature."],
                                                                (errIns) => {
                                                                    db.query(
                                                                        `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                                                                         VALUES (?, ?, ?, 'Document Review')`,
                                                                        [deanDbId, "Adviser Acceptance Form Pending Signature", `${adviserName} has signed the Adviser Acceptance Form. It is now pending your signature.`, "Document Review"],
                                                                        () => {}
                                                                    );
                                                                    routeToDean(idx + 1);
                                                                }
                                                            );
                                                        }
                                                    }
                                                );
                                            };
                                            routeToDean(0);
                                        }
                                    });
                                } else {
                                    proceedWithNotifications();
                                }

                            }
                        );

                    }
                );

            }
        );

    });

});

/* ================= ADMIN APPLY DOCUMENT SIGNATURE ================= */

app.put("/admin-apply-document-signature/:submissionId", async (req, res) => {
    const submissionId = req.params.submissionId;
    const {
        adminUserId,
        reviewStatus,
        reviewComment,
        signatureImage,
        signatureType,
        placement
    } = req.body;

    if(!submissionId || !adminUserId || !reviewStatus){
        return res.json({
            success:false,
            message:"Missing signing information."
        });
    }

    const finalStatus = String(reviewStatus || "").trim();

    if(finalStatus === "Approved" && !placement){
        return res.json({
            success:false,
            message:"Please place your e-signature on the document before approving."
        });
    }

    if(
        (finalStatus === "Rejected" || finalStatus === "Subject to Change" || finalStatus === "For Revision")
        && !String(reviewComment || "").trim()
    ){
        return res.json({
            success:false,
            message:"Please add notes explaining your decision."
        });
    }

    const adminSql = `
        SELECT id, fullname, digital_signature, position
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], async (err, adminResult) => {
        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to check admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Admin account not found."
            });
        }

        const adminPosition = String(adminResult[0].position || "").toLowerCase();
        const isDean = adminPosition === "dean";
        const isChair = adminPosition === "program chairperson is" || adminPosition === "program chairperson it";

        if (!isDean && !isChair) {
            return res.json({
                success:false,
                message:"Only Dean or Program Chairpersons can e-sign documents here."
            });
        }

        const adminDbId = adminResult[0].id;
        const adminName = adminResult[0].fullname;

        const submissionSql = `
            SELECT
                ds.id,
                ds.sender_id,
                ds.document_id,
                sd.document_title,
                sd.document_type,
                sd.document_status,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,
                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name
            FROM document_submissions ds
            JOIN student_documents sd ON ds.document_id = sd.id
            JOIN users sender ON ds.sender_id = sender.id
            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(submissionSql, [submissionId, adminDbId], async (err2, submissionResult) => {
            if(err2){
                console.log(err2);
                return res.json({
                    success:false,
                    message:"Failed to check document submission."
                });
            }

            if(submissionResult.length === 0){
                return res.json({
                    success:false,
                    message:"Document submission not found or you are not the assigned receiver."
                });
            }

            const submission = submissionResult[0];
            let signedFilePath = submission.signed_file_path || null;

            /* ── Lock: if already Approved by Dean, no further changes allowed ── */
            if(submission.document_status === 'Approved' && finalStatus !== 'Approved'){
                return res.json({
                    success: false,
                    message: 'This document has already been fully approved by the Dean. The verdict cannot be changed.'
                });
            }

            try{
                if(finalStatus === "Approved"){
                    let signatureBuffer;
                    if (signatureType === "saved" && adminResult[0].digital_signature) {
                        const localSigPath = path.join(__dirname, adminResult[0].digital_signature.replace(/^\//, ""));
                        if (!fs.existsSync(localSigPath)) {
                            return res.json({
                                success: false,
                                message: "Saved signature file not found on the server. Please re-upload it in settings."
                            });
                        }
                        signatureBuffer = fs.readFileSync(localSigPath);
                    } else {
                        signatureBuffer = decodeSignatureImageData(signatureImage);
                    }

                    if(!signatureBuffer || signatureBuffer.length === 0){
                        return res.json({
                            success:false,
                            message:"Invalid signature image."
                        });
                    }

                    console.log("DEAN SIGNING submission object:", submission);
                    const srcRelative = submission.signed_file_path || submission.file_path;
                    console.log("DEAN SIGNING srcRelative resolved:", srcRelative);
                    const sourcePath = path.join(
                        __dirname,
                        String(srcRelative || "").replace(/^\/uploads\//, "uploads/")
                    );

                    if(!fs.existsSync(sourcePath)){
                        return res.json({
                            success:false,
                            message:"Source document file was not found on the server."
                        });
                    }

                    const signedBytes = await embedSignatureOnPdfFile(
                        sourcePath,
                        signatureBuffer,
                        placement
                    );

                    const signedDir = path.join(__dirname, "uploads", "signed_documents");
                    if(!fs.existsSync(signedDir)){
                        fs.mkdirSync(signedDir, { recursive:true });
                    }

                    const signedFileName = `signed-dean-${Date.now()}-${submission.document_id}.pdf`;
                    const signedDiskPath = path.join(signedDir, signedFileName);
                    fs.writeFileSync(signedDiskPath, signedBytes);

                    signedFilePath = `/uploads/signed_documents/${signedFileName}`;
                }
            }catch(signErr){
                console.log(signErr);
                return res.json({
                    success:false,
                    message:"Failed to apply e-signature to the PDF."
                });
            }

            const revisionStatus =
                finalStatus === "Rejected"
                ? "Rejected"
                : (finalStatus === "Subject to Change" || finalStatus === "For Revision")
                ? "For Revision"
                : finalStatus;

            const updateSubmissionSql = `
                UPDATE document_submissions
                SET
                    review_status = ?,
                    review_comment = ?,
                    reviewed_by = ?,
                    reviewed_at = NOW(),
                    submission_status = 'Reviewed'
                WHERE id = ?
                AND receiver_id = ?
            `;

            db.query(
                updateSubmissionSql,
                [finalStatus, reviewComment || "", adminDbId, submissionId, adminDbId],
                (err3) => {
                    if(err3){
                        console.log(err3);
                        return res.json({
                            success:false,
                            message:"Failed to save review status."
                        });
                    }

                    const isEnvScan = isEnvironmentalScanningDoc(submission.document_type, submission.document_title);
                    let targetDocStatus = 'Approved';
                    if (isEnvScan && isChair && finalStatus === "Approved") {
                        targetDocStatus = 'Chairperson Signed';
                    }

                    const updateDocumentSql =
                        finalStatus === "Approved"
                        ? `
                            UPDATE student_documents
                            SET
                                document_status = ?,
                                signed_file_path = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `
                        : `
                            UPDATE student_documents
                            SET
                                document_status = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `;

                    const updateParams =
                        finalStatus === "Approved"
                        ? [targetDocStatus, signedFilePath, submission.document_id]
                        : [revisionStatus, submission.document_id];

                    db.query(updateDocumentSql, updateParams, (err4) => {
                        if(err4){
                            console.log(err4);
                            return res.json({
                                success:false,
                                message:"Review saved, but failed to update student document."
                            });
                        }

                        let notifyTitle, notifyMessage;
                        if(finalStatus === 'Approved'){
                            notifyTitle = isEnvScan
                                ? (isChair ? 'Chairperson Signed Environmental Scanning' : 'Dean Signed Environmental Scanning')
                                : 'Dean Signed Your Document';
                            notifyMessage = isEnvScan
                                ? (isChair
                                    ? `${adminName} (Chairperson) signed your "${submission.document_title}" document. It has been forwarded to the Dean for final approval.`
                                    : `${adminName} (Dean) signed and fully approved your "${submission.document_title}" document.`)
                                : `${adminName} (Dean) signed and fully approved your "${submission.document_title}" document. ${reviewComment ? 'Notes: ' + reviewComment : 'Your adviser acceptance form is now complete.'}`;
                        } else if(finalStatus === 'Rejected'){
                            notifyTitle = isChair ? 'Document Rejected by Chairperson' : 'Document Rejected by Dean';
                            notifyMessage = `Your "${submission.document_title}" was rejected by ${adminName} (${isChair ? 'Chairperson' : 'Dean'}). Reason: ${reviewComment || 'No reason provided.'}`;
                        } else {
                            notifyTitle = isChair ? 'Chairperson Requested Revision' : 'Dean Requested Revision';
                            notifyMessage = `${adminName} (${isChair ? 'Chairperson' : 'Dean'}) requested a revision on your "${submission.document_title}". Notes: ${reviewComment || 'Please check the document and resubmit.'}`;
                        }

                        const proceedWithDeanRouting = () => {
                            db.query(
                                `
                                    INSERT INTO user_notifications
                                    (
                                        user_id,
                                        notification_title,
                                        notification_message,
                                        notification_type
                                    )
                                    VALUES (?, ?, ?, 'Document Review')
                                `,
                                [submission.sender_id, notifyTitle, notifyMessage],
                                (err5) => {
                                    if(err5) console.log(err5);

                                    res.json({
                                        success: true,
                                        message:
                                            finalStatus === 'Approved'
                                            ? (isEnvScan && isChair ? 'Document signed and forwarded to the Dean. Student has been notified.' : 'Document signed and fully approved. Student has been notified.')
                                            : finalStatus === 'Rejected'
                                            ? 'Document rejected. Student has been notified with your reason.'
                                            : 'Revision requested. Student has been notified.',
                                        signed_file_path: signedFilePath
                                    });
                                }
                            );
                        };

                        if (finalStatus === "Approved" && isEnvScan && isChair) {
                            const getDeansSql = `
                                SELECT id FROM users
                                WHERE role = 'admin' AND LOWER(position) = 'dean'
                            `;
                            db.query(getDeansSql, [], (errDeans, deanRows) => {
                                if (errDeans || !deanRows || deanRows.length === 0) {
                                    console.log("No Dean found or query failed", errDeans);
                                    proceedWithDeanRouting();
                                } else {
                                    const routeToDean = (idx) => {
                                        if (idx >= deanRows.length) {
                                            proceedWithDeanRouting();
                                            return;
                                        }
                                        const deanDbId = deanRows[idx].id;
                                        db.query(
                                            `SELECT id FROM document_submissions WHERE document_id = ? AND receiver_id = ? LIMIT 1`,
                                            [submission.document_id, deanDbId],
                                            (errExist, existResult) => {
                                                if (existResult && existResult.length > 0) {
                                                    db.query(
                                                        `UPDATE document_submissions
                                                         SET submission_message = ?, review_status = 'Pending Review', review_comment = NULL, reviewed_by = NULL, reviewed_at = NULL, submission_status = 'Sent', sent_at = NOW()
                                                         WHERE id = ?`,
                                                        ["Chairperson signed. Pending Dean signature.", existResult[0].id],
                                                        () => {
                                                            db.query(
                                                                `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                                                                 VALUES (?, ?, ?, 'Document Review')`,
                                                                [deanDbId, "Environmental Scanning Signed", `${adminName} has signed the Environmental Scanning Form. It is now pending your signature.`, "Document Review"],
                                                                () => {}
                                                            );
                                                            routeToDean(idx + 1);
                                                        }
                                                    );
                                                } else {
                                                    db.query(
                                                        `INSERT INTO document_submissions (document_id, sender_id, receiver_id, submission_message, review_status)
                                                         VALUES (?, ?, ?, ?, 'Pending Review')`,
                                                        [submission.document_id, submission.sender_id, deanDbId, "Chairperson signed. Pending Dean signature."],
                                                        () => {
                                                            db.query(
                                                                `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                                                                 VALUES (?, ?, ?, 'Document Review')`,
                                                                [deanDbId, "Environmental Scanning Pending Signature", `${adminName} has signed the Environmental Scanning Form. It is now pending your signature.`, "Document Review"],
                                                                () => {}
                                                                );
                                                            routeToDean(idx + 1);
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    };
                                    routeToDean(0);
                                }
                            });
                        } else {
                            proceedWithDeanRouting();
                        }
                    });
                }
            );
        });
    });
});

/* ================= STUDENT SIGNING DOCUMENTS ================= */

app.get("/student-signing-documents/:userId", (req, res) => {

    const userId =
        req.params.userId;

    const groupSql = `
        SELECT cg.id AS group_db_id
        FROM group_members gm
        JOIN capstone_groups cg ON gm.group_id = cg.id
        JOIN users u ON gm.student_id = u.id
        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [userId], (err, groupResult) => {

        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to load group."
            });
        }

        if(groupResult.length === 0){
            return res.json({
                success:true,
                documents:[]
            });
        }

        const groupDbId =
            groupResult[0].group_db_id;

        const sql = `
            SELECT
                sd.id,
                sd.document_code,
                sd.document_title,
                sd.document_type,
                sd.file_path,
                sd.signed_file_path,
                sd.file_name,
                sd.document_status,
                sd.submitted_at,
                sd.updated_at,

                (
                    SELECT ds.review_status
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.adviser_access = 1
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS adviser_review_status,

                (
                    SELECT ds.review_comment
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.adviser_access = 1
                    AND ds.review_comment IS NOT NULL
                    AND TRIM(ds.review_comment) != ''
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS adviser_review_comment,

                (
                    SELECT reviewer.fullname
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.adviser_access = 1
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS adviser_name,

                (
                    SELECT ds.reviewed_at
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.adviser_access = 1
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS adviser_reviewed_at,

                (
                    SELECT ds.review_status
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.role = 'admin' AND LOWER(reviewer.position) = 'dean'
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS dean_review_status,

                (
                    SELECT ds.review_comment
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.role = 'admin' AND LOWER(reviewer.position) = 'dean'
                    AND ds.review_comment IS NOT NULL
                    AND TRIM(ds.review_comment) != ''
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS dean_review_comment,

                (
                    SELECT reviewer.fullname
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.role = 'admin' AND LOWER(reviewer.position) = 'dean'
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS dean_name,

                (
                    SELECT ds.reviewed_at
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.role = 'admin' AND LOWER(reviewer.position) = 'dean'
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS dean_reviewed_at,

                (
                    SELECT ds.review_status
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.instructor_access = 1
                    AND (reviewer.position IS NULL OR (reviewer.position NOT LIKE 'Program Chairperson%' AND LOWER(reviewer.position) != 'dean'))
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS instructor_review_status,

                (
                    SELECT ds.review_comment
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.instructor_access = 1
                    AND (reviewer.position IS NULL OR (reviewer.position NOT LIKE 'Program Chairperson%' AND LOWER(reviewer.position) != 'dean'))
                    AND ds.review_comment IS NOT NULL
                    AND TRIM(ds.review_comment) != ''
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS instructor_review_comment,

                (
                    SELECT reviewer.fullname
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.instructor_access = 1
                    AND (reviewer.position IS NULL OR (reviewer.position NOT LIKE 'Program Chairperson%' AND LOWER(reviewer.position) != 'dean'))
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS instructor_name,

                (
                    SELECT ds.reviewed_at
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND reviewer.instructor_access = 1
                    AND (reviewer.position IS NULL OR (reviewer.position NOT LIKE 'Program Chairperson%' AND LOWER(reviewer.position) != 'dean'))
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS instructor_reviewed_at,

                (
                    SELECT ds.review_status
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND (reviewer.position = 'Program Chairperson IS' OR reviewer.position = 'Program Chairperson IT')
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS chairperson_review_status,

                (
                    SELECT ds.review_comment
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND (reviewer.position = 'Program Chairperson IS' OR reviewer.position = 'Program Chairperson IT')
                    AND ds.review_comment IS NOT NULL
                    AND TRIM(ds.review_comment) != ''
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS chairperson_review_comment,

                (
                    SELECT reviewer.fullname
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND (reviewer.position = 'Program Chairperson IS' OR reviewer.position = 'Program Chairperson IT')
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS chairperson_name,

                (
                    SELECT ds.reviewed_at
                    FROM document_submissions ds
                    JOIN users reviewer ON ds.receiver_id = reviewer.id
                    WHERE ds.document_id = sd.id
                    AND (reviewer.position = 'Program Chairperson IS' OR reviewer.position = 'Program Chairperson IT')
                    ORDER BY ds.reviewed_at DESC, ds.id DESC
                    LIMIT 1
                ) AS chairperson_reviewed_at

            FROM student_documents sd
            WHERE sd.group_id = ?
            AND (
                LOWER(sd.document_type) LIKE '%adviser acceptance%'
                OR LOWER(sd.document_type) LIKE '%acceptance for advisory%'
                OR LOWER(sd.document_title) LIKE '%adviser acceptance%'
                OR LOWER(sd.document_title) LIKE '%acceptance for advisory%'
                OR LOWER(sd.document_type) LIKE '%recommendation for concept%'
                OR LOWER(sd.document_title) LIKE '%recommendation for concept%'
                OR LOWER(sd.document_type) LIKE '%environmental scanning%'
                OR LOWER(sd.document_title) LIKE '%environmental scanning%'
            )
            ORDER BY sd.id DESC
        `;

        db.query(sql, [groupDbId], (err2, rows) => {

            if(err2){
                console.log(err2);
                return res.json({
                    success:false,
                    message:"Failed to load signing documents."
                });
            }

            res.json({
                success:true,
                documents:rows || []
            });

        });

    });

});

/* ================= ADVISER REVIEW STUDENT DOCUMENT ================= */

app.put("/adviser-review-student-document/:submissionId", (req, res) => {

    const submissionId =
        req.params.submissionId;

    const {
        adviserUserId,
        reviewStatus,
        reviewComment,
        otherStatus
    } = req.body;

    if(
        !submissionId ||
        !adviserUserId ||
        !reviewStatus
    ){
        return res.json({
            success:false,
            message:"Missing review information."
        });
    }

    const finalStatus =
        reviewStatus === "Other"
        ? otherStatus
        : reviewStatus;

    if(!finalStatus){

        return res.json({
            success:false,
            message:"Please provide the review status."
        });

    }

    const adviserSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND adviser_access = 1
        LIMIT 1
    `;

    db.query(adviserSql, [adviserUserId], (err, adviserResult) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Failed to check adviser account."
            });
        }

        if(adviserResult.length === 0){

            return res.json({
                success:false,
                message:"Adviser account not found or adviser access is disabled."
            });

        }

        const adviserDbId =
            adviserResult[0].id;

        const adviserName =
            adviserResult[0].fullname;

        const submissionSql = `
            SELECT
                ds.id,
                ds.sender_id,
                ds.receiver_id,
                ds.document_id,

                sd.document_title,
                sd.document_type,
                sd.document_status

            FROM document_submissions ds

            JOIN student_documents sd
                ON ds.document_id = sd.id

            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(
            submissionSql,
            [
                submissionId,
                adviserDbId
            ],
            (err, submissionResult) => {

                if(err){
                    console.log(err);

                    return res.json({
                        success:false,
                        message:"Failed to check document submission."
                    });
                }

                if(submissionResult.length === 0){

                    return res.json({
                        success:false,
                        message:"Document submission not found or you are not the assigned receiver."
                    });

                }

                const submission =
                    submissionResult[0];

                const updateSql = `
                    UPDATE document_submissions
                    SET
                        review_status = ?,
                        review_comment = ?,
                        reviewed_by = ?,
                        reviewed_at = NOW(),
                        submission_status = 'Reviewed'
                    WHERE id = ?
                    AND receiver_id = ?
                `;

                db.query(
                    updateSql,
                    [
                        finalStatus,
                        reviewComment || "",
                        adviserDbId,
                        submissionId,
                        adviserDbId
                    ],
                    (err) => {

                        if(err){
                            console.log(err);

                            return res.json({
                                success:false,
                                message:"Failed to submit document review."
                            });
                        }

                        const finishAdviserReview = () => {

                            const notifySql = `
                                INSERT INTO user_notifications
                                (
                                    user_id,
                                    notification_title,
                                    notification_message,
                                    notification_type
                                )
                                VALUES (?, ?, ?, 'Document Review')
                            `;

                            db.query(
                                notifySql,
                                [
                                    submission.sender_id,
                                    "Document Review Updated",
                                    `${adviserName} reviewed your "${submission.document_title}" document. Status: ${finalStatus}. Comment: ${reviewComment || "No comment provided."}`
                                ],
                                (err2) => {

                                    if(err2){
                                        console.log(err2);
                                    }

                                    res.json({
                                        success:true,
                                        message:"Document review submitted and student was notified."
                                    });

                                }
                            );

                        };

                        if(finalStatus === "Approved"){

                            return db.query(
                                `
                                    UPDATE student_documents
                                    SET document_status = 'Approved'
                                    WHERE id = ?
                                `,
                                [submission.document_id],
                                (err2) => {

                                    if(err2){
                                        console.log(err2);
                                    }

                                    finishAdviserReview();

                                }
                            );

                        }

                        if(
                            finalStatus === "For Revision"
                            || finalStatus === "Rejected"
                            || finalStatus === "Subject to Change"
                        ){

                            const revisionStatus =
                                finalStatus === "Rejected"
                                ? "Rejected"
                                : "For Revision";

                            return db.query(
                                `
                                    UPDATE student_documents
                                    SET document_status = ?
                                    WHERE id = ?
                                `,
                                [revisionStatus, submission.document_id],
                                (err2) => {

                                    if(err2){
                                        console.log(err2);
                                    }

                                    finishAdviserReview();

                                }
                            );

                        }

                        finishAdviserReview();

                    }
                );

            }
        );

    });

});

/* ================= ADMIN DASHBOARD DATA ================= */

app.get("/admin-dashboard/:adminUserId", async (req, res) => {

    const adminUserId =
        req.params.adminUserId;

    const queryPromise = (sql, params = []) => {

        return new Promise((resolve) => {

            db.query(sql, params, (err, result) => {

                if(err){
                    console.log(err);
                    resolve(null);
                }else{
                    resolve(result);
                }

            });

        });

    };

    const adminResult =
        await queryPromise(
            `
                SELECT
                    id,
                    user_id,
                    fullname,
                    role,
                    position,
                    program,
                    adviser_access,
                    panelist_access,
                    instructor_access
                FROM users
                WHERE user_id = ?
                AND role = 'admin'
                LIMIT 1
            `,
            [adminUserId]
        );

    if(!adminResult || adminResult.length === 0){

        return res.json({
            success:false,
            message:"Admin account not found."
        });

    }

    const admin =
        adminResult[0];

    const studentCount =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'student'
            `
        );

    const facultyCount =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'faculty'
            `
        );

    const repositoryCount =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM repository
            `
        );

    const pendingReviews =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM document_submissions
                WHERE review_status = 'Pending Review'
            `
        );

    const repositoryRecords =
        await queryPromise(
            `
                SELECT *
                FROM repository
                ORDER BY id DESC
                LIMIT 5
            `
        );

    const recentUsers =
        await queryPromise(
            `
                SELECT
                    'Account Created' AS activity_type,
                    fullname AS activity_title,
                    user_id AS activity_subtitle,
                    role AS activity_tag,
                    created_at AS activity_date
                FROM users
                ORDER BY created_at DESC
                LIMIT 5
            `
        );

    const recentAnnouncements =
        await queryPromise(
            `
                SELECT
                    'Announcement Published' AS activity_type,
                    announcement_title AS activity_title,
                    announcement_code AS activity_subtitle,
                    audience AS activity_tag,
                    created_at AS activity_date
                FROM announcements
                ORDER BY created_at DESC
                LIMIT 5
            `
        );

    const recentActivity = [
        ...(recentUsers || []),
        ...(recentAnnouncements || [])
    ].sort((a, b) =>
        new Date(b.activity_date) - new Date(a.activity_date)
    ).slice(0, 6);

    res.json({
        success:true,
        admin,
        stats:{
            totalStudents:studentCount ? studentCount[0].total : 0,
            totalFaculty:facultyCount ? facultyCount[0].total : 0,
            repositoryRecords:repositoryCount ? repositoryCount[0].total : 0,
            pendingReviews:pendingReviews ? pendingReviews[0].total : 0
        },
        repositoryRecords:repositoryRecords || [],
        recentActivity
    });

});

/* ================= FACULTY DASHBOARD DATA ================= */

app.get("/faculty-dashboard/:facultyUserId", async (req, res) => {

    const facultyUserId =
        req.params.facultyUserId;

    const queryPromise = (sql, params = []) => {

        return new Promise((resolve) => {

            db.query(sql, params, (err, result) => {

                if(err){
                    console.log(err);
                    resolve(null);
                }else{
                    resolve(result);
                }

            });

        });

    };

    const facultyResult =
        await queryPromise(
            `
                SELECT
                    id,
                    user_id,
                    fullname,
                    role,
                    position,
                    program,
                    adviser_access,
                    panelist_access,
                    instructor_access,
                    profile_image
                FROM users
                WHERE user_id = ?
                AND role IN ('faculty', 'admin')
                LIMIT 1
            `,
            [facultyUserId]
        );

    if(!facultyResult || facultyResult.length === 0){

        return res.json({
            success:false,
            message:"Faculty account not found."
        });

    }

    const faculty =
        facultyResult[0];

    const facultyDbId =
        faculty.id;

    const studentCount =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'student'
            `
        );

    const repositoryCount =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM repository
            `
        );

    const pendingReviews =
        await queryPromise(
            `
                SELECT COUNT(*) AS total
                FROM document_submissions
                WHERE receiver_id = ?
                AND review_status = 'Pending Review'
            `,
            [facultyDbId]
        );

    const scheduledDefenses =
        await queryPromise(
            `
                SELECT COUNT(DISTINCT ds.id) AS total
                FROM defense_schedules ds

                LEFT JOIN defense_schedule_panelists dsp
                    ON ds.id = dsp.schedule_id

                WHERE ds.defense_status = 'Scheduled'
                AND (
                    ds.created_by = ?
                    OR dsp.panelist_id = ?
                )
            `,
            [
                facultyDbId,
                facultyDbId
            ]
        );

    const recentDocuments =
        await queryPromise(
            `
                SELECT
                    ds.id AS submission_id,
                    ds.sent_at,
                    ds.review_status,

                    sd.document_title,
                    sd.document_type,
                    sd.document_code,

                    sender.fullname AS sender_name,
                    sender.user_id AS sender_user_id,

                    cg.group_name,
                    cg.project_title

                FROM document_submissions ds

                JOIN student_documents sd
                    ON ds.document_id = sd.id

                JOIN users sender
                    ON ds.sender_id = sender.id

                LEFT JOIN group_members gm
                    ON sender.id = gm.student_id

                LEFT JOIN capstone_groups cg
                    ON gm.group_id = cg.id

                WHERE ds.receiver_id = ?

                ORDER BY ds.sent_at DESC

                LIMIT 5
            `,
            [facultyDbId]
        );

    const upcomingDefense =
        await queryPromise(
            `
                SELECT DISTINCT
                    ds.id,
                    ds.schedule_code,
                    ds.defense_type,
                    ds.defense_date,
                    ds.start_time,
                    ds.end_time,
                    ds.room_name,
                    ds.defense_status,

                    cg.group_name,
                    cg.project_title,
                    cg.program AS group_program

                FROM defense_schedules ds

                JOIN capstone_groups cg
                    ON ds.group_id = cg.id

                LEFT JOIN defense_schedule_panelists dsp
                    ON ds.id = dsp.schedule_id

                WHERE ds.defense_status = 'Scheduled'
                AND ds.defense_date >= CURDATE()
                AND (
                    ds.created_by = ?
                    OR dsp.panelist_id = ?
                )

                ORDER BY ds.defense_date ASC, ds.start_time ASC

                LIMIT 1
            `,
            [
                facultyDbId,
                facultyDbId
            ]
        );

    const adminAnnouncements =
        await queryPromise(
            `
                SELECT
                    a.id,
                    a.announcement_code,
                    a.announcement_title,
                    a.announcement_type,
                    a.audience,
                    a.target_program,
                    a.announcement_content,
                    a.created_at,

                    u.fullname AS created_by_name

                FROM announcements a

                JOIN users u
                    ON a.created_by = u.id

                WHERE a.announcement_status = 'Published'
                AND u.role = 'admin'
                AND (
                    a.audience IN ('All Users', 'All', 'Faculty', 'Faculties')
                    OR (
                        a.audience = 'Program'
                        AND a.target_program = ?
                    )
                )

                ORDER BY a.created_at DESC

                LIMIT 5
            `,
            [faculty.program]
        );

    const recentActivity = [
        ...(recentDocuments || []).map(item => ({
            activity_type:"Document Received",
            activity_title:item.document_title,
            activity_subtitle:item.sender_name,
            activity_date:item.sent_at
        })),
        ...(adminAnnouncements || []).map(item => ({
            activity_type:"Admin Announcement",
            activity_title:item.announcement_title,
            activity_subtitle:item.created_by_name,
            activity_date:item.created_at
        }))
    ].sort((a, b) =>
        new Date(b.activity_date) - new Date(a.activity_date)
    ).slice(0, 5);

    res.json({
        success:true,
        faculty,
        stats:{
            totalStudents:studentCount ? studentCount[0].total : 0,
            repositoryRecords:repositoryCount ? repositoryCount[0].total : 0,
            pendingReviews:pendingReviews ? pendingReviews[0].total : 0,
            scheduledDefenses:scheduledDefenses ? scheduledDefenses[0].total : 0
        },
        recentDocuments:recentDocuments || [],
        upcomingDefense:upcomingDefense && upcomingDefense.length > 0 ? upcomingDefense[0] : null,
        adminAnnouncements:adminAnnouncements || [],
        recentActivity
    });

});

/* ================= FORCE PASSWORD CHANGE ================= */

app.post("/force-change-password", (req, res) => {

    const {
        userId,
        currentPassword,
        newPassword,
        confirmPassword
    } = req.body;

    if(
        !userId ||
        !currentPassword ||
        !newPassword ||
        !confirmPassword
    ){
        return res.json({
            success:false,
            message:"Please complete all password fields."
        });
    }

    if(newPassword !== confirmPassword){

        return res.json({
            success:false,
            message:"New password and confirm password do not match."
        });

    }

    if(newPassword.length < 6){

        return res.json({
            success:false,
            message:"Password must be at least 6 characters."
        });

    }

    if(currentPassword === newPassword){

        return res.json({
            success:false,
            message:"New password must be different from your current password."
        });

    }

    const checkSql = `
        SELECT
            id,
            user_id,
            password,
            role
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(checkSql, [userId], (err, result) => {

        if(err){
            console.log(err);

            return res.json({
                success:false,
                message:"Database error while checking account."
            });
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"Account not found."
            });

        }

        const user =
            result[0];

        if(user.password !== currentPassword){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const updateSql = `
            UPDATE users
            SET
                password = ?,
                force_password_change = 0
            WHERE user_id = ?
        `;

        db.query(updateSql, [newPassword, userId], (err) => {

            if(err){
                console.log(err);

                return res.json({
                    success:false,
                    message:"Failed to update password."
                });
            }

            const userDbId = user.id;
            const notifSql = `
                INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                VALUES (?, 'Security Update', 'Your password has been changed successfully.', 'System')
            `;
            db.query(notifSql, [userDbId], (notifErr) => {
                if (notifErr) console.error("Failed to insert password change notification:", notifErr);
            });

            res.json({
                success:true,
                message:"Password changed successfully.",
                role:user.role
            });

        });

    });

});

/* ================= CHAT FILE UPLOAD SETUP ================= */

const chatFileStorage = multer.diskStorage({
    destination: function(req, file, cb){
        const uploadPath = path.join(__dirname, "uploads", "chat_files");

        if(!fs.existsSync(uploadPath)){
            fs.mkdirSync(uploadPath, {
                recursive: true
            });
        }

        cb(null, uploadPath);
    },

    filename: function(req, file, cb){
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const chatFileUpload = multer({
    storage: chatFileStorage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25 MB
    }
});

/* ================= CHAT API ENDPOINTS ================= */

app.get("/chat-users", (req, res) => {
    const currentUserId = req.query.userId;
    const search = req.query.search || "";

    let sql = `
        SELECT user_id, fullname, role, position, program, year_level, student_position, profile_image
        FROM users
        WHERE user_id != ?
    `;
    const params = [currentUserId];

    if (search) {
        sql += ` AND (fullname LIKE ? OR user_id LIKE ? OR role LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY fullname ASC`;

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Error fetching chat users" });
        }
        res.json({ success: true, users: results });
    });
});

app.get("/chat-messages", (req, res) => {
    const { senderId, receiverId } = req.query;

    if (!senderId || !receiverId) {
        return res.json({ success: false, message: "Missing senderId or receiverId" });
    }

    const sql = `
        SELECT *
        FROM messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    `;

    db.query(sql, [senderId, receiverId, receiverId, senderId], (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Error fetching messages" });
        }
        res.json({ success: true, messages: results });
    });
});

app.post("/send-chat-message", chatFileUpload.single("file"), (req, res) => {
    const { senderId, receiverId, messageText } = req.body;

    if (!senderId || !receiverId) {
        return res.json({ success: false, message: "Missing senderId or receiverId" });
    }

    let filePath = null;
    let fileName = null;

    if (req.file) {
        filePath = "uploads/chat_files/" + req.file.filename;
        fileName = req.file.originalname;
    }

    const sql = `
        INSERT INTO messages (sender_id, receiver_id, message_text, file_path, file_name)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [senderId, receiverId, messageText || "", filePath, fileName], (err, result) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Error sending message" });
        }

        res.json({
            success: true,
            message: {
                id: result.insertId,
                sender_id: senderId,
                receiver_id: receiverId,
                message_text: messageText || "",
                file_path: filePath,
                file_name: fileName,
                created_at: new Date()
            }
        });
    });
});

/* ================= CONSULTATION API ENDPOINTS ================= */

app.get("/consultation-context/:userId", (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.json({ success: false, message: "Missing userId" });
    }

    const studentSql = "SELECT id, enrolled_by_user_id FROM users WHERE user_id = ? AND role = 'student'";
    db.query(studentSql, [userId], (err, studentResult) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Database error while fetching student" });
        }
        if (studentResult.length === 0) {
            return res.json({ success: false, message: "Student not found" });
        }

        const studentDbId = studentResult[0].id;
        const enrolledByUserId = studentResult[0].enrolled_by_user_id;

        const availableFaculty = [];

        const getAdviser = new Promise((resolve) => {
            const adviserSql = `
                SELECT u.id AS faculty_id, u.fullname AS faculty_name, u.user_id AS faculty_user_id, 'Adviser' AS assigned_role
                FROM group_members gm
                JOIN capstone_groups cg ON gm.group_id = cg.id
                JOIN users u ON cg.adviser_id = u.id
                WHERE gm.student_id = ?
            `;
            db.query(adviserSql, [studentDbId], (err, adviserResult) => {
                if (err) {
                    console.error("Adviser query error:", err);
                } else if (adviserResult.length > 0) {
                    availableFaculty.push(adviserResult[0]);
                }
                resolve();
            });
        });

        const getInstructor = new Promise((resolve) => {
            if (!enrolledByUserId) {
                return resolve();
            }
            const instructorSql = `
                SELECT id AS faculty_id, fullname AS faculty_name, user_id AS faculty_user_id, 'Instructor' AS assigned_role
                FROM users
                WHERE user_id = ? AND role = 'faculty'
            `;
            db.query(instructorSql, [enrolledByUserId], (err, instructorResult) => {
                if (err) {
                    console.error("Instructor query error:", err);
                } else if (instructorResult.length > 0) {
                    availableFaculty.push(instructorResult[0]);
                }
                resolve();
            });
        });

        Promise.all([getAdviser, getInstructor]).then(() => {
            res.json({
                success: true,
                context: {
                    availableFaculty
                }
            });
        });
    });
});

app.post("/student-consultations", (req, res) => {
    const { studentUserId, assignedFacultyId, consultationType, topic, concernMessage } = req.body;

    if (!studentUserId || !assignedFacultyId || !consultationType || !concernMessage) {
        return res.json({ success: false, message: "Missing required fields." });
    }

    const studentSql = "SELECT id, fullname FROM users WHERE user_id = ? AND role = 'student'";
    db.query(studentSql, [studentUserId], (err, studentResult) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Database error while fetching student." });
        }
        if (studentResult.length === 0) {
            return res.json({ success: false, message: "Student not found." });
        }

        const studentDbId = studentResult[0].id;
        const studentName = studentResult[0].fullname;

        const groupSql = "SELECT group_id FROM group_members WHERE student_id = ?";
        db.query(groupSql, [studentDbId], (err, groupResult) => {
            if (err) {
                console.error(err);
                return res.json({ success: false, message: "Database error while checking student group." });
            }

            const groupDbId = groupResult.length > 0 ? groupResult[0].group_id : null;

            const determineRole = (callback) => {
                if (!groupDbId) {
                    return callback("Instructor");
                }
                const adviserSql = "SELECT adviser_id FROM capstone_groups WHERE id = ?";
                db.query(adviserSql, [groupDbId], (err, adviserResult) => {
                    if (err) {
                        console.error(err);
                        return callback("Instructor");
                    }
                    if (adviserResult.length > 0 && Number(adviserResult[0].adviser_id) === Number(assignedFacultyId)) {
                        return callback("Adviser");
                    }
                    callback("Instructor");
                });
            };

            determineRole((assignedRole) => {
                const year = new Date().getFullYear();
                const prefix = `CNS-${year}-`;
                const codeSql = "SELECT consultation_code FROM consultations WHERE consultation_code LIKE ? ORDER BY id DESC LIMIT 1";
                db.query(codeSql, [prefix + "%"], (err, codeResult) => {
                    let nextNumber = 1;
                    if (err) {
                        console.error(err);
                    } else if (codeResult.length > 0) {
                        const lastCode = codeResult[0].consultation_code;
                        const parts = lastCode.split("-");
                        const lastNum = parseInt(parts[2]);
                        if (!isNaN(lastNum)) {
                            nextNumber = lastNum + 1;
                        }
                    }

                    const consultationCode = `${prefix}${String(nextNumber).padStart(4, "0")}`;

                    const insertSql = `
                        INSERT INTO consultations
                        (consultation_code, student_id, group_id, assigned_faculty_id, assigned_role, consultation_type, topic, concern_message, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
                    `;
                    const insertParams = [
                        consultationCode,
                        studentDbId,
                        groupDbId,
                        assignedFacultyId,
                        assignedRole,
                        consultationType,
                        topic || null,
                        concernMessage
                    ];

                    db.query(insertSql, insertParams, (err) => {
                        if (err) {
                            console.error(err);
                            return res.json({ success: false, message: "Failed to submit consultation request." });
                        }

                        const notifSql = `
                            INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                            VALUES (?, ?, ?, 'Consultation')
                        `;
                        const notifTitle = "New Consultation Request";
                        const notifMessage = `Student ${studentName} requested a ${consultationType} on "${topic || 'General Topic'}".`;
                        db.query(notifSql, [assignedFacultyId, notifTitle, notifMessage], (notifErr) => {
                            if (notifErr) {
                                console.error("Notification insert error:", notifErr);
                            }
                        });

                        res.json({ success: true, message: "Consultation request submitted successfully." });
                    });
                });
            });
        });
    });
});

app.get("/student-consultations/:userId", (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.json({ success: false, message: "Missing userId" });
    }

    const sql = `
        SELECT c.id, c.consultation_code, c.consultation_type, c.topic, c.concern_message, c.status,
               DATE_FORMAT(c.scheduled_date, '%Y-%m-%d') AS scheduled_date,
               c.scheduled_start_time, c.scheduled_end_time, c.consultation_mode, c.location_or_link,
               c.created_at, u.fullname AS faculty_name, c.assigned_role
        FROM consultations c
        JOIN users u ON c.assigned_faculty_id = u.id
        JOIN users s ON c.student_id = s.id
        WHERE s.user_id = ?
        ORDER BY c.id DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Failed to fetch consultation records." });
        }
        res.json({ success: true, consultations: results });
    });
});

app.get("/faculty-consultations", (req, res) => {
    const { facultyUserId, assignedRole } = req.query;

    if (!facultyUserId || !assignedRole) {
        return res.json({ success: false, message: "Missing facultyUserId or assignedRole" });
    }

    const sql = `
        SELECT c.id, c.consultation_code, c.consultation_type, c.topic, c.concern_message, c.status,
               DATE_FORMAT(c.scheduled_date, '%Y-%m-%d') AS scheduled_date,
               c.scheduled_start_time, c.scheduled_end_time, c.consultation_mode, c.location_or_link,
               c.schedule_notes, c.created_at, s.fullname AS student_name, s.user_id AS student_user_id
        FROM consultations c
        JOIN users s ON c.student_id = s.id
        JOIN users f ON c.assigned_faculty_id = f.id
        WHERE f.user_id = ? AND c.assigned_role = ?
        ORDER BY c.id DESC
    `;

    db.query(sql, [facultyUserId, assignedRole], (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Failed to fetch assigned consultations." });
        }
        res.json({ success: true, consultations: results });
    });
});

app.put("/faculty-consultations/:id/schedule", (req, res) => {
    const id = req.params.id;
    const {
        facultyUserId, scheduledDate, scheduledStartTime, scheduledEndTime,
        consultationMode, locationOrLink, scheduleNotes
    } = req.body;

    if (!id || !facultyUserId) {
        return res.json({ success: false, message: "Missing required parameters." });
    }

    /* ── Compute status from date/time fields ── */
    let computedStatus = "Pending";
    if (scheduledDate && scheduledEndTime) {
        const now = new Date();
        const endDatetime   = new Date(`${scheduledDate}T${scheduledEndTime}`);
        const startDatetime = scheduledStartTime
            ? new Date(`${scheduledDate}T${scheduledStartTime}`)
            : endDatetime;

        if (now >= startDatetime && now <= endDatetime) {
            computedStatus = "Ongoing";
        } else if (now > endDatetime) {
            computedStatus = "Completed";
        } else {
            computedStatus = "Scheduled";
        }
    } else if (scheduledDate) {
        computedStatus = "Scheduled";
    }

    /* ── Fetch previous schedule to detect reschedule ── */
    const prevSql = `
        SELECT c.scheduled_date, c.scheduled_start_time, c.scheduled_end_time,
               c.student_id, c.consultation_code,
               f.fullname AS faculty_name, f.id AS faculty_db_id
        FROM consultations c
        JOIN users f ON c.assigned_faculty_id = f.id
        WHERE c.id = ?
    `;

    db.query(prevSql, [id], (prevErr, prevResult) => {
        if (prevErr) {
            console.error("Previous schedule lookup error:", prevErr);
            return res.json({ success: false, message: "Database error." });
        }

        const prev = prevResult[0] || {};
        const prevDate  = prev.scheduled_date  ? String(prev.scheduled_date).slice(0,10) : null;
        const prevStart = prev.scheduled_start_time ? String(prev.scheduled_start_time).slice(0,5) : null;
        const prevEnd   = prev.scheduled_end_time   ? String(prev.scheduled_end_time).slice(0,5)   : null;
        const isReschedule =
            prevDate && scheduledDate &&
            (prevDate  !== String(scheduledDate).slice(0,10) ||
             prevStart !== String(scheduledStartTime || "").slice(0,5) ||
             prevEnd   !== String(scheduledEndTime   || "").slice(0,5));

        const updateSql = `
            UPDATE consultations
            SET status = ?,
                scheduled_date = ?,
                scheduled_start_time = ?,
                scheduled_end_time = ?,
                consultation_mode = ?,
                location_or_link = ?,
                schedule_notes = ?
            WHERE id = ?
        `;
        const params = [
            computedStatus,
            scheduledDate || null,
            scheduledStartTime || null,
            scheduledEndTime || null,
            consultationMode || null,
            locationOrLink || null,
            scheduleNotes || null,
            id
        ];

        db.query(updateSql, params, (err) => {
            if (err) {
                console.error(err);
                return res.json({ success: false, message: "Failed to update consultation schedule." });
            }

            const studentDbId       = prev.student_id;
            const facultyName       = prev.faculty_name;
            const consultationCode  = prev.consultation_code;

            const notifSql = `
                INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                VALUES (?, ?, ?, 'Consultation')
            `;

            /* Notify student about status update */
            if (studentDbId) {
                const msg = isReschedule
                    ? `Your consultation (${consultationCode}) has been rescheduled to ${scheduledDate} ${scheduledStartTime || ""} - ${scheduledEndTime || ""} by ${facultyName}.`
                    : `Your consultation request (${consultationCode}) is now "${computedStatus}" (updated by ${facultyName}).`;

                const title = isReschedule ? "Consultation Rescheduled" : "Consultation Updated";
                db.query(notifSql, [studentDbId, title, msg], (notifErr) => {
                    if (notifErr) console.error("Student notification error:", notifErr);
                });
            }

            res.json({
                success: true,
                message: isReschedule
                    ? "Schedule saved and reschedule notification sent."
                    : "Consultation schedule updated successfully.",
                computedStatus
            });
        });
    });
});

/* ================= CONSULTATION AUTO-STATUS UPDATER ================= */

function computeConsultationStatus(row) {
    if (!row.scheduled_date || !row.scheduled_end_time) {
        return row.scheduled_date ? "Scheduled" : "Pending";
    }
    const dateStr   = String(row.scheduled_date).slice(0, 10);
    const endTime   = String(row.scheduled_end_time).slice(0, 5);
    const startTime = row.scheduled_start_time
        ? String(row.scheduled_start_time).slice(0, 5)
        : endTime;
    const now     = new Date();
    const endDt   = new Date(`${dateStr}T${endTime}`);
    const startDt = new Date(`${dateStr}T${startTime}`);
    if (now >= startDt && now <= endDt) return "Ongoing";
    if (now > endDt)                   return "Completed";
    return "Scheduled";
}

function runConsultationStatusSync() {
    const fetchSql = `
        SELECT c.id, c.status, c.scheduled_date, c.scheduled_start_time, c.scheduled_end_time,
               c.student_id, c.consultation_code
        FROM consultations c
        WHERE c.scheduled_date IS NOT NULL
          AND c.status NOT IN ('Cancelled')
    `;
    db.query(fetchSql, (err, rows) => {
        if (err) { console.error("Consultation status sync error:", err); return; }

        rows.forEach(row => {
            const correct = computeConsultationStatus(row);
            if (correct === row.status) return; // already correct

            db.query(
                "UPDATE consultations SET status = ? WHERE id = ?",
                [correct, row.id],
                (updateErr) => {
                    if (updateErr) {
                        console.error("Auto-status update error:", updateErr);
                        return;
                    }
                    /* Notify student when status advances to Ongoing or Completed */
                    if ((correct === "Ongoing" || correct === "Completed") && row.student_id) {
                        const title = correct === "Ongoing" ? "Consultation Now Ongoing" : "Consultation Completed";
                        const msg   = correct === "Ongoing"
                            ? `Your consultation (${row.consultation_code}) is now ongoing.`
                            : `Your consultation (${row.consultation_code}) has been marked as completed.`;
                        db.query(
                            `INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                             VALUES (?, ?, ?, 'Consultation')`,
                            [row.student_id, title, msg],
                            (notifErr) => { if (notifErr) console.error("Auto-notif error:", notifErr); }
                        );
                    }
                }
            );
        });
    });
}

/* Run every 60 seconds */
setInterval(runConsultationStatusSync, 60 * 1000);

/* ================= ADMIN DOCUMENT REVIEW DATA ================= */

app.get("/admin-document-review/:userId", (req, res) => {
    const userId = req.params.userId;

    const adminSql = `
        SELECT
            id,
            user_id,
            fullname,
            role,
            position,
            program,
            digital_signature
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [userId], (err, adminResult) => {
        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to check admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Admin account not found."
            });
        }

        const admin = adminResult[0];
        const adminDbId = admin.id;

        const receivedSql = `
            SELECT
                ds.id AS submission_id,
                ds.submission_message,
                ds.submission_status,
                ds.sent_at,
                ds.review_status,
                ds.review_comment,
                ds.reviewed_at,
                sd.id AS document_id,
                sd.document_code,
                sd.document_title,
                sd.document_type,
                sd.file_name,
                sd.file_path,
                sd.signed_file_path,
                sd.file_format,
                sd.document_status,
                sender.id AS sender_db_id,
                sender.user_id AS sender_user_id,
                sender.fullname AS sender_name,
                sender.program AS sender_program,
                sender.year_level AS sender_year_level,
                cg.group_id,
                cg.group_name,
                cg.project_title,
                cg.program AS group_program,
                reviewer.fullname AS reviewer_name,
                (
                    SELECT adv.fullname
                    FROM document_submissions adv_ds
                    JOIN users adv ON adv_ds.receiver_id = adv.id
                    WHERE adv_ds.document_id = sd.id
                    AND adv.adviser_access = 1
                    AND adv.role IN ('faculty', 'admin')
                    AND adv_ds.review_status = 'Approved'
                    ORDER BY adv_ds.reviewed_at DESC
                    LIMIT 1
                ) AS adviser_name,
                (
                    SELECT adv_ds.reviewed_at
                    FROM document_submissions adv_ds
                    JOIN users adv ON adv_ds.receiver_id = adv.id
                    WHERE adv_ds.document_id = sd.id
                    AND adv.adviser_access = 1
                    AND adv.role IN ('faculty', 'admin')
                    AND adv_ds.review_status = 'Approved'
                    ORDER BY adv_ds.reviewed_at DESC
                    LIMIT 1
                ) AS adviser_reviewed_at,
                (
                    SELECT instr.fullname
                    FROM document_submissions instr_ds
                    JOIN users instr ON instr_ds.receiver_id = instr.id
                    WHERE instr_ds.document_id = sd.id
                    AND instr.instructor_access = 1
                    AND instr_ds.review_status = 'Approved'
                    ORDER BY instr_ds.reviewed_at DESC
                    LIMIT 1
                ) AS instructor_name,
                (
                    SELECT instr_ds.reviewed_at
                    FROM document_submissions instr_ds
                    JOIN users instr ON instr_ds.receiver_id = instr.id
                    WHERE instr_ds.document_id = sd.id
                    AND instr.instructor_access = 1
                    AND instr_ds.review_status = 'Approved'
                    ORDER BY instr_ds.reviewed_at DESC
                    LIMIT 1
                ) AS instructor_reviewed_at,
                (
                    SELECT chair.fullname
                    FROM document_submissions chair_ds
                    JOIN users chair ON chair_ds.receiver_id = chair.id
                    WHERE chair_ds.document_id = sd.id
                    AND (LOWER(chair.position) LIKE '%program chairperson%')
                    AND chair_ds.review_status = 'Approved'
                    ORDER BY chair_ds.reviewed_at DESC
                    LIMIT 1
                ) AS chairperson_name,
                (
                    SELECT chair_ds.reviewed_at
                    FROM document_submissions chair_ds
                    JOIN users chair ON chair_ds.receiver_id = chair.id
                    WHERE chair_ds.document_id = sd.id
                    AND (LOWER(chair.position) LIKE '%program chairperson%')
                    AND chair_ds.review_status = 'Approved'
                    ORDER BY chair_ds.reviewed_at DESC
                    LIMIT 1
                ) AS chairperson_reviewed_at
            FROM document_submissions ds
            JOIN student_documents sd
                ON ds.document_id = sd.id
            JOIN users sender
                ON ds.sender_id = sender.id
            LEFT JOIN group_members gm
                ON sender.id = gm.student_id
            LEFT JOIN capstone_groups cg
                ON gm.group_id = cg.id
            LEFT JOIN users reviewer
                ON ds.reviewed_by = reviewer.id
            WHERE ds.receiver_id = ?
            ORDER BY ds.sent_at DESC
        `;

        db.query(receivedSql, [adminDbId], (err, receivedDocuments) => {
            if(err){
                console.log(err);
                return res.json({
                    success:false,
                    message:"Failed to load received documents."
                });
            }

            const recipientsSql = `
                SELECT
                    id,
                    user_id,
                    fullname,
                    role,
                    position,
                    program,
                    year_level,
                    profile_image
                FROM users
                WHERE role IN ('student', 'faculty', 'admin')
                AND user_id != ?
                ORDER BY role ASC, fullname ASC
            `;

            db.query(recipientsSql, [userId], (err, recipients) => {
                if(err){
                    console.log(err);
                    return res.json({
                        success:false,
                        message:"Failed to load recipients."
                    });
                }

                const sentSql = `
                    SELECT
                        fds.id AS submission_id,
                        fds.submission_message,
                        fds.submission_status,
                        fds.sent_at,
                        fd.id AS document_id,
                        fd.document_code,
                        fd.document_title,
                        fd.document_type,
                        fd.file_name,
                        fd.file_path,
                        fd.file_format,
                        receiver.user_id AS receiver_user_id,
                        receiver.fullname AS receiver_name,
                        receiver.role AS receiver_role,
                        receiver.program AS receiver_program,
                        receiver.year_level AS receiver_year_level
                    FROM faculty_document_submissions fds
                    JOIN faculty_documents fd
                        ON fds.document_id = fd.id
                    JOIN users receiver
                        ON fds.receiver_id = receiver.id
                    WHERE fds.sender_id = ?
                    ORDER BY fds.sent_at DESC
                `;

                db.query(sentSql, [adminDbId], (err, sentDocuments) => {
                    if(err){
                        console.log(err);
                        return res.json({
                            success:false,
                            message:"Failed to load sent documents."
                        });
                    }

                    const pendingCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Pending Review"
                        ).length;

                    const approvedCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Approved"
                        ).length;

                    const subjectToChangeCount =
                        receivedDocuments.filter(item =>
                            item.review_status === "Subject to Change"
                        ).length;

                    res.json({
                        success:true,
                        admin,
                        stats:{
                            receivedDocuments:receivedDocuments.length,
                            sentDocuments:sentDocuments.length,
                            pendingCount,
                            approvedCount,
                            subjectToChangeCount
                        },
                        receivedDocuments,
                        sentDocuments,
                        recipients
                    });
                });
            });
        });
    });
});

/* ================= ADMIN SEND DOCUMENT ================= */

app.post("/admin-send-document", studentDocumentUpload.single("documentFile"), (req, res) => {
    const {
        adminUserId,
        documentTitle,
        documentType,
        recipientIds,
        message
    } = req.body;

    if(
        !adminUserId ||
        !documentTitle ||
        !documentType ||
        !recipientIds ||
        !req.file
    ){
        return res.json({
            success:false,
            message:"Please complete all required fields and attach a document."
        });
    }

    let selectedRecipients = [];
    try{
        selectedRecipients = JSON.parse(recipientIds);
    }catch(error){
        return res.json({
            success:false,
            message:"Invalid recipient list."
        });
    }

    if(selectedRecipients.length === 0){
        return res.json({
            success:false,
            message:"Please select at least one recipient."
        });
    }

    const adminSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {
        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to check admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Admin account not found."
            });
        }

        const adminDbId = adminResult[0].id;
        const adminName = adminResult[0].fullname;

        const documentCode = "FDOC" + Date.now();
        const filePath = "/uploads/" + req.file.filename;
        const fileFormat = req.file.mimetype;

        const insertDocumentSql = `
            INSERT INTO faculty_documents
            (
                document_code,
                uploaded_by,
                document_title,
                document_type,
                file_name,
                file_path,
                file_format,
                document_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Sent')
        `;

        db.query(
            insertDocumentSql,
            [
                documentCode,
                adminDbId,
                documentTitle,
                documentType,
                req.file.originalname,
                filePath,
                fileFormat
            ],
            (err, documentResult) => {
                if(err){
                    console.log(err);
                    return res.json({
                        success:false,
                        message:"Failed to save uploaded document."
                    });
                }

                const documentDbId = documentResult.insertId;

                const submissionValues =
                    selectedRecipients.map(receiverId => [
                        documentDbId,
                        adminDbId,
                        receiverId,
                        message || "",
                        "Sent"
                    ]);

                const insertSubmissionSql = `
                    INSERT INTO faculty_document_submissions
                    (
                        document_id,
                        sender_id,
                        receiver_id,
                        submission_message,
                        submission_status
                    )
                    VALUES ?
                `;

                db.query(insertSubmissionSql, [submissionValues], (err) => {
                    if(err){
                        console.log(err);
                        return res.json({
                            success:false,
                            message:"Document uploaded but failed to send to recipients."
                        });
                    }

                    const notificationValues =
                        selectedRecipients.map(receiverId => [
                            receiverId,
                            "Document Received",
                            `${adminName} (Admin) sent you a document titled "${documentTitle}".`,
                            "Document"
                        ]);

                    const notifySql = `
                        INSERT INTO user_notifications
                        (
                            user_id,
                            notification_title,
                            notification_message,
                            notification_type
                        )
                        VALUES ?
                    `;

                    db.query(notifySql, [notificationValues], (err) => {
                        if(err){
                            console.log(err);
                        }

                        res.json({
                            success:true,
                            message:"Document sent successfully."
                        });
                    });
                });
            }
        );
    });
});

/* ================= ADMIN REVIEW STUDENT DOCUMENT ================= */

app.put("/admin-review-student-document/:submissionId", (req, res) => {
    const submissionId = req.params.submissionId;
    const {
        adminUserId,
        reviewStatus,
        reviewComment,
        otherStatus
    } = req.body;

    if(
        !submissionId ||
        !adminUserId ||
        !reviewStatus
    ){
        return res.json({
            success:false,
            message:"Missing review information."
        });
    }

    const finalStatus =
        reviewStatus === "Other"
        ? otherStatus
        : reviewStatus;

    if(!finalStatus){
        return res.json({
            success:false,
            message:"Please provide the review status."
        });
    }

    const adminSql = `
        SELECT id, fullname
        FROM users
        WHERE user_id = ?
        AND role = 'admin'
        LIMIT 1
    `;

    db.query(adminSql, [adminUserId], (err, adminResult) => {
        if(err){
            console.log(err);
            return res.json({
                success:false,
                message:"Failed to check admin account."
            });
        }

        if(adminResult.length === 0){
            return res.json({
                success:false,
                message:"Admin account not found."
            });
        }

        const adminDbId = adminResult[0].id;
        const adminName = adminResult[0].fullname;

        const submissionSql = `
            SELECT
                ds.id,
                ds.sender_id,
                ds.receiver_id,
                ds.document_id,
                sd.document_title,
                sd.document_type,
                sd.document_status
            FROM document_submissions ds
            JOIN student_documents sd
                ON ds.document_id = sd.id
            WHERE ds.id = ?
            AND ds.receiver_id = ?
            LIMIT 1
        `;

        db.query(submissionSql, [submissionId, adminDbId], (err, submissionResult) => {
            if(err){
                console.log(err);
                return res.json({
                    success:false,
                    message:"Failed to check document submission."
                });
            }

            if(submissionResult.length === 0){
                return res.json({
                    success:false,
                    message:"Document submission not found or you are not the assigned receiver."
                });
            }

            const submission = submissionResult[0];

            const updateSql = `
                UPDATE document_submissions
                SET
                    review_status = ?,
                    review_comment = ?,
                    reviewed_by = ?,
                    reviewed_at = NOW(),
                    submission_status = 'Reviewed'
                WHERE id = ?
                AND receiver_id = ?
            `;

            db.query(
                updateSql,
                [
                    finalStatus,
                    reviewComment || "",
                    adminDbId,
                    submissionId,
                    adminDbId
                ],
                (err) => {
                    if(err){
                        console.log(err);
                        return res.json({
                            success:false,
                            message:"Failed to submit document review."
                        });
                    }

                    const notifySql = `
                        INSERT INTO user_notifications
                        (
                            user_id,
                            notification_title,
                            notification_message,
                            notification_type
                        )
                        VALUES (?, ?, ?, 'Document Review')
                    `;

                    db.query(
                        notifySql,
                        [
                            submission.sender_id,
                            "Document Reviewed",
                            `Your document "${submission.document_title}" has been reviewed by ${adminName} (Admin) (Status: ${finalStatus}).`,
                            "Document Review"
                        ],
                        (err) => {
                            if(err){
                                console.log(err);
                            }

                            res.json({
                                success:true,
                                message:"Review submitted successfully."
                            });
                        }
                    );
                }
            );
        });
    });
});

/* ================= SERVER ================= */

app.listen(3005, () => {
    console.log("Server running on port 3005");
    runConsultationStatusSync(); /* Run once on startup */
});