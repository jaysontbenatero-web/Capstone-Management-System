require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");
const pdfParse = require("pdf-parse");
const { PDFDocument } = require("pdf-lib");
const nodemailer = require("nodemailer");
const semEngine = require("./similarity-engine");
// Pre-load Hugging Face model asynchronously on module load
semEngine.loadModel().catch(() => {});

const app = express();

/* ================= EMAIL TRANSPORTER SETUP ================= */

const mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

async function sendCredentialEmail(recipientEmail, fullname, userId, tempPassword, roleName) {
    if (!recipientEmail || !recipientEmail.trim()) {
        console.log(`[Email Notice] Skipping email dispatch for ${fullname}: No email address provided.`);
        return;
    }

    const htmlContent = `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f0fa; padding: 40px 15px; color: #2d1b45;">
            <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.12), 0 4px 6px rgba(0, 0, 0, 0.04); border: 1px solid #ede9fe;">
                
                <!-- Purple Header -->
                <div style="background: linear-gradient(135deg, #4c1d95 0%, #6d28d9 55%, #7c3aed 100%); padding: 32px 25px; text-align: center; color: #ffffff;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎓</div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">Capstone Management System</h1>
                    <p style="margin: 6px 0 0 0; color: #e9d5ff; font-size: 14px; font-weight: 500; letter-spacing: 0.3px;">Account Access Credentials</p>
                </div>
                
                <!-- Email Body Content -->
                <div style="padding: 35px 30px;">
                    <p style="font-size: 16px; color: #2e1065; margin-top: 0; line-height: 1.5;">Hello <strong style="color: #6d28d9;">${fullname}</strong>,</p>
                    <p style="font-size: 14px; color: #4c4d6d; line-height: 1.6; margin-bottom: 24px;">
                        Your official portal account has been created for the <strong>Capstone Management System</strong> as a <strong>${roleName}</strong>. Below are your initial login credentials:
                    </p>
                    
                    <!-- Purple Highlighted Box for Credentials -->
                    <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-left: 5px solid #7c3aed; border-radius: 10px; padding: 20px 24px; margin: 25px 0;">
                        <div style="margin-bottom: 14px;">
                            <span style="font-size: 11px; text-transform: uppercase; color: #6d5f85; font-weight: 700; letter-spacing: 0.8px; display: block; margin-bottom: 4px;">User ID / Username</span>
                            <span style="font-size: 18px; font-weight: 700; color: #2e1065; font-family: 'Courier New', Courier, monospace; background: #ede9fe; padding: 3px 8px; border-radius: 6px; display: inline-block;">${userId}</span>
                        </div>
                        <div>
                            <span style="font-size: 11px; text-transform: uppercase; color: #6d5f85; font-weight: 700; letter-spacing: 0.8px; display: block; margin-bottom: 4px;">Temporary Password</span>
                            <span style="font-size: 18px; font-weight: 700; color: #6d28d9; font-family: 'Courier New', Courier, monospace; background: #ede9fe; padding: 3px 8px; border-radius: 6px; display: inline-block;">${tempPassword}</span>
                        </div>
                    </div>
                    
                    <p style="font-size: 13px; color: #6d5f85; line-height: 1.5; margin-bottom: 28px;">
                        🔒 Please log in using these credentials and update your password upon your initial sign-in for security.
                    </p>
                    
                    <!-- Primary CTA Button -->
                    <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
                        <a href="${process.env.APP_URL || "http://localhost:3005"}" style="background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(109, 40, 217, 0.35);">
                            Access Portal Login
                        </a>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #faf8ff; padding: 18px 20px; text-align: center; font-size: 12px; color: #7c3aed; border-top: 1px solid #ede9fe;">
                    &copy; 2026 Capstone Management System. All rights reserved.
                </div>
            </div>
        </div>
    `;

    try {
        const mailOptions = {
            from: `"CMS Portal System" <${process.env.GMAIL_USER}>`,
            to: recipientEmail,
            subject: "Your Capstone Management System Credentials",
            html: htmlContent
        };

        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`[Email Success] Sent credentials to ${recipientEmail} (${fullname}) - Message ID: ${info.messageId}`);
    } catch (err) {
        console.error(`[Email Error] Failed sending email to ${recipientEmail}:`, err.message || err);
    }
}

/* ================= MIDDLEWARE ================= */

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || origin === "null") {
        // file:// pages send Origin: "null" — allow wildcard without credentials header
        res.header("Access-Control-Allow-Origin", "*");
    } else {
        // http:// or https:// origins — echo back origin and allow credentials
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Private-Network", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Private-Network");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});

app.get("/", (req, res) => {
    res.redirect("/Log-in.html");
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(__dirname, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }
}));

// Case-insensitive static asset fallback for Linux Docker containers
app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const reqPath = decodeURIComponent(req.path || "").replace(/^\/+/, "");
    if (!reqPath || !/\.(html|css|js|png|jpg|jpeg|svg|gif|webp|ico|pdf)$/i.test(reqPath)) {
        return next();
    }
    const parts = reqPath.split("/").filter(Boolean);
    let currentDir = __dirname;
    for (let i = 0; i < parts.length; i++) {
        if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) return next();
        const entries = fs.readdirSync(currentDir);
        const match = entries.find(e => e.toLowerCase() === parts[i].toLowerCase());
        if (!match) return next();
        currentDir = path.join(currentDir, match);
    }
    if (fs.existsSync(currentDir) && fs.statSync(currentDir).isFile()) {
        return res.sendFile(currentDir);
    }
    next();
});

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

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "capx_db",
    port: Number(process.env.DB_PORT) || 3307,
    waitForConnections: true,
    connectionLimit: 25,
    queueLimit: 0
});

/* ================= CONNECT ================= */

        db.getConnection((err, connection) => {
    if (err) {
        console.log("MySQL Pool Connection Error:", err);
    } else {
        console.log("MySQL Connected via Connection Pool");
        connection.release();

        const ensureCol = (tbl, col, def) => {
            db.query(
                "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
                [tbl, col],
                (e, r) => {
                    if (!e && Array.isArray(r) && r.length === 0) {
                        db.query(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`, () => {});
                    }
                }
            );
        };
        ensureCol("consultations", "decline_reason", "TEXT NULL");
        ensureCol("consultations", "declined_at", "TIMESTAMP NULL");
        ensureCol("users", "consultation_available", "TINYINT(1) NOT NULL DEFAULT 1");

        const checkEmailColumnSql = `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'users'
            AND column_name = 'email'
            LIMIT 1
        `;

        db.query(checkEmailColumnSql, (checkErr, checkResult) => {
            if (!checkErr && Array.isArray(checkResult) && checkResult.length === 0) {
                db.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL`, (addErr) => {
                    if (addErr) {
                        console.error("Unable to add users.email column:", addErr);
                    } else {
                        console.log("users.email column created successfully");
                    }
                });
            }
        });

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

        const checkConsultationFileColSql = `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'consultations'
            AND column_name = 'file_path'
            LIMIT 1
        `;

        db.query(checkConsultationFileColSql, (colErr, colResult) => {
            if (!colErr && (!colResult || colResult.length === 0)) {
                db.query(`ALTER TABLE consultations ADD COLUMN file_path VARCHAR(500) NULL, ADD COLUMN file_name VARCHAR(255) NULL`, (addErr) => {
                    if (addErr) console.error("Error adding file columns to consultations:", addErr);
                    else console.log("consultations.file_path and file_name columns created");
                });
            } else {
                console.log("consultations.file_path column already exists");
            }
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
                matched_repository_id INT NULL,
                matched_source_type VARCHAR(50) DEFAULT 'repository',
                matched_approved_title VARCHAR(500) NULL,
                matched_group_name VARCHAR(255) NULL,
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
            // Run column migrations for existing databases
            const checkSimTableCols = `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                AND table_name = 'title_similarity_results'
            `;
            db.query(checkSimTableCols, (errCols, colResults) => {
                if (!errCols && Array.isArray(colResults)) {
                    const existingCols = colResults.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());
                    db.query(`ALTER TABLE title_similarity_results MODIFY COLUMN matched_repository_id INT NULL`, () => {});
                    if (!existingCols.includes('matched_source_type')) {
                        db.query(`ALTER TABLE title_similarity_results ADD COLUMN matched_source_type VARCHAR(50) DEFAULT 'repository'`, () => {});
                    }
                    if (!existingCols.includes('matched_approved_title')) {
                        db.query(`ALTER TABLE title_similarity_results ADD COLUMN matched_approved_title VARCHAR(500) NULL`, () => {});
                    }
                    if (!existingCols.includes('matched_group_name')) {
                        db.query(`ALTER TABLE title_similarity_results ADD COLUMN matched_group_name VARCHAR(255) NULL`, () => {});
                    }
                    if (!existingCols.includes('archived_match_details')) {
                        db.query(`ALTER TABLE title_similarity_results ADD COLUMN archived_match_details LONGTEXT NULL`, () => {});
                    }
                    if (!existingCols.includes('ongoing_match_details')) {
                        db.query(`ALTER TABLE title_similarity_results ADD COLUMN ongoing_match_details LONGTEXT NULL`, () => {});
                    }
                }
            });
        });

        /* ---- env_scan_student_signatures table ---- */
        const createEnvScanSigsTable = `
            CREATE TABLE IF NOT EXISTS env_scan_student_signatures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                document_id INT NOT NULL,
                student_user_id VARCHAR(50) NOT NULL,
                student_name VARCHAR(255) NULL,
                student_position VARCHAR(100) NULL,
                signed_file_path VARCHAR(500) NULL,
                signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_doc_student (document_id, student_user_id)
            )
        `;
        db.query(createEnvScanSigsTable, (sigTableErr) => {
            if (sigTableErr) {
                console.error("Error creating env_scan_student_signatures table:", sigTableErr);
            } else {
                console.log("env_scan_student_signatures table verified/created");
            }
        });
        /* ---- student_status column on users ---- */
        const checkStudentStatusCol = `
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'users'
            AND column_name = 'student_status'
            LIMIT 1
        `;
        db.query(checkStudentStatusCol, (stErr, stResult) => {
            if(!stErr && !(Array.isArray(stResult) && stResult.length > 0)){
                db.query(`ALTER TABLE users ADD COLUMN student_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'`, (addErr) => {
                    if(addErr){ console.error("Unable to add student_status column:", addErr); }
                    else { console.log("users.student_status column created"); }
                });
            }
        });

        /* ---- submission_count column on student_documents ---- */
        const checkSubmissionCountCol = `
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'student_documents'
            AND column_name = 'submission_count'
            LIMIT 1
        `;
        db.query(checkSubmissionCountCol, (scErr, scResult) => {
            if(!scErr && !(Array.isArray(scResult) && scResult.length > 0)){
                db.query(`ALTER TABLE student_documents ADD COLUMN submission_count INT DEFAULT 0`, (addErr) => {
                    if(addErr){ console.error("Unable to add submission_count column:", addErr); }
                    else { console.log("student_documents.submission_count column created"); }
                });
            }
        });

        /* ---- research_problem & methodology columns on repository ---- */
        const checkRepoCols = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'repository'
            AND column_name IN ('research_problem', 'methodology')
        `;
        db.query(checkRepoCols, (rErr, rResult) => {
            if (!rErr && Array.isArray(rResult)) {
                const existing = rResult.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());
                if (!existing.includes('research_problem')) {
                    db.query("ALTER TABLE repository ADD COLUMN research_problem TEXT NULL", () => {
                        console.log("repository.research_problem column verified/created");
                    });
                }
                if (!existing.includes('methodology')) {
                    db.query("ALTER TABLE repository ADD COLUMN methodology TEXT NULL", () => {
                        console.log("repository.methodology column verified/created");
                    });
                }
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

        const storedPwd = String(user.password || "");
        const isBcrypt = storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$");
        const verifyPromise = isBcrypt
            ? bcrypt.compare(String(password), storedPwd)
            : Promise.resolve(storedPwd === String(password));

        verifyPromise.then((isMatch) => {
            if(!isMatch){
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
        }).catch((cmpErr) => {
            console.error("bcrypt compare error:", cmpErr);
            return res.json({
                success:false,
                message:"Error verifying password."
            });
        });

    });

});

/* ================= ENROLL FACULTY ================= */

app.post("/enroll-faculty", (req, res) => {
    const { fullname, position, email } = req.body;
    const year = new Date().getFullYear();

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'FAC${year}-%'
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

        const facultyId = `FAC${year}-${String(nextNumber).padStart(4, "0")}`;
        const tempPassword = "FAC" + Math.floor(1000 + Math.random() * 9000);

        bcrypt.hash(tempPassword, 10).then((hashedPassword) => {
        const sqlInsert = `
            INSERT INTO users
            (
                user_id,
                fullname,
                password,
                role,
                position,
                email
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sqlInsert,
            [facultyId, fullname, hashedPassword, "faculty", position, email || null],
            (err) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                if (email) {
                    sendCredentialEmail(email, fullname, facultyId, tempPassword, "Faculty");
                }

                res.json({
                    success: true,
                    facultyId,
                    tempPassword
                });
            }
        );
        }).catch((hashErr) => {
            console.error(hashErr);
            res.json({ success: false });
        });
    });
});

/* ================= ENROLL ADMIN ================= */

app.post("/enroll-admin", (req, res) => {
    const { fullname, position, email, password: customPassword } = req.body;
    const year = new Date().getFullYear();

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'ADM${year}-%'
        ORDER BY CAST(SUBSTRING_INDEX(user_id, '-', -1) AS UNSIGNED) DESC
        LIMIT 1
    `;

    db.query(sqlLast, (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false, message: "DB error generating admin ID." });
        }

        let nextNumber = 1;
        if (result.length > 0) {
            const lastId = result[0].user_id;
            nextNumber = parseInt(lastId.split("-")[1]) + 1;
        }

        const adminId = `ADM${year}-${String(nextNumber).padStart(4, "0")}`;
        const tempPassword = customPassword || ("ADM" + Math.floor(1000 + Math.random() * 9000));

        // Get access flags from first existing admin as template
        const templateSql = `
            SELECT position, program, adviser_access, panelist_access, instructor_access
            FROM users WHERE role = 'admin' ORDER BY id LIMIT 1
        `;
        db.query(templateSql, async (err2, tmpl) => {
            try {
                const hashedPassword = await bcrypt.hash(String(tempPassword), 10);
                const t = (tmpl && tmpl[0]) || {};
                const sqlInsert = `
                    INSERT INTO users
                    (
                        user_id, fullname, password, role, position, program,
                        email, adviser_access, panelist_access, instructor_access,
                        force_password_change
                    )
                    VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, 0)
                `;
                db.query(
                    sqlInsert,
                    [
                        adminId,
                        fullname || adminId,
                        hashedPassword,
                        position || t.position || "Dean",
                        t.program || "Dean Office",
                        email || null,
                        t.adviser_access ?? 1,
                        t.panelist_access ?? 1,
                        t.instructor_access ?? 1
                    ],
                    (err3) => {
                        if (err3) {
                            console.log(err3);
                            return res.json({ success: false, message: "Insert failed." });
                        }
                        if (email) {
                            sendCredentialEmail(email, fullname || adminId, adminId, tempPassword, "Admin");
                        }
                        res.json({ success: true, adminId, tempPassword });
                    }
                );
            } catch (hashErr) {
                console.error(hashErr);
                res.json({ success: false, message: "Password hashing failed." });
            }
        });
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

app.put("/edit-faculty", async (req, res) => {
    const { id, position, password } = req.body;

    try {
        if (password && String(password).trim() !== "") {
            const rawPwd = String(password).trim();
            const isBcrypt = rawPwd.startsWith("$2a$") || rawPwd.startsWith("$2b$");
            const hashedPwd = isBcrypt ? rawPwd : await bcrypt.hash(rawPwd, 10);
            const sql = `
                UPDATE users
                SET
                    position = ?,
                    password = ?
                WHERE id = ?
            `;
            db.query(sql, [position, hashedPwd, id], (err) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }
                if (!isBcrypt) {
                    db.query("SELECT user_id, fullname, email FROM users WHERE id = ? LIMIT 1", [id], (eErr, uRows) => {
                        if (!eErr && uRows && uRows.length > 0 && uRows[0].email) {
                            sendCredentialEmail(uRows[0].email, uRows[0].fullname, uRows[0].user_id, rawPwd, "Faculty");
                        }
                    });
                }
                res.json({ success: true });
            });
        } else {
            const sql = `
                UPDATE users
                SET position = ?
                WHERE id = ?
            `;
            db.query(sql, [position, id], (err) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }
                res.json({ success: true });
            });
        }
    } catch (e) {
        console.error(e);
        res.json({ success: false });
    }
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
        enrolledByUserId,
        email
    } = req.body;

    const position = student_position || "Not Assigned";
    const year = new Date().getFullYear();

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'STU${year}-%'
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

        const studentId = `STU${year}-${String(nextNumber).padStart(4, "0")}`;
        const tempPassword = Math.random().toString(36).slice(-8);

        bcrypt.hash(tempPassword, 10).then((hashedPassword) => {
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
                enrolled_by_user_id,
                email
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sqlInsert,
            [
                studentId,
                fullname,
                hashedPassword,
                "student",
                program,
                year_level,
                position,
                enrolledByUserId || null,
                email || null
            ],
            (err) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false });
                }

                if (email) {
                    sendCredentialEmail(email, fullname, studentId, tempPassword, "Student");
                }

                res.json({
                    success: true,
                    studentId,
                    tempPassword
                });
            }
        );
        }).catch((hashErr) => {
            console.error(hashErr);
            res.json({ success: false });
        });
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
        SELECT
            u.id,
            u.user_id,
            u.fullname,
            u.role,
            u.program,
            u.year_level,
            u.student_position,
            u.password,
            COALESCE(u.student_status, 'ACTIVE') AS student_status,
            u.enrolled_by_user_id,
            u.created_at,
            cg.id AS group_db_id,
            cg.group_id AS group_code,
            cg.group_name
        FROM users u
        LEFT JOIN group_members gm ON u.id = gm.student_id
        LEFT JOIN capstone_groups cg ON gm.group_id = cg.id
        WHERE u.role = 'student'
        ${isMine ? "AND u.enrolled_by_user_id = ?" : ""}
        ORDER BY u.id DESC
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
    const studentIdentifier = req.params.id;
    if (!studentIdentifier) {
        return res.json({ success: false, message: "Missing student ID." });
    }

    // 1. Find student by database id or user_id (e.g. STU2026-0001)
    const findStudentSql = `SELECT id, user_id, fullname FROM users WHERE (id = ? OR user_id = ?) AND role = 'student' LIMIT 1`;
    db.query(findStudentSql, [studentIdentifier, studentIdentifier], (findErr, findRows) => {
        if (findErr) {
            console.error("Delete student lookup error:", findErr);
            return res.json({ success: false, message: "Database error looking up student." });
        }
        if (!findRows || findRows.length === 0) {
            return res.json({ success: false, message: "Student account not found or already deleted." });
        }

        const student = findRows[0];
        const studentDbId = student.id;

        // 2. Check if student is in any capstone group via group_members
        const groupCheckSql = `
            SELECT gm.group_id, cg.group_name, cg.group_id AS group_code
            FROM group_members gm
            JOIN capstone_groups cg ON gm.group_id = cg.id
            WHERE gm.student_id = ?
            LIMIT 1
        `;

        db.query(groupCheckSql, [studentDbId], (grpErr, grpRows) => {
            if (grpErr) {
                console.error("Group check error:", grpErr);
                return res.json({ success: false, message: "Database error checking group membership." });
            }

            if (grpRows && grpRows.length > 0) {
                const gName = grpRows[0].group_name || grpRows[0].group_code || "a capstone group";
                return res.json({
                    success: false,
                    message: `Cannot delete student "${student.fullname}" because they are currently enrolled in capstone group "${gName}". Students assigned to a group cannot be deleted.`
                });
            }

            // 3. Check if student is Project Manager of any capstone group
            const pmCheckSql = `SELECT id, group_name FROM capstone_groups WHERE project_manager_id = ? LIMIT 1`;
            db.query(pmCheckSql, [studentDbId], (pmErr, pmRows) => {
                if (pmErr) {
                    console.error("PM check error:", pmErr);
                    return res.json({ success: false, message: "Database error checking group project manager." });
                }

                if (pmRows && pmRows.length > 0) {
                    return res.json({
                        success: false,
                        message: `Cannot delete student "${student.fullname}" because they are assigned as Project Manager of "${pmRows[0].group_name}".`
                    });
                }

                // 4. Student has NO group. Clean up dependent/orphan records safely.
                db.query("DELETE FROM user_notifications WHERE user_id = ?", [studentDbId], () => {});
                db.query("DELETE FROM student_hidden_updates WHERE student_id = ?", [studentDbId], () => {});
                db.query("DELETE FROM env_scan_student_signatures WHERE student_id = ?", [studentDbId], () => {});
                db.query("DELETE FROM title_proposals WHERE uploaded_by = ? AND (group_id IS NULL OR group_id = 0)", [studentDbId], () => {});
                db.query("DELETE FROM student_documents WHERE uploaded_by = ? AND (group_id IS NULL OR group_id = 0)", [studentDbId], () => {});

                // 5. Delete from users table
                const delUserSql = `DELETE FROM users WHERE id = ? AND role = 'student'`;
                db.query(delUserSql, [studentDbId], (delErr, delResult) => {
                    if (delErr) {
                        console.error("Delete user error:", delErr);
                        return res.json({ success: false, message: "Failed to delete student account: " + delErr.message });
                    }

                    console.log(`[STUDENT DELETED] Student "${student.fullname}" (ID: ${student.user_id}, DB ID: ${studentDbId}) permanently deleted.`);
                    return res.json({
                        success: true,
                        message: `Student "${student.fullname}" (${student.user_id}) was successfully deleted.`
                    });
                });
            });
        });
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
        student_status,
        requestorRole,
        requestorUserId
    } = req.body;

    if (!id) {
        return res.json({ success: false, message: "Missing student ID." });
    }

    let validStatus = "ACTIVE";
    if (student_status) {
        const upper = String(student_status).trim().toUpperCase();
        if (["ACTIVE", "INACTIVE", "DROPPED"].includes(upper)) {
            validStatus = upper;
        }
    }

    const handleUpdate = () => {
        // Check if student belongs to a capstone group
        const groupCheckSql = `
            SELECT gm.group_id, cg.group_name
            FROM group_members gm
            JOIN capstone_groups cg ON gm.group_id = cg.id
            WHERE gm.student_id = ?
            LIMIT 1
        `;

        db.query(groupCheckSql, [id], (errGrp, grpRows) => {
            if (errGrp) {
                console.log(errGrp);
                return res.json({ success: false, message: "Database error checking group membership." });
            }

            const inGroup = grpRows && grpRows.length > 0;

            const rawPwd = password ? String(password).trim() : "";
            const isPlainNewPwd = rawPwd !== "" && !rawPwd.startsWith("$2a$") && !rawPwd.startsWith("$2b$");

            const resolvePasswordHash = async () => {
                if (!rawPwd) return null;
                if (!isPlainNewPwd) return rawPwd;
                return await bcrypt.hash(rawPwd, 10);
            };

            const notifyIfPasswordChanged = () => {
                if (!isPlainNewPwd) return;
                db.query("SELECT user_id, fullname, email FROM users WHERE id = ? LIMIT 1", [id], (eErr, uRows) => {
                    if (!eErr && uRows && uRows.length > 0 && uRows[0].email) {
                        sendCredentialEmail(uRows[0].email, fullname || uRows[0].fullname, uRows[0].user_id, rawPwd, "Student");
                    }
                });
            };

            resolvePasswordHash().then((hashedPwd) => {
                if (inGroup) {
                    const sql = hashedPwd
                        ? `UPDATE users SET fullname = ?, password = ?, student_status = ? WHERE id = ?`
                        : `UPDATE users SET fullname = ?, student_status = ? WHERE id = ?`;
                    const params = hashedPwd ? [fullname, hashedPwd, validStatus, id] : [fullname, validStatus, id];
                    db.query(sql, params, (err) => {
                        if (err) {
                            console.log(err);
                            return res.json({ success: false, message: "Failed to update student." });
                        }
                        notifyIfPasswordChanged();
                        res.json({ success: true, in_group: true });
                    });
                } else {
                    const sql = hashedPwd
                        ? `UPDATE users SET fullname = ?, program = ?, year_level = ?, student_position = ?, password = ?, student_status = ? WHERE id = ?`
                        : `UPDATE users SET fullname = ?, program = ?, year_level = ?, student_position = ?, student_status = ? WHERE id = ?`;
                    const params = hashedPwd
                        ? [fullname, program, year_level, student_position, hashedPwd, validStatus, id]
                        : [fullname, program, year_level, student_position, validStatus, id];
                    db.query(sql, params, (err) => {
                        if (err) {
                            console.log(err);
                            return res.json({ success: false, message: "Failed to update student." });
                        }
                        notifyIfPasswordChanged();
                        res.json({ success: true, in_group: false });
                    });
                }
            }).catch((hashErr) => {
                console.error(hashErr);
                res.json({ success: false, message: "Failed to hash student password." });
            });
        });
    };

    if (String(requestorRole || "").toLowerCase() !== "admin") {
        const ownerSql = `
            SELECT id
            FROM users
            WHERE id = ?
            AND role = 'student'
            AND enrolled_by_user_id = ?
            LIMIT 1
        `;

        db.query(
            ownerSql,
            [
                id,
                requestorUserId || ""
            ],
            (err, ownerResult) => {
                if (err) {
                    console.log(err);
                    return res.json({ success: false, message: "Database error." });
                }

                if (ownerResult.length === 0) {
                    return res.json({
                        success: false,
                        message: "You can only edit students you enrolled."
                    });
                }

                handleUpdate();
            }
        );
        return;
    }

    handleUpdate();
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
        student_position: String(s.student_position || "").trim() || "Not Assigned",
        email: String(s.email || s.student_email || "").trim()
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
    const year = new Date().getFullYear();

    const sqlLast = `
        SELECT user_id
        FROM users
        WHERE user_id LIKE 'STU${year}-%'
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
                enrolled_by_user_id,
                email
            )
            VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?)
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
            const studentId = `STU${year}-${String(nextNumber).padStart(4, "0")}`;
            nextNumber += 1;
            const tempPassword = Math.random().toString(36).slice(-8);

            bcrypt.hash(tempPassword, 10).then((hashedPassword) => {
            db.query(
                insertSql,
                [
                    studentId,
                    row.fullname,
                    hashedPassword,
                    row.program,
                    row.year_level,
                    row.student_position,
                    enrolledByUserId || null,
                    row.email || null
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
                        if (row.email) {
                            sendCredentialEmail(row.email, row.fullname, studentId, tempPassword, "Student");
                        }

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
            }).catch((hashErr) => {
                console.error(hashErr);
                results.push({
                    rowIndex: idx + 1,
                    fullname: row.fullname,
                    success: false,
                    error: "Password hashing failed"
                });
                insertNext(idx + 1);
            });
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
        research_problem,
        methodology,
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
            research_problem,
            methodology,
            researchers,
            adviser,
            category,
            year
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            program,
            title,
            abstract,
            objectives,
            research_problem || null,
            methodology || null,
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

/* ================= UPDATE REPOSITORY ================= */

app.put("/update-repository/:id", (req, res) => {
    const {
        program,
        title,
        abstract,
        objectives,
        research_problem,
        methodology,
        researchers,
        adviser,
        category,
        year
    } = req.body;

    const sql = `
        UPDATE repository
        SET
            program = ?,
            title = ?,
            abstract = ?,
            objectives = ?,
            research_problem = ?,
            methodology = ?,
            researchers = ?,
            adviser = ?,
            category = ?,
            year = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            program,
            title,
            abstract,
            objectives,
            research_problem || null,
            methodology || null,
            researchers,
            adviser,
            category,
            year,
            req.params.id
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

/* ================= SEMANTIC REPOSITORY SEARCH ================= */
/*
 * GET /repository-search?q=<query>
 *
 * Three-tier search (fastest-first, falls back gracefully):
 *   Tier 1 — Synonym expansion (instant, zero-network):
 *             "ojt" → also matches internship, practicum, training, etc.
 *   Tier 2 — Gemini text-embedding-004 semantic embedding (API call):
 *             Scores every record by cosine similarity with the query.
 *   Tier 3 — Safe keyword fallback if Gemini is unreachable.
 *
 * Returns all records ranked by relevance (score > 0 first, then rest).
 */

// ── Synonym map (expand query terms before scoring) ─────────────────
const SYNONYM_MAP = {
    ojt:         ["ojt", "internship", "practicum", "training", "on-the-job", "field work", "apprentice"],
    internship:  ["internship", "ojt", "practicum", "training", "on-the-job", "placement"],
    practicum:   ["practicum", "ojt", "internship", "training", "field work"],
    inventory:   ["inventory", "stock", "warehouse", "supply chain", "asset tracking", "stockroom"],
    management:  ["management", "administration", "monitoring", "tracking", "oversight", "control"],
    tracking:    ["tracking", "monitoring", "tracing", "surveillance", "logging"],
    monitoring:  ["monitoring", "tracking", "surveillance", "observation", "dashboard"],
    web:         ["web", "online", "internet", "browser", "website", "web-based", "portal"],
    mobile:      ["mobile", "android", "ios", "app", "smartphone", "handheld"],
    system:      ["system", "platform", "application", "tool", "software", "solution"],
    student:     ["student", "learner", "scholar", "undergraduate", "academic", "pupil"],
    grade:       ["grade", "score", "marks", "evaluation", "assessment", "rating"],
    attendance:  ["attendance", "presence", "time-in", "log", "absences"],
    sales:       ["sales", "revenue", "commerce", "transaction", "ecommerce", "point-of-sale"],
    library:     ["library", "books", "catalogue", "resources", "lending", "borrowing"],
    health:      ["health", "medical", "clinic", "hospital", "patient", "wellness"],
    schedule:    ["schedule", "calendar", "timetable", "appointment", "booking", "planner"],
    ai:          ["ai", "artificial intelligence", "machine learning", "deep learning", "neural", "nlp"],
    data:        ["data", "analytics", "statistics", "reporting", "insights", "dashboard"],
    coffee:      ["coffee", "cafe", "beverage", "brew", "drink", "menu"],
    shop:        ["shop", "store", "retail", "marketplace", "commerce", "business"],
};

function expandQuery(rawQuery) {
    const lower = rawQuery.toLowerCase().trim();
    const tokens = lower.split(/\s+/);
    const expanded = new Set(tokens);
    tokens.forEach(tok => {
        if (SYNONYM_MAP[tok]) SYNONYM_MAP[tok].forEach(s => expanded.add(s));
    });
    return [...expanded];
}

function keywordScore(item, expandedTerms) {
    const haystack = [
        item.title, item.abstract, item.objectives,
        item.research_problem, item.methodology,
        item.category, item.researchers, item.adviser
    ].map(v => String(v || "").toLowerCase()).join(" ");

    let hits = 0;
    expandedTerms.forEach(term => { if (haystack.includes(term)) hits++; });
    return hits / expandedTerms.length; // 0–1
}

// ── Gemini Cloud AI (gemini-embedding-001) via HTTPS (Layer 1) ───────
function geminiEmbed(text) {
    return new Promise((resolve) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return resolve({ values: null, error: "GEMINI_API_KEY is not configured in .env" });
        }

        const truncated = String(text || "").slice(0, 2048);
        const payload = JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: truncated }] }
        });

        const opts = {
            hostname: "generativelanguage.googleapis.com",
            path: `/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        };

        const req = https.request(opts, (res2) => {
            let raw = "";
            res2.on("data", c => raw += c);
            res2.on("end", () => {
                try {
                    const parsed = JSON.parse(raw);
                    if (res2.statusCode !== 200) {
                        const errMsg = parsed?.error?.message || `HTTP ${res2.statusCode}: ${raw.slice(0, 150)}`;
                        return resolve({ values: null, error: errMsg });
                    }
                    const values = parsed?.embedding?.values;
                    if (Array.isArray(values) && values.length > 0) {
                        return resolve({ values, error: null });
                    }
                    return resolve({ values: null, error: "Empty or malformed embedding in API response" });
                } catch (e) {
                    return resolve({ values: null, error: `JSON parse error: ${e.message} (HTTP ${res2.statusCode})` });
                }
            });
        });
        req.on("error", (err) => resolve({ values: null, error: `Network error: ${err.message}` }));
        req.setTimeout(6000, () => {
            req.destroy();
            resolve({ values: null, error: "Request timed out after 6000ms" });
        });
        req.write(payload);
        req.end();
    });
}

function cosineScore(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// In-memory cache for repository study embeddings (Layer 2: Local Hugging Face)
const hfStudyEmbeddingsCache = new Map();

async function getOrComputeStudyEmbedding(record) {
    const cacheKey = `${record.id}_${(record.title || "").slice(0, 30)}`;
    if (hfStudyEmbeddingsCache.has(cacheKey)) {
        return hfStudyEmbeddingsCache.get(cacheKey);
    }
    const textToEmbed = [
        record.title,
        record.abstract,
        record.objectives,
        record.research_problem,
        record.methodology
    ].filter(Boolean).join(" ");

    const emb = await semEngine.embed(textToEmbed);
    hfStudyEmbeddingsCache.set(cacheKey, emb);
    return emb;
}

app.get("/repository-search", (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) {
        // No query → return all titles (normal load)
        const sql = "SELECT * FROM repository ORDER BY id DESC";
        return db.query(sql, (err, rows) => {
            if (err) return res.json({ success: false });
            res.json({ success: true, titles: rows, mode: "all" });
        });
    }

    const sql = "SELECT * FROM repository ORDER BY id DESC";
    db.query(sql, async (err, rows) => {
        if (err) return res.json({ success: false });
        if (!rows || rows.length === 0) return res.json({ success: true, titles: [], mode: "empty" });

        const expandedTerms = expandQuery(query);

        let scored = null;
        let layerMode = "keyword";

        // ══════════════════════════════════════════════════════════════════
        // LAYER 1: Gemini Cloud AI (Google gemini-embedding-001)
        // ══════════════════════════════════════════════════════════════════
        try {
            const geminiQueryRes = await geminiEmbed(query);
            if (geminiQueryRes && geminiQueryRes.values) {
                const queryEmbedding = geminiQueryRes.values;
                const recordTexts = rows.map(r =>
                    [r.title, r.abstract, r.objectives, r.research_problem, r.methodology]
                        .filter(Boolean).join(" ").slice(0, 2048)
                );

                const batchSize = 5;
                const embeddings = [];
                let batchError = null;

                for (let i = 0; i < recordTexts.length; i += batchSize) {
                    const batch = recordTexts.slice(i, i + batchSize);
                    const batchResults = await Promise.all(batch.map(t => geminiEmbed(t)));
                    for (const bRes of batchResults) {
                        if (!bRes || !bRes.values) {
                            batchError = bRes ? bRes.error : "Unknown embedding failure";
                            break;
                        }
                        embeddings.push(bRes.values);
                    }
                    if (batchError) break;
                }

                if (!batchError && embeddings.length === rows.length) {
                    scored = rows.map((r, i) => {
                        const semSim = cosineScore(queryEmbedding, embeddings[i]);
                        const kwSim  = keywordScore(r, expandedTerms);
                        const finalScore = (semSim * 0.70) + (kwSim * 0.30);
                        return { ...r, _score: finalScore, _mode: "gemini" };
                    });
                    layerMode = "gemini";
                    console.log(`[Search] Layer 1: Gemini (query: "${query}")`);
                } else if (batchError) {
                    console.warn(`[Search] Layer 1 (Gemini) failed: ${batchError}`);
                }
            } else {
                const reason = geminiQueryRes ? geminiQueryRes.error : "Unknown error";
                console.warn(`[Search] Layer 1 (Gemini) failed: ${reason}`);
            }
        } catch (geminiEx) {
            console.warn(`[Search] Layer 1 (Gemini) failed: ${geminiEx.message}`);
        }

        // ══════════════════════════════════════════════════════════════════
        // LAYER 2: Local Hugging Face AI Backup (Xenova/all-MiniLM-L6-v2)
        // ══════════════════════════════════════════════════════════════════
        if (!scored) {
            try {
                if (!semEngine.isModelReady()) {
                    await semEngine.loadModel();
                }

                if (semEngine.isModelReady() && typeof semEngine.embed === 'function') {
                    const queryHfEmbed = await semEngine.embed(query);
                    const recordHfEmbeddings = await Promise.all(rows.map(r => getOrComputeStudyEmbedding(r)));

                    scored = rows.map((r, i) => {
                        const semSim = semEngine.cosineSimilarity(queryHfEmbed, recordHfEmbeddings[i]);
                        const kwSim  = keywordScore(r, expandedTerms);
                        const finalScore = (semSim * 0.70) + (kwSim * 0.30);
                        return { ...r, _score: finalScore, _mode: "huggingface" };
                    });
                    layerMode = "huggingface";
                    console.log(`[Search] Layer 2: Local HuggingFace (query: "${query}")`);
                } else {
                    console.warn(`[Search] Layer 2 (Local HuggingFace) model not ready.`);
                }
            } catch (hfEx) {
                console.warn(`[Search] Layer 2 (Local HuggingFace) failed: ${hfEx.message}`);
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // LAYER 3: Synonym + Keyword Safety Net
        // ══════════════════════════════════════════════════════════════════
        if (!scored) {
            scored = rows.map(r => ({
                ...r,
                _score: keywordScore(r, expandedTerms),
                _mode: "keyword"
            }));
            layerMode = "keyword";
            console.log(`[Search] Layer 3: Keyword Fallback (query: "${query}")`);
        }

        // Sort: highest score first; ties keep original order
        scored.sort((a, b) => b._score - a._score);

        // Always return all records (UI can show "0% match" items at bottom)
        // But separate them: matched (score > 0) vs unmatched
        const matched   = scored.filter(r => r._score > 0.05);
        const unmatched = scored.filter(r => r._score <= 0.05);
        const finalList = [...matched, ...unmatched];

        finalList.forEach(r => { delete r._score; delete r._mode; });

        res.json({
            success: true,
            titles: finalList,
            mode: layerMode,
            matchCount: matched.length
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
            inst.fullname AS instructor_name,
            cg.id AS existing_group_db_id,
            cg.group_id AS existing_group_code,
            cg.group_name AS existing_group_name
        FROM users u
        LEFT JOIN users inst ON u.enrolled_by_user_id = inst.user_id
        LEFT JOIN group_members gm ON u.id = gm.student_id
        LEFT JOIN capstone_groups cg ON gm.group_id = cg.id
        WHERE u.user_id = ?
        AND u.role = 'student'
        LIMIT 1
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

        const student = result[0];
        student.has_group = !!student.existing_group_db_id;

        res.json({
            success: true,
            student: student
        });
    });
});

/* ================= CHECK GROUP NAME UNIQUENESS ================= */

app.get("/check-group-name", (req, res) => {
    const rawName = String(req.query.name || "").trim();
    const excludeGroupId = String(req.query.excludeGroupId || "").trim();

    if (!rawName) {
        return res.json({
            success: true,
            available: false,
            message: "Please enter a group name."
        });
    }

    let sql = `
        SELECT id, group_id, group_name
        FROM capstone_groups
        WHERE LOWER(TRIM(group_name)) = LOWER(TRIM(?))
    `;
    const params = [rawName];

    if (excludeGroupId) {
        sql += ` AND group_id != ? AND id != ?`;
        params.push(excludeGroupId, excludeGroupId);
    }

    sql += ` LIMIT 1`;

    db.query(sql, params, (err, rows) => {
        if (err) {
            console.log(err);
            return res.json({
                success: false,
                available: true,
                message: "Error checking group name."
            });
        }

        if (rows && rows.length > 0) {
            return res.json({
                success: true,
                available: false,
                existing_group_name: rows[0].group_name,
                existing_group_id: rows[0].group_id,
                message: `You cannot use "${rawName}" because another group already has this name. Please edit the group name.`
            });
        }

        return res.json({
            success: true,
            available: true,
            message: "Group name is available."
        });
    });
});

/* ================= CREATE GROUP ================= */

app.post("/create-group", async (req, res) => {
    const {
        groupName,
        projectTitle,
        groupProgram,
        projectManagerUserId,
        members
    } = req.body;

    if (!groupName || !String(groupName).trim()) {
        return res.json({
            success: false,
            message: "Please enter a group name."
        });
    }

    try {
        const dupRows = await new Promise((resolve, reject) => {
            db.query(
                `SELECT id, group_id, group_name FROM capstone_groups WHERE LOWER(TRIM(group_name)) = LOWER(TRIM(?)) LIMIT 1`,
                [String(groupName).trim()],
                (err, rows) => (err ? reject(err) : resolve(rows || []))
            );
        });
        if (dupRows.length > 0) {
            return res.json({
                success: false,
                duplicateName: true,
                message: `You cannot use "${String(groupName).trim()}" because another group already has this name. Please edit the group name.`
            });
        }
    } catch (dupErr) {
        console.log("Error checking duplicate group name:", dupErr);
    }

    if(members.length > 3){
        return res.json({
            success:false,
            message:"Only 4 members are allowed per group, including the Project Manager."
        });
    }

    // Check position uniqueness (1 PM, 1 System Analyst, 1 System Developer)
    const allPositions = ['Project Manager', ...members.map(m => m.memberPosition).filter(Boolean)];
    const posCounts = {};
    for (const pos of allPositions) {
        posCounts[pos] = (posCounts[pos] || 0) + 1;
        if (posCounts[pos] > 1) {
            return res.json({
                success: false,
                message: `Each position role in a group must be unique. You cannot assign the role "${pos}" more than once in the same group.`
            });
        }
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

        // Check if ANY student (PM or member) already belongs to a group
        const allMemberUserIds = [projectManagerUserId, ...members.map(m => m.studentUserId).filter(Boolean)];

        const checkExistingGroupSql = `
            SELECT gm.student_id, u.user_id, u.fullname, cg.group_name, cg.group_id
            FROM group_members gm
            JOIN users u ON gm.student_id = u.id
            JOIN capstone_groups cg ON gm.group_id = cg.id
            WHERE u.user_id IN (?)
        `;

        db.query(checkExistingGroupSql, [allMemberUserIds], (err, existingGroups) => {
            if (err) {
                console.log(err);
                return res.json({ success: false });
            }

            if (existingGroups.length > 0) {
                const existingList = existingGroups
                    .map(m => `${m.fullname} (${m.user_id}) already belongs to group "${m.group_name || m.group_id}"`)
                    .join("; ");
                return res.json({
                    success: false,
                    message: `Cannot create group: ${existingList}. A student can only belong to ONE group.`
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
            DATE_FORMAT(ds.defense_date, '%Y-%m-%d') AS defense_date,
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
            DATE_FORMAT(ds.defense_date, '%Y-%m-%d') AS defense_date,
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

app.put("/update-group", async (req, res) => {
    const {
        groupId,
        groupName,
        projectTitle,
        groupProgram,
        projectManagerUserId,
        members
    } = req.body;

    if (!groupName || !String(groupName).trim()) {
        return res.json({
            success: false,
            message: "Please enter a group name."
        });
    }

    try {
        const dupRows = await new Promise((resolve, reject) => {
            db.query(
                `SELECT id, group_id, group_name FROM capstone_groups WHERE LOWER(TRIM(group_name)) = LOWER(TRIM(?)) AND group_id != ? AND id != ? LIMIT 1`,
                [String(groupName).trim(), String(groupId || ""), String(groupId || "")],
                (err, rows) => (err ? reject(err) : resolve(rows || []))
            );
        });
        if (dupRows.length > 0) {
            return res.json({
                success: false,
                duplicateName: true,
                message: `You cannot use "${String(groupName).trim()}" because another group already has this name. Please edit the group name.`
            });
        }
    } catch (dupErr) {
        console.log("Error checking duplicate group name:", dupErr);
    }

    if(members.length > 3){
        return res.json({
            success:false,
            message:"Only 4 members are allowed per group, including the Project Manager."
        });
    }

    // Check position uniqueness (1 PM, 1 System Analyst, 1 System Developer)
    const allPositions = ['Project Manager', ...members.map(m => m.memberPosition).filter(Boolean)];
    const posCounts = {};
    for (const pos of allPositions) {
        posCounts[pos] = (posCounts[pos] || 0) + 1;
        if (posCounts[pos] > 1) {
            return res.json({
                success: false,
                message: `Each position role in a group must be unique. You cannot assign the role "${pos}" more than once in the same group.`
            });
        }
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
    // Articles
    'the', 'a', 'an',
    // Coordinating conjunctions
    'and', 'or', 'but', 'nor', 'yet', 'so',
    // Prepositions (short, non-semantic)
    'in', 'on', 'at', 'to', 'for', 'with', 'of', 'by', 'as', 'into',
    'about', 'from', 'over', 'under', 'above', 'below', 'off', 'out',
    // Pronouns
    'it', 'its', 'this', 'that', 'these', 'those',
    'we', 'you', 'your', 'our', 'they', 'their', 'he', 'she', 'him', 'her', 'us',
    // Auxiliary / modal verbs
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'shall', 'can', 'might',
    'was', 'were',
    // Common short fillers
    'not', 'also', 'such', 'each', 'all', 'any', 'both', 'few',
    'more', 'other', 'same', 'than', 'too', 'very', 'just',
    'while', 'where', 'when', 'which', 'who', 'how', 'what',
    'already', 'still', 'even', 'only', 'then', 'thus', 'hence',
    // Ordinals & numbers (never domain-significant in titles)
    'one', 'two', 'three', 'four', 'five',
    'first', 'second', 'third', 'last', 'next',
    // Filler verbs with zero domain meaning
    'get', 'gets', 'got', 'put', 'set', 'run', 'runs', 'keep', 'kept',
    'come', 'comes', 'came', 'go', 'goes', 'went', 'give', 'gives', 'given',
    'show', 'shows', 'shown', 'find', 'finds', 'need', 'needs', 'want', 'wants',
    'make', 'makes', 'made', 'take', 'takes', 'taken',
    // Short common words with no domain meaning
    'are', 'per', 'main', 'real', 'own', 'low', 'new', 'old', 'big', 'key',
    'via', 'vs', 'etc', 'ie', 'eg', 'e.g', 'i.e',
    'based', 'using', 'used', 'use', 'uses', 'given', 'like', 'see', 'let',
    'among', 'within', 'across', 'along', 'during', 'before', 'after', 'between',
    'through', 'including', 'included', 'include', 'includes',
    'part', 'parts', 'area', 'areas', 'level', 'levels', 'type', 'types', 'kind', 'kinds',
    'way', 'ways', 'case', 'cases', 'point', 'points', 'term', 'terms',
    'sign', 'signed', 'view', 'views', 'post', 'posts', 'adopt', 'adopted',
    'lead', 'lack', 'adopt', 'final', 'ched', 'scattered', 'delayed', 'integrity',
    'logic', 'backend',
]);

/* ---- Generic Capstone Boilerplate Words to Strip from Topic Matching ---- */
const GENERIC_CAPSTONE_WORDS = new Set([
    'management', 'system', 'systems',
    'web', 'based', 'web-based',
    'application', 'applications', 'app', 'apps',
    'platform', 'platforms',
    'portal', 'portals',
    'analytics',
    'tracking', 'tracker',
    'monitoring', 'monitor',
    'automated', 'automatic',
    'project', 'projects',
    'study', 'studies',
    'software', 'tool', 'tools',
    'solution', 'solutions',
    'information',
    'team', 'teams',
    'data',
    'report', 'reports', 'reporting',
    'using', 'used', 'use', 'uses',
    'process', 'processes', 'processing',
    'result', 'results',
    'record', 'records', 'recording',
    'service', 'services'
]);

/** Strips generic suffix words so Hugging Face embeddings focus strictly on the core domain topic */
function cleanDomainTitle(text) {
    if (!text) return '';
    return String(text).toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !GENERIC_CAPSTONE_WORDS.has(w))
        .join(' ');
}

const SYNONYMS = {
    // ── Capstone / academic domain (CRITICAL — these must ALWAYS match) ──────
    'capstone': ['thesis', 'dissertation', 'research project', 'final project', 'senior project'],
    'thesis': ['capstone', 'dissertation', 'research', 'study', 'paper', 'project'],
    'dissertation': ['thesis', 'capstone', 'research', 'study'],
    'research': ['study', 'thesis', 'investigation', 'inquiry', 'analysis'],
    // ── Repository / archive / library ───────────────────────────────────────
    'repository': ['archive', 'database', 'library', 'collection', 'storage', 'catalog', 'registry'],
    'archive': ['repository', 'database', 'library', 'collection', 'storage'],
    'library': ['repository', 'archive', 'collection', 'catalog', 'database'],
    'database': ['repository', 'archive', 'storage', 'records'],
    // ── Collaborative / team ─────────────────────────────────────────────────
    'collaborative': ['shared', 'teamwork', 'cooperative', 'joint', 'group', 'collective'],
    'adviser': ['advisor', 'mentor', 'supervisor', 'faculty', 'instructor', 'professor'],
    'advisor': ['adviser', 'mentor', 'supervisor', 'faculty', 'instructor'],
    'faculty': ['adviser', 'advisor', 'instructor', 'professor', 'teacher'],
    // ── Workload / balancer ───────────────────────────────────────────────────
    'workload': ['load', 'tasks', 'assignments', 'capacity', 'work', 'duties'],
    'balancer': ['scheduler', 'distribution', 'allocator'],
    'scheduler': ['calendar', 'planner', 'timetable', 'booking', 'schedule'],
    'schedule': ['timetable', 'calendar', 'appointment', 'booking', 'plan', 'scheduler'],
    // ── Attendance / QR ──────────────────────────────────────────────────────
    'attendance': ['presence', 'roll call', 'tardy', 'absent', 'log', 'dtr', 'time-in', 'time-out'],
    'qr': ['qr code', 'quick response', 'barcode', 'scan'],
    'code': ['qr', 'barcode', 'scan'],
    // ── Student / academic context ───────────────────────────────────────────
    'class': ['student', 'classroom', 'course', 'school', 'academic'],
    'student': ['class', 'learner', 'pupil', 'academic', 'undergraduate', 'trainee', 'intern'],
    'undergraduate': ['student', 'bsit', 'bsis', 'learner', 'pupil'],
    // ── Notification / alert ─────────────────────────────────────────────────
    'sms': ['text message', 'notification', 'alert', 'message'],
    'alert': ['notification', 'sms', 'warning', 'alarm'],
    'notification': ['alert', 'sms', 'warning', 'message'],
    // ── OJT / internship / practicum ──────────────────────────────────────────
    'ojt': ['internship', 'practicum', 'on-the-job training', 'training', 'intern', 'deployment', 'placement', 'trainee'],
    'internship': ['ojt', 'practicum', 'on-the-job training', 'training', 'intern', 'deployment', 'placement', 'trainee'],
    'practicum': ['ojt', 'internship', 'training', 'deployment', 'placement', 'trainee', 'fieldwork'],
    'training': ['ojt', 'internship', 'practicum', 'placement', 'skill development', 'trainee'],
    'intern': ['ojt', 'trainee', 'practicum', 'internship', 'apprentice'],
    'placement': ['internship', 'ojt', 'practicum', 'deployment', 'matching'],
    'trainee': ['intern', 'ojt', 'practicum', 'student', 'apprentice'],
    'evaluation': ['assessment', 'appraisal', 'performance', 'grading', 'rating', 'feedback', 'review'],
    'assessment': ['evaluation', 'appraisal', 'performance', 'review', 'rating'],
    // ── Food & beverage ──────────────────────────────────────────────────────
    'coffee': ['cafe', 'cafeteria', 'beverage', 'brew', 'espresso', 'coffeeshop', 'coffee shop'],
    'cafe': ['coffee', 'coffeeshop', 'coffee shop', 'bistro', 'restaurant', 'eatery'],
    'coffeeshop': ['cafe', 'coffee shop', 'coffee', 'bistro'],
    'restaurant': ['eatery', 'diner', 'cafe', 'bistro', 'food service', 'foodservice'],
    'food': ['meal', 'cuisine', 'menu', 'dining', 'recipe', 'dish'],
    'menu': ['food', 'cuisine', 'dish', 'ordering', 'catalogue', 'catalog', 'directory', 'listing'],
    'ordering': ['menu', 'order management', 'purchase order', 'booking', 'procurement'],
    'catalogue': ['menu', 'directory', 'catalog', 'listing', 'registry', 'index', 'inventory'],
    'catalog': ['menu', 'directory', 'catalogue', 'listing', 'registry', 'index'],
    'directory': ['catalogue', 'catalog', 'menu', 'listing', 'registry', 'index'],
    'beverage': ['drink', 'coffee', 'cafe', 'food', 'refreshment'],
    // ── Business & commerce ──────────────────────────────────────────────────
    'inventory': ['stock', 'stockroom', 'warehouse', 'supply', 'goods', 'asset'],
    'stock': ['inventory', 'supply', 'goods', 'warehouse'],
    'sales': ['revenue', 'transaction', 'purchase', 'order', 'selling'],
    'order': ['purchase', 'transaction', 'booking', 'request', 'sales'],
    'payment': ['transaction', 'billing', 'invoice', 'fee', 'purchase'],
    'transaction': ['payment', 'purchase', 'sales', 'order', 'billing'],
    // ── Healthcare ───────────────────────────────────────────────────────────
    'patient': ['client', 'visitor', 'person', 'individual', 'case'],
    'appointment': ['schedule', 'booking', 'reservation', 'consultation', 'visit'],
    'health': ['medical', 'healthcare', 'clinic', 'wellness', 'hospital'],
    'hospital': ['clinic', 'health center', 'medical', 'healthcare'],
    'medical': ['health', 'clinical', 'hospital', 'wellness'],
    // ── Education ────────────────────────────────────────────────────────────
    'grade': ['score', 'mark', 'rating', 'performance', 'evaluation'],
    'enrollment': ['registration', 'admission', 'enrolment', 'sign-up'],
    // ── Logistics ────────────────────────────────────────────────────────────
    'location': ['address', 'place', 'site', 'position', 'venue', 'map'],
    'delivery': ['shipment', 'dispatch', 'courier', 'logistics', 'transport'],
    'map': ['location', 'navigation', 'geo', 'route'],
    // ── IT-specific ──────────────────────────────────────────────────────────
    'mobile': ['android', 'ios', 'phone', 'smartphone', 'handheld'],
    'chatbot': ['bot', 'virtual assistant', 'assistant', 'automated chat'],
    'recommendation': ['suggestion', 'advice', 'guidance', 'referral'],
    'sensor': ['detector', 'device', 'monitor', 'iot', 'hardware'],
    'iot': ['sensor', 'device', 'hardware'],
    'facial': ['face', 'biometric', 'recognition', 'identification'],
    'recognition': ['identification', 'detection', 'facial', 'biometric'],
    'fingerprint': ['biometric', 'identification', 'scan', 'authentication'],
    'authentication': ['login', 'verification', 'security', 'fingerprint', 'biometric'],
};

function tokenizeText(text) {
    if (!text) return [];
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    return clean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w) && !GENERIC_CAPSTONE_WORDS.has(w));
}

function calculateMatchScore(studentText, repoText, matchType) {
    if (!studentText || !repoText) {
        return { score: 0, matchedWords: [], matchedSynonymWords: [], matchedRepoSynonymWords: [], conceptWords: [], repoConceptWords: [] };
    }
    const studentTokens = tokenizeText(studentText);
    const repoTokens = tokenizeText(repoText);
    if (studentTokens.length === 0) {
        return { score: 0, matchedWords: [], matchedSynonymWords: [], matchedRepoSynonymWords: [], conceptWords: [], repoConceptWords: [] };
    }

    let matches = 0;
    const matchedWords = [];           // student tokens that directly appear in repo
    const matchedSynonymWords = [];    // student tokens whose synonym appears in repo (LEFT panel purple)
    const matchedRepoSynonymWords = [];// actual repo-side words that matched via synonym (RIGHT panel purple)
    const conceptWords = [];           // domain concept words (LEFT panel orange)
    const repoConceptWords = [];       // domain concept words (RIGHT panel orange)
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
            let foundSyn = false;
            for (let rel of related) {
                if (repoTokens.includes(rel) || normRepo.includes(rel)) {
                    matches += 0.85;
                    matchedSynonymWords.push(st);       // student-side: "ojt" → purple on left
                    matchedRepoSynonymWords.push(rel);  // repo-side: "internship" → purple on right
                    foundSyn = true;
                    break;
                }
            }
            if (!foundSyn && related.length > 0) {
                conceptWords.push(st);
            }
        }
    });

    return {
        score: Math.min(matches / studentTokens.length, 1.0),
        matchedWords: [...new Set(matchedWords)],
        matchedSynonymWords: [...new Set(matchedSynonymWords)],
        matchedRepoSynonymWords: [...new Set(matchedRepoSynonymWords)],
        conceptWords: [...new Set(conceptWords)],
        repoConceptWords: [...new Set(matchedRepoSynonymWords.concat(matchedWords))]
    };
}

async function runSimilarityCheck(proposedTitle, proposedPdfText, repositoryRecords) {
    if (!semEngine.isModelReady()) {
        console.log('[HF-CHECK] Model not ready yet; awaiting @huggingface/transformers loadModel()...');
        await semEngine.loadModel();
    }

    const poolType = (repositoryRecords[0] && repositoryRecords[0].sourceType === 'approved_proposal')
        ? 'Approved Ongoing Studies'
        : 'Archived Studies';
    console.log(`[HF-CHECK] Using @huggingface/transformers model: Xenova/all-MiniLM-L6-v2 (Checking "${proposedTitle}" against ${repositoryRecords.length} ${poolType})`);

    let highestPercentage = 0;
    let bestMatch = null;
    let bestMatchDetails = null;

    const cleanPropTitle = cleanDomainTitle(proposedTitle);
    const hasPdfText = Boolean(proposedPdfText && proposedPdfText.trim().length > 0);

    for (const repo of repositoryRecords) {
        const isOngoingRecord = repo.sourceType === 'approved_proposal';
        const bodyText = repo.bodyText || repo.abstract || '';
        const cleanRepoTitle = cleanDomainTitle(repo.title);

        let semTitleScore = 0;
        let semBodyScore = 0;
        let semanticScore = 0;

        if (isOngoingRecord) {
            /* ══════════════════════════════════════════════════════════════════
             * ONGOING APPROVED STUDY COMPARISON (HF SEMANTIC DOMAIN PIPELINE)
             * ══════════════════════════════════════════════════════════════════ */
            const titleMatch = calculateMatchScore(proposedTitle, repo.title, 'title');
            const bodyMatch  = calculateMatchScore(proposedPdfText, bodyText, 'body');

            if (semEngine.isModelReady()) {
                try {
                    const [sTitle, sBody] = await Promise.all([
                        semEngine.computeSemanticSimilarity(cleanPropTitle || proposedTitle, cleanRepoTitle || repo.title),
                        (hasPdfText && bodyText) ? semEngine.computeSemanticSimilarity(proposedPdfText.slice(0, 2000), bodyText.slice(0, 2000)) : Promise.resolve(0)
                    ]);
                    semTitleScore = sTitle || 0;
                    semBodyScore  = sBody  || 0;
                    semanticScore = (hasPdfText && bodyText)
                        ? (semTitleScore * 0.35 + semBodyScore * 0.65)
                        : semTitleScore;
                } catch (err) {
                    console.error('[Similarity] semantic error for ongoing record', repo.id, err.message);
                }
            }

            // Semantic cosine similarity drives the ranking, complemented by keyword/synonym match
            const blendedTitleScore = semTitleScore > 0 ? (semTitleScore * 0.70 + titleMatch.score * 0.30) : titleMatch.score;
            const blendedBodyScore  = semBodyScore > 0  ? (semBodyScore  * 0.70 + bodyMatch.score  * 0.30) : bodyMatch.score;
            const blendedScore = (hasPdfText && bodyText)
                ? (blendedTitleScore * 0.35 + blendedBodyScore * 0.65)
                : blendedTitleScore;

            const percentage = Math.round(blendedScore * 100);

            if (percentage >= highestPercentage) {
                highestPercentage = percentage;
                bestMatch = repo;
                bestMatchDetails = {
                    matchedTitleWords:          titleMatch.matchedWords,
                    matchedObjAbstractWords:    bodyMatch.matchedWords,
                    matchedObjObjectivesWords:  [],
                    matchedResearchProbWords:   [],
                    matchedMethodologyWords:    [],
                    synonymTitleWords:          titleMatch.matchedSynonymWords,
                    synonymAbstractWords:       bodyMatch.matchedSynonymWords,
                    synonymObjectivesWords:     [],
                    synonymResearchProbWords:   [],
                    synonymMethodologyWords:    [],
                    conceptTitleWords:          titleMatch.conceptWords || [],
                    conceptWords:               bodyMatch.conceptWords || [],
                    repoSynonymTitleWords:         titleMatch.matchedRepoSynonymWords,
                    repoSynonymAbstractWords:      bodyMatch.matchedRepoSynonymWords,
                    repoSynonymObjectivesWords:    [],
                    repoSynonymResearchProbWords:  [],
                    repoSynonymMethodologyWords:   [],
                    repoConceptWords:              bodyMatch.repoConceptWords || [],
                    sectionScores: {
                        title:          Math.round(blendedTitleScore * 100),
                        abstract:       Math.round(blendedBodyScore  * 100),
                        objectives:     Math.round(blendedBodyScore  * 100),
                        researchProblem:0,
                        methodology:    0,
                        body:           Math.round(blendedBodyScore  * 100)
                    },
                    semanticScore: semEngine.isModelReady() ? Math.round(semanticScore * 100) : null
                };
            }
        } else {
            /* ══════════════════════════════════════════════════════════════════
             * ARCHIVED REPOSITORY STUDY COMPARISON (HF SEMANTIC DOMAIN PIPELINE)
             * ══════════════════════════════════════════════════════════════════ */
            const titleMatch          = calculateMatchScore(proposedTitle,   repo.title,             'title');
            const abstractMatch       = calculateMatchScore(proposedPdfText, repo.abstract,          'abstract');
            const objectivesMatch     = calculateMatchScore(proposedPdfText, repo.objectives,        'objectives');
            const researchProbMatch   = calculateMatchScore(proposedPdfText, repo.research_problem || '', 'research_problem');
            const methodologyMatch    = calculateMatchScore(proposedPdfText, repo.methodology || '',      'methodology');

            let semAbstractScore = 0, semObjectivesScore = 0, semResearchProbScore = 0, semMethodologyScore = 0;

            if (semEngine.isModelReady()) {
                try {
                    [semTitleScore, semAbstractScore, semObjectivesScore,
                     semResearchProbScore, semMethodologyScore] = await Promise.all([
                        semEngine.computeSemanticSimilarity(cleanPropTitle || proposedTitle, cleanRepoTitle || repo.title),
                        semEngine.computeSemanticSimilarity(proposedPdfText.slice(0, 2000),  (repo.abstract || '').slice(0, 2000)),
                        semEngine.computeSemanticSimilarity(proposedPdfText.slice(0, 2000),  (repo.objectives || '').slice(0, 2000)),
                        semEngine.computeSemanticSimilarity(proposedPdfText.slice(0, 2000),  (repo.research_problem || '').slice(0, 2000)),
                        semEngine.computeSemanticSimilarity(proposedPdfText.slice(0, 2000),  (repo.methodology || '').slice(0, 2000))
                    ]);

                    semBodyScore =
                        semAbstractScore     * 0.40 +
                        semObjectivesScore   * 0.40 +
                        semResearchProbScore * 0.10 +
                        semMethodologyScore  * 0.10;

                    semanticScore = (hasPdfText)
                        ? (semTitleScore * 0.35 + semBodyScore * 0.65)
                        : semTitleScore;
                } catch (err) {
                    console.error('[Similarity] semantic error for record', repo.id, err.message);
                }
            }

            const blendedTitleScore    = semTitleScore > 0 ? (semTitleScore * 0.70 + titleMatch.score * 0.30) : titleMatch.score;
            const blendedAbstractScore = semAbstractScore > 0 ? (semAbstractScore * 0.70 + abstractMatch.score * 0.30) : abstractMatch.score;
            const blendedObjScore      = semObjectivesScore > 0 ? (semObjectivesScore * 0.70 + objectivesMatch.score * 0.30) : objectivesMatch.score;
            const blendedProbScore     = semResearchProbScore > 0 ? (semResearchProbScore * 0.70 + researchProbMatch.score * 0.30) : researchProbMatch.score;
            const blendedMethScore     = semMethodologyScore > 0 ? (semMethodologyScore * 0.70 + methodologyMatch.score * 0.30) : methodologyMatch.score;

            const blendedBodyScore =
                blendedAbstractScore * 0.40 +
                blendedObjScore      * 0.40 +
                blendedProbScore     * 0.10 +
                blendedMethScore     * 0.10;

            const blendedScore = (hasPdfText)
                ? (blendedTitleScore * 0.35 + blendedBodyScore * 0.65)
                : blendedTitleScore;

            const percentage = Math.round(blendedScore * 100);

            if (percentage >= highestPercentage) {
                highestPercentage = percentage;
                bestMatch = repo;
                bestMatchDetails = {
                    matchedTitleWords:          titleMatch.matchedWords,
                    matchedObjAbstractWords:    abstractMatch.matchedWords,
                    matchedObjObjectivesWords:  objectivesMatch.matchedWords,
                    matchedResearchProbWords:   researchProbMatch.matchedWords,
                    matchedMethodologyWords:    methodologyMatch.matchedWords,
                    synonymTitleWords:          titleMatch.matchedSynonymWords,
                    synonymAbstractWords:       abstractMatch.matchedSynonymWords,
                    synonymObjectivesWords:     objectivesMatch.matchedSynonymWords,
                    synonymResearchProbWords:   researchProbMatch.matchedSynonymWords,
                    synonymMethodologyWords:    methodologyMatch.matchedSynonymWords,
                    conceptTitleWords:          titleMatch.conceptWords || [],
                    conceptWords:               (abstractMatch.conceptWords || []).concat(objectivesMatch.conceptWords || []),
                    repoSynonymTitleWords:         titleMatch.matchedRepoSynonymWords,
                    repoSynonymAbstractWords:      abstractMatch.matchedRepoSynonymWords,
                    repoSynonymObjectivesWords:    objectivesMatch.matchedRepoSynonymWords,
                    repoSynonymResearchProbWords:  researchProbMatch.matchedRepoSynonymWords,
                    repoSynonymMethodologyWords:   methodologyMatch.matchedRepoSynonymWords,
                    repoConceptWords:              (abstractMatch.repoConceptWords || []).concat(objectivesMatch.repoConceptWords || []),
                    sectionScores: {
                        title:          Math.round(blendedTitleScore    * 100),
                        abstract:       Math.round(blendedAbstractScore * 100),
                        objectives:     Math.round(blendedObjScore      * 100),
                        researchProblem:Math.round(blendedProbScore     * 100),
                        methodology:    Math.round(blendedMethScore     * 100)
                    },
                    semanticScore: semEngine.isModelReady() ? Math.round(semanticScore * 100) : null
                };
            }
        }
    }

    let similarityLevel = "Low Similarity";
    if (highestPercentage > 25 && highestPercentage <= 50) {
        similarityLevel = "Moderate Similarity";
    } else if (highestPercentage > 50 && highestPercentage <= 75) {
        similarityLevel = "High Similarity";
    } else if (highestPercentage > 75) {
        similarityLevel = "Very High Similarity";
    }

    console.log(`[HF-CHECK] Top Semantic Match for ${poolType}: "${bestMatch ? bestMatch.title : 'None'}" (${highestPercentage}% - ${similarityLevel})`);

    return {
        percentage: highestPercentage,
        level: similarityLevel,
        matchedRecord: bestMatch,
        matchingSections: bestMatchDetails
    };
}

async function runDualSimilarityCheck(proposedTitle, proposedPdfText, archivedRecords, ongoingRecords) {
    const [archivedResult, ongoingResult] = await Promise.all([
        runSimilarityCheck(proposedTitle, proposedPdfText, archivedRecords),
        runSimilarityCheck(proposedTitle, proposedPdfText, ongoingRecords)
    ]);

    // Pick highest overall match as primary
    const primaryResult = (ongoingResult.percentage > archivedResult.percentage) ? ongoingResult : archivedResult;

    return {
        primary: primaryResult,
        archivedMatch: archivedResult,
        ongoingMatch: ongoingResult
    };
}

function getComparisonRecords(currentGroupId, callback) {
    const repoSql = `SELECT id, title, abstract, objectives, research_problem, methodology FROM repository`;
    db.query(repoSql, (err1, repoRows) => {
        if (err1) {
            console.error("Error fetching repository records for similarity:", err1);
            repoRows = [];
        }

        const archivedRecords = (repoRows || []).map(r => ({
            sourceType: 'repository',
            id: r.id,
            title: r.title || '',
            abstract: r.abstract || '',
            objectives: r.objectives || '',
            research_problem: r.research_problem || '',
            methodology: r.methodology || '',
            group_name: null
        }));

        // Build per-group lifecycle state for ongoing study filtering:
        // 1. If group is Completed (stage/progress/status or graded Final Defense) -> exclude from ongoing studies.
        // 2. If Concept Presentation panel chose 1 title (approved_title_id) -> keep ONLY that chosen title.
        // 3. If no Concept Presentation grade/choice yet -> keep all 3 approved proposed titles.
        const groupStateSql = `
            SELECT
                cg.id AS group_id,
                cg.stage,
                cg.progress,
                cg.status AS group_status,
                (
                    SELECT COALESCE(
                        ds.approved_title_id,
                        (
                            SELECT dpe.approved_title_id
                            FROM defense_panel_evaluations dpe
                            WHERE dpe.schedule_id = ds.id
                              AND dpe.approved_title_id IS NOT NULL
                            GROUP BY dpe.approved_title_id
                            ORDER BY COUNT(*) DESC
                            LIMIT 1
                        )
                    )
                    FROM defense_schedules ds
                    WHERE ds.group_id = cg.id
                      AND LOWER(COALESCE(ds.defense_type, '')) LIKE '%concept%'
                      AND (
                          ds.approved_title_id IS NOT NULL
                          OR EXISTS (
                              SELECT 1 FROM defense_panel_evaluations dpe2
                              WHERE dpe2.schedule_id = ds.id AND dpe2.approved_title_id IS NOT NULL
                          )
                      )
                    ORDER BY ds.id DESC
                    LIMIT 1
                ) AS chosen_title_id,
                EXISTS (
                    SELECT 1
                    FROM defense_schedules fd
                    WHERE fd.group_id = cg.id
                      AND LOWER(COALESCE(fd.defense_type, '')) LIKE '%final defense%'
                      AND LOWER(COALESCE(fd.defense_type, '')) NOT LIKE '%pre-final%'
                      AND (
                          fd.score IS NOT NULL
                          OR LOWER(COALESCE(fd.defense_status, '')) = 'completed'
                          OR EXISTS (
                              SELECT 1 FROM defense_panel_evaluations fde
                              WHERE fde.schedule_id = fd.id AND fde.score IS NOT NULL
                          )
                      )
                ) AS has_final_defense_grade
            FROM capstone_groups cg
            WHERE cg.id != ?
        `;

        db.query(groupStateSql, [currentGroupId || 0], (stateErr, stateRows) => {
            if (stateErr) {
                console.error("Error fetching group lifecycle state for similarity:", stateErr);
                stateRows = [];
            }

            const groupStateMap = new Map();
            (stateRows || []).forEach(g => {
                const stageLower = String(g.stage || "").trim().toLowerCase();
                const statusLower = String(g.group_status || "").trim().toLowerCase();
                const isCompleted =
                    stageLower === "completed" ||
                    stageLower === "final" ||
                    stageLower === "stage 5" ||
                    statusLower === "completed" ||
                    Number(g.progress || 0) >= 100 ||
                    Number(g.has_final_defense_grade || 0) === 1;

                groupStateMap.set(Number(g.group_id), {
                    isCompleted,
                    chosenTitleId: g.chosen_title_id ? Number(g.chosen_title_id) : null
                });
            });

            const shouldIncludeForGroup = (groupId, tpId) => {
                const st = groupStateMap.get(Number(groupId));
                if (!st) return true;
                if (st.isCompleted) return false;
                if (st.chosenTitleId) {
                    return Number(tpId) === st.chosenTitleId;
                }
                return true;
            };

        // Fetch Approved Concept Papers from student_documents (Concept Presentation • Proposed concept paper 1-3)
        // These are the approved ongoing studies that must be checked against
        const conceptDocsSql = `
            SELECT 
                sd.id,
                sd.group_id,
                cg.group_name,
                sd.document_type,
                sd.document_title AS title,
                sd.file_name,
                sd.file_path,
                tp.id AS tp_id,
                tp.proposed_title,
                tp.proposed_objectives AS cached_text
            FROM student_documents sd
            JOIN capstone_groups cg ON sd.group_id = cg.id
            LEFT JOIN title_proposals tp ON (
                tp.group_id = sd.group_id
                AND (
                    (sd.document_type LIKE '%(1)%' AND tp.title_number = 1)
                    OR (sd.document_type LIKE '%(2)%' AND tp.title_number = 2)
                    OR (sd.document_type LIKE '%(3)%' AND tp.title_number = 3)
                    OR (tp.file_path IS NOT NULL AND tp.file_path = sd.file_path)
                )
            )
            WHERE sd.group_id != ?
              AND sd.document_status = 'Approved'
              AND (
                  sd.document_type LIKE '%Proposed concept paper%'
                  OR sd.document_type LIKE '%concept paper%'
              )
            ORDER BY sd.id DESC
        `;

        db.query(conceptDocsSql, [currentGroupId || 0], async (errDoc, docRows) => {
            if (errDoc) {
                console.error("Error fetching approved concept papers for similarity:", errDoc);
                docRows = [];
            }

            const ongoingRecords = [];
            const seenTitles = new Set();

            for (const doc of (docRows || [])) {
                if (!shouldIncludeForGroup(doc.group_id, doc.tp_id)) continue;
                const cleanTitle = (doc.proposed_title || doc.title || "").trim();
                if (!cleanTitle) continue;
                const dedupKey = (cleanTitle + '|' + (doc.group_name || '')).toLowerCase();
                if (seenTitles.has(dedupKey)) continue;
                seenTitles.add(dedupKey);

                let bodyText = (doc.cached_text && doc.cached_text.trim()) ? doc.cached_text.trim() : '';
                if (!bodyText && doc.file_path) {
                    const cleanPath = doc.file_path.replace(/^\//, '');
                    const fullPath = path.join(__dirname, cleanPath);
                    if (fs.existsSync(fullPath)) {
                        try {
                            bodyText = await extractTextFromPdf(fullPath);
                        } catch (pErr) {
                            console.error("Error extracting text from approved concept paper PDF:", pErr);
                        }
                    }
                }

                ongoingRecords.push({
                    sourceType: 'approved_proposal',
                    id: doc.id,
                    title: cleanTitle,
                    abstract: bodyText,
                    objectives: bodyText,
                    research_problem: '',
                    methodology: '',
                    bodyText: bodyText,
                    group_name: doc.group_name || "Approved Group",
                    file_path: doc.file_path || ''
                });
            }

            // Also check for any approved title_proposals from other groups
            const propSql = `
                SELECT 
                    tp.id,
                    tp.proposed_title AS title,
                    tp.proposed_objectives AS cached_text,
                    tp.group_id,
                    cg.group_name
                FROM title_proposals tp
                JOIN capstone_groups cg ON tp.group_id = cg.id
                WHERE tp.group_id != ?
                  AND tp.status = 'Approved'
                  AND tp.proposed_title IS NOT NULL
                  AND TRIM(tp.proposed_title) != ''
            `;

            db.query(propSql, [currentGroupId || 0], (err3, propRows) => {
                if (err3) {
                    console.error("Error fetching title_proposals for similarity:", err3);
                    propRows = [];
                }

                (propRows || []).forEach(p => {
                    if (!shouldIncludeForGroup(p.group_id, p.id)) return;
                    const cleanTitle = (p.title || "").trim();
                    if (!cleanTitle) return;
                    const dedupKey = (cleanTitle + '|' + (p.group_name || '')).toLowerCase();
                    if (seenTitles.has(dedupKey)) return;
                    seenTitles.add(dedupKey);

                    const bodyText = (p.cached_text && p.cached_text.trim()) ? p.cached_text.trim() : cleanTitle;
                    ongoingRecords.push({
                        sourceType: 'approved_proposal',
                        id: p.id,
                        title: cleanTitle,
                        abstract: bodyText,
                        objectives: bodyText,
                        research_problem: '',
                        methodology: '',
                        bodyText: bodyText,
                        group_name: p.group_name || "Approved Group"
                    });
                });

                callback({
                    archivedRecords,
                    ongoingRecords,
                    allRecords: [...archivedRecords, ...ongoingRecords]
                });
            });
        });
        });
    });
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
         * PHASE 1b — Strip inline team/author metadata labels
         * Removes "Project Manager: Juan Dela Cruz" style labels that
         * sometimes run inline rather than on their own line.
         * ══════════════════════════════════════════════════════════════════ */
        const ROLE_SCRUB = [
            /project\s+manager\s*:\s*[^\n]*/gi,
            /project\s+analyst\s*:\s*[^\n]*/gi,
            /(?:team\s+)?members?\s*:\s*[^\n]*/gi,
            /(?:lead|leader|programmer|developer|designer|analyst|documentarian|tester)\s*:\s*[^\n]*/gi,
            /submitted\s+(?:by|to)\s*:\s*[^\n]*/gi,
            /prepared\s+by\s*:\s*[^\n]*/gi,
            /presented\s+(?:by|to)\s*:\s*[^\n]*/gi,
            /(?:instructor|professor|adviser|advisor|faculty|course|subject)\s*:\s*[^\n]*/gi,
        ];
        for (const re of ROLE_SCRUB) {
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
            // Strip team/author metadata lines from proposals
            /^project\s+manager\s*:/i,
            /^project\s+analyst\s*:/i,
            /^(members?|team\s+members?)\s*:/i,
            /^(lead|leader|programmer|developer|designer|analyst|documentarian|tester)\s*:/i,
            /^(submitted\s+by|prepared\s+by|presented\s+by|submitted\s+to|presented\s+to)\s*:/i,
            /^(course|subject|instructor|professor|adviser|advisor|faculty)\s*:/i,
            /^(date\s+submitted|submission\s+date|school\s+year|academic\s+year)\s*:/i,
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

/* ================= ONGOING STUDY BODY LIVE FETCH ================= */
/* Returns the latest extracted text (PDF body text) for a matched ongoing group.
   Called by the frontend compare modal when displaying an ongoing study. */
app.get("/ongoing-study-body", (req, res) => {
    const { groupName, title } = req.query;
    if (!groupName && !title) {
        return res.json({ success: false, body: null });
    }

    // 1. Try to find real PDF text from title_proposals first
    const sql = `
        SELECT
            tp.proposed_objectives,
            tp.proposed_title,
            cg.group_name
        FROM title_proposals tp
        JOIN capstone_groups cg ON tp.group_id = cg.id
        WHERE
            tp.proposed_objectives IS NOT NULL
            AND TRIM(tp.proposed_objectives) != ''
            AND (
                (? IS NOT NULL AND cg.group_name = ?)
                OR (? IS NOT NULL AND LOWER(TRIM(tp.proposed_title)) = LOWER(TRIM(?)))
            )
        ORDER BY LENGTH(tp.proposed_objectives) DESC
        LIMIT 1
    `;

    db.query(sql, [groupName || null, groupName || null, title || null, title || null], (err, rows) => {
        if (!err && rows && rows.length > 0 && rows[0].proposed_objectives && rows[0].proposed_objectives.trim()) {
            return res.json({ success: true, body: rows[0].proposed_objectives.trim() });
        }

        // 2. Fallback to student_documents approved concept papers
        const docSql = `
            SELECT 
                sd.file_path,
                sd.document_title,
                cg.group_name
            FROM student_documents sd
            JOIN capstone_groups cg ON sd.group_id = cg.id
            WHERE (
                (? IS NOT NULL AND cg.group_name = ?)
                OR (? IS NOT NULL AND LOWER(TRIM(sd.document_title)) = LOWER(TRIM(?)))
            )
            AND (sd.document_type LIKE '%Proposed concept paper%' OR sd.document_type LIKE '%concept paper%')
            AND sd.document_status = 'Approved'
            ORDER BY sd.id DESC
            LIMIT 1
        `;

        db.query(docSql, [groupName || null, groupName || null, title || null, title || null], async (errDoc, docRows) => {
            if (!errDoc && docRows && docRows.length > 0 && docRows[0].file_path) {
                const cleanPath = docRows[0].file_path.replace(/^\//, '');
                const fullPath = path.join(__dirname, cleanPath);
                if (fs.existsSync(fullPath)) {
                    try {
                        const extracted = await extractTextFromPdf(fullPath);
                        if (extracted && extracted.trim()) {
                            return res.json({ success: true, body: extracted.trim() });
                        }
                    } catch (e) {
                        console.error("Error reading PDF in ongoing-study-body:", e);
                    }
                }
            }

            return res.json({ success: false, body: null });
        });
    });
});

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
                tsr.matched_source_type,
                tsr.matched_approved_title,
                tsr.matched_group_name,
                tsr.matched_repository_id,
                tsr.archived_match_details,
                tsr.ongoing_match_details,
                COALESCE(r.title, tsr.matched_approved_title) AS matched_title,
                COALESCE(r.abstract, tsr.matched_approved_title) AS matched_abstract,
                COALESCE(r.objectives, tsr.matched_approved_title) AS matched_objectives,
                r.research_problem AS matched_research_problem,
                r.methodology AS matched_methodology
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

                    // Fetch repository records & approved group titles for comparison
                    getComparisonRecords(groupDbId, async (compRecords) => {
                        const dualResult = await runDualSimilarityCheck(
                            proposedTitle.trim(),
                            proposedObjectives ? proposedObjectives.trim() : "",
                            compRecords.archivedRecords,
                            compRecords.ongoingRecords
                        );

                        const primaryResult = dualResult.primary;
                        const archivedMatch = dualResult.archivedMatch;
                        const ongoingMatch = dualResult.ongoingMatch;

                        if (primaryResult && primaryResult.percentage >= 90) {
                            const matchedRec = primaryResult.matchedRecord;
                            const matchedTitleStr = matchedRec.sourceType === 'approved_proposal'
                                ? `${matchedRec.title} (Approved Title from ${matchedRec.group_name})`
                                : matchedRec.title;

                            return res.json({
                                success: false,
                                isSimilarityRejection: true,
                                similarityPercentage: primaryResult.percentage,
                                matchedTitle: matchedRec ? matchedRec.title : '',
                                matchedGroupName: matchedRec ? matchedRec.group_name : null,
                                matchedSourceType: matchedRec ? matchedRec.sourceType : 'repository',
                                message: `Automatically Rejected: This title proposal has a similarity score of ${primaryResult.percentage}% (matches "${matchedTitleStr}"), which exceeds the maximum allowable threshold of 90%. You are required to submit another concept.`
                            });
                        }

                        if (primaryResult) {
                            const insertSimSql = `
                                INSERT INTO title_similarity_results
                                (
                                    student_id,
                                    proposed_title_id,
                                    matched_repository_id,
                                    matched_source_type,
                                    matched_approved_title,
                                    matched_group_name,
                                    similarity_percentage,
                                    similarity_level,
                                    matching_sections,
                                    archived_match_details,
                                    ongoing_match_details
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE
                                    matched_repository_id = VALUES(matched_repository_id),
                                    matched_source_type = VALUES(matched_source_type),
                                    matched_approved_title = VALUES(matched_approved_title),
                                    matched_group_name = VALUES(matched_group_name),
                                    similarity_percentage = VALUES(similarity_percentage),
                                    similarity_level = VALUES(similarity_level),
                                    matching_sections = VALUES(matching_sections),
                                    archived_match_details = VALUES(archived_match_details),
                                    ongoing_match_details = VALUES(ongoing_match_details),
                                    updated_at = CURRENT_TIMESTAMP
                            `;
                            const matchedRec = primaryResult.matchedRecord;
                            db.query(
                                insertSimSql,
                                [
                                    studentUserId,
                                    proposedTitleId,
                                    matchedRec && matchedRec.sourceType === 'repository' ? matchedRec.id : null,
                                    matchedRec ? (matchedRec.sourceType || 'repository') : 'repository',
                                    matchedRec && matchedRec.sourceType === 'approved_proposal' ? matchedRec.title : null,
                                    matchedRec && matchedRec.sourceType === 'approved_proposal' ? matchedRec.group_name : null,
                                    primaryResult.percentage,
                                    primaryResult.level,
                                    JSON.stringify(primaryResult.matchingSections),
                                    JSON.stringify(archivedMatch),
                                    JSON.stringify(ongoingMatch)
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

            getComparisonRecords(groupDbId, async (compRecords) => {
                const dualResult = await runDualSimilarityCheck(
                    proposedTitle.trim(),
                    parsedObjectives.trim(),
                    compRecords.archivedRecords,
                    compRecords.ongoingRecords
                );

                const primaryResult = dualResult.primary;
                const archivedMatch = dualResult.archivedMatch;
                const ongoingMatch = dualResult.ongoingMatch;

                if (primaryResult && primaryResult.percentage >= 90) {
                    // Automatically reject and delete the uploaded file
                    try {
                        fs.unlinkSync(physicalPath);
                    } catch (unlinkErr) {
                        console.error("Error deleting rejected file:", unlinkErr);
                    }

                    const matchedRec = primaryResult.matchedRecord;
                    const matchedTitleStr = matchedRec && matchedRec.sourceType === 'approved_proposal'
                        ? `${matchedRec.title} (Approved Title from ${matchedRec.group_name})`
                        : (matchedRec ? matchedRec.title : '');

                    return res.json({
                        success: false,
                        isSimilarityRejection: true,
                        similarityPercentage: primaryResult.percentage,
                        matchedTitle: matchedRec ? matchedRec.title : '',
                        matchedGroupName: matchedRec ? matchedRec.group_name : null,
                        matchedSourceType: matchedRec ? matchedRec.sourceType : 'repository',
                        message: `Automatically Rejected: This title proposal has a similarity score of ${primaryResult.percentage}% (matches "${matchedTitleStr}"), which exceeds the maximum allowable threshold of 90%. You are required to submit another concept.`
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
                                if (primaryResult) {
                                    const insertSimSql = `
                                        INSERT INTO title_similarity_results
                                        (
                                            student_id,
                                            proposed_title_id,
                                            matched_repository_id,
                                            matched_source_type,
                                            matched_approved_title,
                                            matched_group_name,
                                            similarity_percentage,
                                            similarity_level,
                                            matching_sections,
                                            archived_match_details,
                                            ongoing_match_details
                                        )
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                        ON DUPLICATE KEY UPDATE
                                            matched_repository_id = VALUES(matched_repository_id),
                                            matched_source_type = VALUES(matched_source_type),
                                            matched_approved_title = VALUES(matched_approved_title),
                                            matched_group_name = VALUES(matched_group_name),
                                            similarity_percentage = VALUES(similarity_percentage),
                                            similarity_level = VALUES(similarity_level),
                                            matching_sections = VALUES(matching_sections),
                                            archived_match_details = VALUES(archived_match_details),
                                            ongoing_match_details = VALUES(ongoing_match_details),
                                            updated_at = CURRENT_TIMESTAMP
                                    `;
                                    const matchedRec = primaryResult.matchedRecord;
                                    db.query(insertSimSql, [
                                        studentUserId,
                                        proposedTitleId,
                                        matchedRec && matchedRec.sourceType === 'repository' ? matchedRec.id : null,
                                        matchedRec ? (matchedRec.sourceType || 'repository') : 'repository',
                                        matchedRec && matchedRec.sourceType === 'approved_proposal' ? matchedRec.title : null,
                                        matchedRec && matchedRec.sourceType === 'approved_proposal' ? matchedRec.group_name : null,
                                        primaryResult.percentage,
                                        primaryResult.level,
                                        JSON.stringify(primaryResult.matchingSections),
                                        JSON.stringify(archivedMatch),
                                        JSON.stringify(ongoingMatch)
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
                    tsr.matched_source_type,
                    tsr.matched_approved_title,
                    tsr.matched_group_name,
                    tsr.matched_repository_id,
                    tsr.archived_match_details,
                    tsr.ongoing_match_details,
                    COALESCE(r.title, tsr.matched_approved_title) AS matched_title,
                    COALESCE(r.abstract, tsr.matched_approved_title) AS matched_abstract,
                    COALESCE(r.objectives, tsr.matched_approved_title) AS matched_objectives,
                    r.research_problem AS matched_research_problem,
                    r.methodology AS matched_methodology
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
            adviser.id AS adviser_db_id,
            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name,
            instructor.id AS instructor_db_id,
            instructor.user_id AS instructor_user_id,
            instructor.fullname AS instructor_name
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
                    // Determine re-defense phases: latest verdict is Conditional Passed, For Formal Defense, or For Re-Defense
                    Object.entries(latestVerdictByType).forEach(([defType, resVal]) => {
                        if (resVal === "Conditional Passed" || resVal === "Conditional Pass" || resVal === "For Formal Defense" || resVal === "For Re-Defense") {
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

                    const checkGradedSchedulesSql = `
                        SELECT ds.id, ds.defense_type, ds.defense_status, ds.score, ds.panel_result,
                               COUNT(dpe.id) AS eval_count
                        FROM defense_schedules ds
                        LEFT JOIN defense_panel_evaluations dpe ON ds.id = dpe.schedule_id
                        WHERE ds.group_id = ?
                          AND ds.defense_status != 'Cancelled'
                        GROUP BY ds.id
                    `;

                    db.query(checkGradedSchedulesSql, [group.group_db_id], (errGraded, gradedRows) => {
                        const gradedSet = new Set();

                        (gradedRows || []).forEach(row => {
                            const defType = String(row.defense_type || "").trim();
                            const isGraded = row.defense_status === 'Completed'
                                || row.score != null
                                || row.panel_result != null
                                || Number(row.eval_count || 0) >= 2;
                            if (isGraded && defType) {
                                gradedSet.add(defType);
                            }
                        });

                        (verdictRows || []).forEach(v => {
                            if (v.defense_type && v.panel_result) {
                                gradedSet.add(String(v.defense_type).trim());
                            }
                        });

                        const stageStr = String(group.stage || '').toLowerCase().trim();
                        const progressVal = Number(group.progress || 0);

                        if (progressVal >= 25 || stageStr.includes('stage 2') || stageStr.includes('outline') || stageStr.includes('stage 3') || stageStr.includes('pre-final') || stageStr.includes('stage 4') || stageStr.includes('final')) {
                            gradedSet.add("Concept Presentation");
                        }
                        if (progressVal >= 50 || stageStr.includes('stage 3') || stageStr.includes('pre-final') || stageStr.includes('stage 4') || stageStr.includes('final')) {
                            gradedSet.add("Outline Defense");
                        }
                        if (progressVal >= 75 || stageStr.includes('stage 4') || stageStr.includes('final')) {
                            gradedSet.add("Pre-Final Defense");
                        }

                        const isConceptGraded = gradedSet.has("Concept Presentation") || Array.from(gradedSet).some(t => t.toLowerCase().includes("concept"));

                        res.json({
                            success:true,
                            group:{
                                ...group,
                                concept_presentation_graded: isConceptGraded
                            },
                            documents,
                            title_proposals:proposalsResult || [],
                            defense_verdicts:defenseVerdicts || [],
                            concept_presentation_graded: isConceptGraded,
                            graded_defense_types: Array.from(gradedSet)
                        });
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
                                    signed_file_path = NULL,
                                    is_sent = 0,
                                    uploaded_by = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `;

                            db.query("DELETE FROM env_scan_student_signatures WHERE document_id = ?", [existingResult[0].id], () => {});

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
                                        if (resVal === "Conditional Passed" || resVal === "Conditional Pass" || resVal === "For Formal Defense" || resVal === "For Re-Defense") {
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

        const storedPwd = String(result[0].password || "");
        const isBcrypt = storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$");
        const verifyPromise = isBcrypt
            ? bcrypt.compare(String(currentPassword), storedPwd)
            : Promise.resolve(storedPwd === String(currentPassword));

        verifyPromise.then(async (isMatch) => {
        if(!isMatch){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const hashedNewPassword = await bcrypt.hash(String(newPassword), 10);

        const updateSql = `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            AND role = 'student'
        `;

        db.query(
            updateSql,
            [
                hashedNewPassword,
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
        }).catch((errHash) => {
            console.error(errHash);
            res.json({
                success:false,
                message:"Failed to process password change."
            });
        });

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
        recipients,
        submissionMessage
    } = req.body;

    const rawList = recipients || recipientIds;

    if(
        !studentUserId ||
        !documentId ||
        !rawList ||
        !Array.isArray(rawList) ||
        rawList.length === 0
    ){
        return res.json({
            success:false,
            message:"Please select at least one recipient."
        });
    }

    const normalizedRecipients = rawList.map(item => {
        if(item && typeof item === "object"){
            return {
                receiverId: item.receiverId || item.id || item.user_id,
                targetRole: item.targetRole || item.role || null
            };
        }
        return {
            receiverId: item,
            targetRole: null
        };
    }).filter(item => !!item.receiverId);

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
                    if (idx >= normalizedRecipients.length) {
                        return callback(null);
                    }

                    const targetObj = normalizedRecipients[idx];
                    const receiverId = targetObj.receiverId;
                    const targetRole = targetObj.targetRole;

                    const checkExistSql = `
                        SELECT id FROM document_submissions
                        WHERE document_id = ? AND receiver_id = ?
                        ORDER BY id DESC
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
                                    target_role = COALESCE(?, target_role),
                                    sent_at = NOW()
                                WHERE id = ?
                            `;
                            db.query(updateSubmissionSql, [submissionMessage || "", targetRole, existResult[0].id], (errUpdate) => {
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
                                    submission_message,
                                    target_role
                                )
                                VALUES (?, ?, ?, ?, ?)
                            `;
                            db.query(
                                insertSubmissionSql,
                                [documentId, senderId, receiverId, submissionMessage || "", targetRole],
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

        const storedPwd = String(result[0].password || "");
        const isBcrypt = storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$");
        const verifyPromise = isBcrypt
            ? bcrypt.compare(String(currentPassword), storedPwd)
            : Promise.resolve(storedPwd === String(currentPassword));

        verifyPromise.then(async (isMatch) => {
        if(!isMatch){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const hashedNewPassword = await bcrypt.hash(String(newPassword), 10);

        const updateSql = `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            AND role IN ('faculty', 'admin')
        `;

        db.query(
            updateSql,
            [
                hashedNewPassword,
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
        }).catch((errHash) => {
            console.error(errHash);
            res.json({
                success:false,
                message:"Failed to process password change."
            });
        });

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

        const storedPwd = String(result[0].password || "");
        const isBcrypt = storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$");
        const verifyPromise = isBcrypt
            ? bcrypt.compare(String(currentPassword), storedPwd)
            : Promise.resolve(storedPwd === String(currentPassword));

        verifyPromise.then(async (isMatch) => {
        if(!isMatch){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const hashedNewPassword = await bcrypt.hash(String(newPassword), 10);

        const updateSql = `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            AND role = 'admin'
        `;

        db.query(
            updateSql,
            [
                hashedNewPassword,
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
        }).catch((errHash) => {
            console.error(errHash);
            res.json({
                success:false,
                message:"Failed to process password change."
            });
        });

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
            GROUP_CONCAT(DISTINCT u.enrolled_by_user_id) AS instructor_ids,
            GROUP_CONCAT(DISTINCT ins.id) AS instructor_db_ids,
            adviser.id AS adviser_db_id,
            adviser.user_id AS adviser_user_id,
            adviser.fullname AS adviser_name
        FROM capstone_groups cg
        LEFT JOIN group_members gm ON cg.id = gm.group_id
        LEFT JOIN users u ON gm.student_id = u.id
        LEFT JOIN users ins ON u.enrolled_by_user_id = ins.user_id
        LEFT JOIN users adviser ON cg.adviser_id = adviser.id
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
        req.query.userId || req.query.instructorUserId || "";
    console.log(`[REQUEST] GET /defense-schedules userId=${loggedInUserId}`);

    const schedulesSql = `
        SELECT
            ds.id,
            ds.schedule_code,
            ds.group_id AS group_db_id,
            ds.panelist_id,
            ds.created_by,
            ds.room_name,
            DATE_FORMAT(ds.defense_date, '%Y-%m-%d') AS defense_date,
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
                                (evaluationsRequired > 0 && evaluationsSubmitted >= evaluationsRequired)
                                || (schedule.defense_status === 'Completed' && evaluationsSubmitted >= 2);

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
            SELECT ds.*, cg.group_name
            FROM defense_schedules ds
            LEFT JOIN capstone_groups cg ON ds.group_id = cg.id
            WHERE ds.id = ?
            AND ds.created_by = ?
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

                const existingSchedule = ownerResult[0];

                // Check if defense is already happening (in progress)
                const existingDate = existingSchedule.defense_date ? String(existingSchedule.defense_date).slice(0, 10) : "";
                const existingStart = existingSchedule.start_time ? String(existingSchedule.start_time).slice(0, 5) : "";
                const existingEnd = existingSchedule.end_time ? String(existingSchedule.end_time).slice(0, 5) : "";
                const now = new Date();
                const startDt = new Date(`${existingDate}T${existingStart}:00`);
                const endDt = new Date(`${existingDate}T${existingEnd}:00`);
                const isHappening = (now >= startDt && now <= endDt);

                if (isHappening) {
                    const inputDate = String(defenseDate).slice(0, 10);
                    const inputStart = String(startTime).slice(0, 5);
                    const inputEnd = String(endTime).slice(0, 5);
                    const inputRoom = String(roomName).trim();
                    const existingRoom = String(existingSchedule.room_name).trim();

                    if (inputDate !== existingDate || inputStart !== existingStart || inputEnd !== existingEnd || inputRoom !== existingRoom) {
                        return res.json({
                            success: false,
                            message: "Cannot modify date, time, or room while the defense is currently in progress."
                        });
                    }
                }

                // Check adviser and instructor restrictions: student group adviser & instructors cannot be panelists
                const groupRestrictionsSql = `
                    SELECT cg.adviser_id, GROUP_CONCAT(DISTINCT ins.id) AS instructor_ids_str
                    FROM capstone_groups cg
                    LEFT JOIN group_members gm ON cg.id = gm.group_id
                    LEFT JOIN users u ON gm.student_id = u.id
                    LEFT JOIN users ins ON u.enrolled_by_user_id = ins.user_id
                    WHERE cg.id = ?
                    GROUP BY cg.id
                `;
                db.query(groupRestrictionsSql, [groupDbId], (grpErr, grpRows) => {
                    if (grpErr) {
                        console.log(grpErr);
                        return res.json({
                            success: false,
                            message: "Database error while validating group restrictions."
                        });
                    }

                    if (grpRows && grpRows.length > 0) {
                        const forbiddenIds = new Set();
                        if (grpRows[0].adviser_id) forbiddenIds.add(Number(grpRows[0].adviser_id));
                        if (grpRows[0].instructor_ids_str) {
                            grpRows[0].instructor_ids_str.split(',').forEach(id => {
                                if (id) forbiddenIds.add(Number(id));
                            });
                        }
                        forbiddenIds.add(Number(instructorDbId));

                        const hasForbidden = panelistIds.some(pid => forbiddenIds.has(Number(pid)));
                        if (hasForbidden) {
                            return res.json({
                                success: false,
                                message: "The student group's adviser and instructors cannot be selected as panelists for this group."
                            });
                        }
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
                                SELECT id, fullname
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

                                // Check panelist time conflicts with other defense schedules
                                const panelistConflictSql = `
                                    SELECT dsp.panelist_id, u.fullname
                                    FROM defense_schedule_panelists dsp
                                    JOIN defense_schedules ds ON dsp.schedule_id = ds.id
                                    JOIN users u ON dsp.panelist_id = u.id
                                    WHERE dsp.panelist_id IN (?)
                                    AND ds.id != ?
                                    AND ds.defense_date = ?
                                    AND ds.defense_status != 'Cancelled'
                                    AND (? < ds.end_time AND ? > ds.start_time)
                                    LIMIT 1
                                `;

                                db.query(panelistConflictSql, [panelistIds, scheduleId, defenseDate, startTime, endTime], (panConfErr, panConfResult) => {
                                    if (panConfErr) {
                                        console.log(panConfErr);
                                        return res.json({ success: false, message: "Database error checking panelist availability." });
                                    }
                                    if (panConfResult && panConfResult.length > 0) {
                                        return res.json({
                                            success: false,
                                            message: `Panelist ${panConfResult[0].fullname} is already scheduled for another defense at this date and time.`
                                        });
                                    }

                                    // Fetch existing panelists to detect replacements
                                    const existingPanelistsSql = `SELECT panelist_id FROM defense_schedule_panelists WHERE schedule_id = ?`;
                                    db.query(existingPanelistsSql, [scheduleId], (exPanErr, exPanRows) => {
                                        const oldPanelistIds = (exPanRows || []).map(r => Number(r.panelist_id));
                                        const newPanelistIds = panelistIds.map(id => Number(id));
                                        const removedPanelistIds = oldPanelistIds.filter(id => !newPanelistIds.includes(id));
                                        const addedPanelistIds = newPanelistIds.filter(id => !oldPanelistIds.includes(id));

                                        const primaryPanelistId = panelistIds[0];

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

                                                        // Notify removed panelists about cancellation
                                                        if (removedPanelistIds.length > 0) {
                                                            insertUserNotificationsByDbIds(
                                                                removedPanelistIds,
                                                                "Defense Panel Assignment Cancelled",
                                                                `Your assignment as a panelist for group ${existingSchedule.group_name || ""} defense presentation (${defenseType || "defense"}) on ${defenseDate} has been cancelled.`,
                                                                "Defense Schedule"
                                                            );
                                                        }

                                                        // Notify added panelists about assignment
                                                        if (addedPanelistIds.length > 0) {
                                                            insertUserNotificationsByDbIds(
                                                                addedPanelistIds,
                                                                "New Defense Panelist Assignment",
                                                                `You have been assigned as a panelist for group ${existingSchedule.group_name || ""} defense schedule (${defenseType || "defense"}) on ${defenseDate} from ${startTime} to ${endTime} in ${roomName}.`,
                                                                "Defense Schedule"
                                                            );
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
                                });

                            });

                        }
                    );
                });

            }
        );

    });

});


/* ================= DELETE DEFENSE SCHEDULE - OWNER ONLY ================= */

app.delete("/delete-defense-schedule/:scheduleId", (req, res) => {

    const scheduleId =
        req.params.scheduleId;

    const {
        instructorUserId,
        reason,
        notes
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

                // Prevent deletion if schedule already received any grades/evaluations from panel
                const checkEvalsSql = `
                    SELECT COUNT(*) AS evalCount
                    FROM defense_panel_evaluations
                    WHERE schedule_id = ?
                `;

                db.query(checkEvalsSql, [scheduleId], (evalErr, evalRows) => {

                    if(evalErr){
                        console.log(evalErr);
                        return res.json({
                            success:false,
                            message:"Database error while checking evaluations."
                        });
                    }

                    const evalCount = evalRows?.[0]?.evalCount || 0;
                    if(evalCount > 0){
                        return res.json({
                            success:false,
                            message:"Cannot delete defense schedule. One or more panel members have already submitted grades/evaluations for this schedule."
                        });
                    }

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

                            const cancelReasonText = [reason, notes].filter(Boolean).join(" - ");

                            notifyDefenseUsersWithDetails(
                                schedule.group_id,
                                panelistIds,
                                "Defense Schedule Cancelled",
                                "cancelled",
                                schedule.defense_date,
                                schedule.start_time,
                                schedule.end_time,
                                schedule.room_name,
                                cancelReasonText
                            );

                            res.json({
                                success:true,
                                message:"Defense schedule deleted successfully."
                            });

                        }
                    );

                });

                });

            }
        );

    });

});


/* ================= FORCE COMPLETE DEFENSE SCHEDULE ================= */

app.post("/force-complete-defense-schedule/:scheduleId", (req, res) => {
    const scheduleId = req.params.scheduleId;
    const { instructorUserId } = req.body;

    if (!scheduleId || !instructorUserId) {
        return res.json({ success: false, message: "Missing schedule or instructor information." });
    }

    const instructorSql = `
        SELECT id
        FROM users
        WHERE user_id = ?
        AND role IN ('faculty', 'admin')
        AND instructor_access = 1
        LIMIT 1
    `;

    db.query(instructorSql, [instructorUserId], (insErr, insRows) => {
        if (insErr || !insRows || insRows.length === 0) {
            return res.json({ success: false, message: "Instructor account not found or no instructor access." });
        }
        const instructorDbId = insRows[0].id;

        const schedSql = `SELECT * FROM defense_schedules WHERE id = ? AND created_by = ? LIMIT 1`;
        db.query(schedSql, [scheduleId, instructorDbId], (schedErr, schedRows) => {
            if (schedErr || !schedRows || schedRows.length === 0) {
                return res.json({ success: false, message: "You can only force complete defense schedules you created." });
            }
            const schedule = schedRows[0];

            if (schedule.defense_status === 'Completed') {
                return res.json({ success: false, message: "This defense schedule is already completed." });
            }

            const evalsSql = `SELECT * FROM defense_panel_evaluations WHERE schedule_id = ?`;
            db.query(evalsSql, [scheduleId], (evalErr, evaluations) => {
                if (evalErr) {
                    console.log(evalErr);
                    return res.json({ success: false, message: "Database error fetching panel evaluations." });
                }
                const count = (evaluations || []).length;
                if (count < 2) {
                    return res.json({
                        success: false,
                        message: `Force Complete requires at least 2 submitted panel evaluations (currently ${count}/3 submitted).`
                    });
                }

                const compiledResult = aggregateCompiledPanelResult(evaluations);
                const compiledScore = aggregateCompiledScore(evaluations);
                const compiledApprovedTitleId = pickCompiledApprovedTitleId(evaluations);
                const compiledComments = (evaluations || []).map((row, idx) => `Panelist ${idx + 1}: ${row.comments || "None"}`).join("\n");
                const compiledRecommendations = (evaluations || []).map((row, idx) => `Panelist ${idx + 1}: ${row.recommendations || "None"}`).join("\n");
                const compiledConceptDetails = (evaluations || []).map(r => r.concept_evaluation_details).find(v => v) || null;
                const compiledOutlineDetails = (evaluations || []).map(r => r.outline_evaluation_details).find(v => v) || null;

                const updateSql = `
                    UPDATE defense_schedules
                    SET score = ?, panel_result = ?, comments = ?, recommendations = ?, approved_title_id = ?,
                        concept_evaluation_details = ?, outline_evaluation_details = ?, defense_status = 'Completed'
                    WHERE id = ?
                `;
                db.query(updateSql, [
                    compiledScore, compiledResult, compiledComments, compiledRecommendations,
                    compiledApprovedTitleId, compiledConceptDetails, compiledOutlineDetails, scheduleId
                ], (updErr) => {
                    if (updErr) {
                        console.log(updErr);
                        return res.json({ success: false, message: "Failed to force complete defense schedule." });
                    }

                    const nextStage = getGroupStageAfterDefense(schedule.defense_type, compiledResult);
                    if (nextStage && schedule.group_id) {
                        db.query("UPDATE capstone_groups SET stage = ?, progress = ? WHERE id = ?", [nextStage, getProgressPercentForStage(nextStage), schedule.group_id], () => {});
                    }

                    const memberSql = `SELECT student_id FROM group_members WHERE group_id = ?`;
                    db.query(memberSql, [schedule.group_id], (mErr, mRows) => {
                        if (!mErr && mRows) {
                            insertUserNotificationsByDbIds(
                                mRows.map(r => r.student_id),
                                "Defense Completed",
                                `Your ${schedule.defense_type} has been completed with ${count} panel evaluations. Result: ${compiledResult}.`,
                                "Defense Evaluation"
                            );
                        }
                    });

                    res.json({
                        success: true,
                        message: `Defense schedule force-completed successfully with ${count} panel evaluations.`
                    });
                });
            });
        });
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

    // Determine if the studentUserId value is a numeric DB id or a string user_id
    const numericId = /^\d+$/.test(String(studentUserId || '').trim()) ? Number(studentUserId) : null;

    const findStudentSql = numericId
        ? `
            SELECT u.id, u.user_id, u.fullname, u.program, u.enrolled_by_user_id,
                   gm.group_id AS group_id,
                   cg.group_name, cg.stage, cg.progress
            FROM users u
            LEFT JOIN group_members gm ON u.id = gm.student_id
            LEFT JOIN capstone_groups cg ON gm.group_id = cg.id
            WHERE u.id = ?
            LIMIT 1
        `
        : `
            SELECT u.id, u.user_id, u.fullname, u.program, u.enrolled_by_user_id,
                   gm.group_id AS group_id,
                   cg.group_name, cg.stage, cg.progress
            FROM users u
            LEFT JOIN group_members gm ON u.id = gm.student_id
            LEFT JOIN capstone_groups cg ON gm.group_id = cg.id
            WHERE u.user_id = ?
            LIMIT 1
        `;

    db.query(findStudentSql, [numericId !== null ? numericId : studentUserId], (errStudent, studentRows) => {
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
        const enrolledBy = student.enrolled_by_user_id;

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

            // Check if group is already graded in Concept Presentation
            const checkConceptGradedSql = `
                SELECT ds.id
                FROM defense_schedules ds
                LEFT JOIN defense_panel_evaluations dpe ON ds.id = dpe.schedule_id
                WHERE ds.group_id = ?
                  AND (
                      LOWER(TRIM(ds.defense_type)) LIKE '%concept%'
                      OR LOWER(TRIM(ds.defense_type)) = 'concept presentation'
                  )
                  AND (
                      ds.defense_status = 'Completed'
                      OR ds.score IS NOT NULL
                      OR ds.panel_result IS NOT NULL
                      OR dpe.id IS NOT NULL
                  )
                LIMIT 1
            `;

            db.query(checkConceptGradedSql, [groupDbId], (errGraded, gradedRows) => {
                const isConceptGraded = Boolean(
                    (!errGraded && gradedRows && gradedRows.length > 0) ||
                    (student.stage && !['Stage 1', 'Concept Presentation', '1'].includes(String(student.stage).trim())) ||
                    (Number(student.progress || 0) >= 25)
                );

                if (isConceptGraded) {
                    return res.json({
                        success: false,
                        message: "Cannot report decline. Your group has already finished and been graded in Concept Presentation."
                    });
                }

                const doc = docRows[0];
                const docTitle = doc.document_title || doc.document_type || "Environmental Scanning";
                const fullReason = reasonCategory + (reasonText && reasonText.trim() ? ` - ${reasonText.trim()}` : "");
                const statusToSet = newStatus || "Declined by Organization";

                const updateDocSql = `
                    UPDATE student_documents
                    SET document_status = ?,
                        signed_file_path = NULL,
                        is_sent = 0,
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

                    // Reset student signatures so that a new file can be signed cleanly
                    db.query("DELETE FROM env_scan_student_signatures WHERE document_id = ?", [documentId], () => {});

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
                        WHERE (user_id = ?)
                           OR (role = 'admin' AND position = ?)
                           OR (position = 'Dean')
                           OR (role = 'admin' AND position LIKE 'Program Chairperson%')
                    `;

                    db.query(findRecipientsSql, [enrolledBy || '', chairPosition], (errRecip, recipientRows) => {
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
            { label:"Defense minutes", slots:1 }
        ]
    },
    {
        category:"Pre-Final Defense",
        items:[
            { label:"Chapter 3-4", slots:1 },
            { label:"Recommendation letter", slots:1 },
            { label:"Defense minutes", slots:1 }
        ]
    },
    {
        category:"Final Defense",
        items:[
            { label:"Chapter 1-4", slots:1 },
            { label:"Recommendation letter", slots:1 },
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

    // Flexible aliases for chapter documents and recommendation letters
    const lowerLabel = String(baseLabel || "").toLowerCase();
    if(lowerLabel.includes("chapter 1 and 2") || lowerLabel.includes("chapter 1-2")){
        candidates.push(`${category} • Chapter 1 and 2`);
        candidates.push(`${category} • Chapter 1-2`);
        candidates.push(`${category} • Chapter 1 to 2`);
    } else if(lowerLabel.includes("chapter 1-4") || lowerLabel.includes("chapter 1 to 4") || lowerLabel.includes("chapter 3-4")){
        candidates.push(`${category} • Chapter 1-4`);
        candidates.push(`${category} • Chapter 1 to 4`);
        candidates.push(`${category} • Chapter 3-4`);
    }
    if(lowerLabel.includes("recommendation")){
        candidates.push(`${category} • Recommendation letter`);
        candidates.push(`${category} • Recommendation for outline defense`);
        candidates.push(`${category} • Recommendation for concept presentation`);
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

    // For BSIT programs, skip Environmental Scanning requirement entirely
    const isBSIT = options && options.isBSIT;

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

            // BSIT programs do not require Environmental Scanning
            if(isBSIT && String(item.label || '').toLowerCase().includes('environmental')){
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

function buildMissingApprovedForDefenseScheduleWithProgram(documents, defenseType, options, groupProgram){

    const isBSIT = (String(groupProgram || '').trim().toUpperCase() === 'IT' || String(groupProgram || '').trim().toUpperCase() === 'BSIT');

    const phases =
        getCatalogPhasesForScheduleCheck(
            defenseType,
            options && options.requireAllPhases
        );

    const summaries =
        phases.map(phase =>
            buildPhaseApprovalSummary(documents, phase, { ...(options || {}), isBSIT })
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
                            (evaluationsRequired > 0 && evaluationsSubmitted >= evaluationsRequired)
                            || (priorSchedule.defense_status === 'Completed' && evaluationsSubmitted >= 2);

                        if(!ok){
                            return callback(null, {
                                ok:false,
                                prior_defense_type:priorDefenseType,
                                evaluations_submitted:evaluationsSubmitted,
                                evaluations_required:evaluationsRequired,
                                message:`${priorDefenseType} panel evaluations are incomplete (${evaluationsSubmitted}/${evaluationsRequired}). All panelists must submit grades before scheduling ${defenseType}.`
                            });
                        }

                        // Check if the prior defense phase requires defense minutes approval before scheduling the next phase
                        const priorRequiresMinutes = priorDefenseType === "Outline Defense" || priorDefenseType === "Pre-Final Defense";
                        if(priorRequiresMinutes){
                            const minutesPattern = priorDefenseType === "Outline Defense" ? "%outline%defense minutes%" : "%pre-final%defense minutes%";
                            const minutesAltPattern = priorDefenseType === "Outline Defense" ? "%outline%minutes%" : "%prefinal%defense minutes%";

                            const checkPriorMinutesSql = `
                                SELECT id, document_status
                                FROM student_documents
                                WHERE group_id = ?
                                  AND (
                                      LOWER(document_type) LIKE LOWER(?)
                                      OR LOWER(document_type) LIKE LOWER(?)
                                      OR LOWER(document_title) LIKE LOWER(?)
                                  )
                                  AND document_status = 'Approved'
                                LIMIT 1
                            `;

                            db.query(checkPriorMinutesSql, [groupDbId, minutesPattern, minutesAltPattern, minutesPattern], (minErr, minRows) => {
                                if(minErr){
                                    return callback(minErr);
                                }

                                if(!minRows || minRows.length === 0){
                                    return callback(null, {
                                        ok:false,
                                        prior_defense_type:priorDefenseType,
                                        evaluations_submitted:evaluationsSubmitted,
                                        evaluations_required:evaluationsRequired,
                                        message:`Cannot create defense schedule for ${defenseType}. The group's ${priorDefenseType} minutes must be uploaded and approved by the adviser first.`
                                    });
                                }

                                callback(null, {
                                    ok:true,
                                    prior_defense_type:priorDefenseType,
                                    evaluations_submitted:evaluationsSubmitted,
                                    evaluations_required:evaluationsRequired,
                                    message:null
                                });
                            });
                        } else {
                            callback(null, {
                                ok:true,
                                prior_defense_type:priorDefenseType,
                                evaluations_submitted:evaluationsSubmitted,
                                evaluations_required:evaluationsRequired,
                                message:null
                            });
                        }

                    }
                );

            }
        );

    });

}

function validateGroupDocumentsForScheduleCreate(groupDbId, defenseType, options, callback){

    // Fetch group program first to handle BSIT vs BSIS document requirements
    db.query('SELECT program FROM capstone_groups WHERE id = ? LIMIT 1', [groupDbId], (progErr, progRows) => {

        const groupProgram = (!progErr && progRows && progRows[0]) ? progRows[0].program : null;

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
                buildMissingApprovedForDefenseScheduleWithProgram(
                    documents || [],
                    defenseType,
                    scheduleOptions,
                    groupProgram
                );

            callback(null, {
                documents:documents || [],
                summaries:approvalResult.summaries,
                missing:approvalResult.missing,
                documents_ready_for_schedule:
                    approvalResult.missing.length === 0
            });

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

        // 1. Check for ongoing/pending schedules (Scheduled or Ongoing) for this presentation type
        const ongoingSchedule = rows.find(row => 
            (row.defense_status === 'Scheduled' || row.defense_status === 'Ongoing') &&
            defenseTypesMatch(row.defense_type, defenseType) &&
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

                        // Check if group has a completed schedule for this defense type (re-defense scenario)
                        const priorCompletedForType = rows.find(row =>
                            row.defense_status === 'Completed' &&
                            defenseTypesMatch(row.defense_type, defenseType)
                        );
                        let isRedefense = false;
                        let redefenseVerdict = null;
                        if(priorCompletedForType){
                            const res = String(priorCompletedForType.panel_result || "").trim();
                            if(res === "Conditional Passed" || res === "Conditional Pass"){
                                isRedefense = true;
                                redefenseVerdict = "Conditional Passed";
                            }else if(res === "For Formal Defense" || res === "For Re-Defense"){
                                isRedefense = true;
                                redefenseVerdict = "For Formal Defense";
                            }
                        }

                        callback(null, {
                            ...documentResult,
                            prior_panel_evaluations:priorPanel,
                            ready_for_schedule:readyForSchedule,
                            is_redefense:isRedefense,
                            redefense_verdict:redefenseVerdict,
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
                prior_panel_evaluations:result.prior_panel_evaluations || null,
                is_redefense:result.is_redefense || false,
                redefense_verdict:result.redefense_verdict || null
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

        // Check adviser and instructor restrictions: student group adviser & instructors cannot be panelists
        const groupRestrictionsSql = `
            SELECT cg.adviser_id, GROUP_CONCAT(DISTINCT ins.id) AS instructor_ids_str
            FROM capstone_groups cg
            LEFT JOIN group_members gm ON cg.id = gm.group_id
            LEFT JOIN users u ON gm.student_id = u.id
            LEFT JOIN users ins ON u.enrolled_by_user_id = ins.user_id
            WHERE cg.id = ?
            GROUP BY cg.id
        `;
        db.query(groupRestrictionsSql, [groupDbId], (grpErr, grpRows) => {
            if (grpErr) {
                console.log(grpErr);
                return res.json({
                    success: false,
                    message: "Database error while validating group restrictions."
                });
            }

            if (grpRows && grpRows.length > 0) {
                const forbiddenIds = new Set();
                if (grpRows[0].adviser_id) forbiddenIds.add(Number(grpRows[0].adviser_id));
                if (grpRows[0].instructor_ids_str) {
                    grpRows[0].instructor_ids_str.split(',').forEach(id => {
                        if (id) forbiddenIds.add(Number(id));
                    });
                }
                forbiddenIds.add(Number(createdBy));

                const hasForbidden = panelistIds.some(pid => forbiddenIds.has(Number(pid)));
                if (hasForbidden) {
                    return res.json({
                        success: false,
                        message: "The student group's adviser and instructors cannot be selected as panelists for this group."
                    });
                }
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

                // Check if group already has an active defense schedule for this defense type
                const groupDupSql = `
                    SELECT id FROM defense_schedules
                    WHERE group_id = ?
                    AND defense_type = ?
                    AND defense_status IN ('Scheduled', 'Ongoing')
                    LIMIT 1
                `;

                db.query(groupDupSql, [groupDbId, defenseType || "Concept Presentation"], (dupErr, dupRows) => {

                    if(dupErr){
                        console.log(dupErr);
                        return res.json({
                            success:false,
                            message:"Database error while checking group schedule."
                        });
                    }

                    if(dupRows && dupRows.length > 0){
                        return res.json({
                            success:false,
                            message:`This group already has an active defense schedule for ${defenseType || 'this defense type'}.`
                        });
                    }

                    const conflictSql = `
                        SELECT id
                        FROM defense_schedules
                        WHERE defense_date = ?
                        AND room_name = ?
                        AND defense_status != 'Cancelled'
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

                            // Check panelist conflicts with other defense schedules
                            const panelistConflictSql = `
                                SELECT dsp.panelist_id, u.fullname
                                FROM defense_schedule_panelists dsp
                                JOIN defense_schedules ds ON dsp.schedule_id = ds.id
                                JOIN users u ON dsp.panelist_id = u.id
                                WHERE dsp.panelist_id IN (?)
                                AND ds.defense_date = ?
                                AND ds.defense_status != 'Cancelled'
                                AND (? < ds.end_time AND ? > ds.start_time)
                                LIMIT 1
                            `;

                            db.query(panelistConflictSql, [panelistIds, defenseDate, startTime, endTime], (panConfErr, panConfResult) => {

                                if(panConfErr){
                                    console.log(panConfErr);
                                    return res.json({
                                        success:false,
                                        message:"Database error checking panelist availability."
                                    });
                                }

                                if(panConfResult && panConfResult.length > 0){
                                    return res.json({
                                        success:false,
                                        message:`Panelist ${panConfResult[0].fullname} is already scheduled for another defense at this date and time.`
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

                });

                });

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

        // Prevent deletion if schedule already received any grades/evaluations from panel
        const checkEvalsSql = `
            SELECT COUNT(*) AS evalCount
            FROM defense_panel_evaluations
            WHERE schedule_id = ?
        `;

        db.query(checkEvalsSql, [scheduleId], (evalErr, evalRows) => {

            if(evalErr){
                console.log(evalErr);
                return res.json({
                    success:false,
                    message:"Database error while checking evaluations."
                });
            }

            const evalCount = evalRows?.[0]?.evalCount || 0;
            if(evalCount > 0){
                return res.json({
                    success:false,
                    message:"Cannot delete defense schedule. One or more panel members have already submitted grades/evaluations for this schedule."
                });
            }

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

function buildDefenseNotificationMessage(action, defenseDate, startTime, endTime, roomName, panelistNamesText, cancelReason){

    const panelLine =
        `Panel: ${panelistNamesText || "No panelists listed"}.`;
    const reasonLine = cancelReason ? ` Reason: ${cancelReason}.` : "";

    if(action === "created"){

        return `A defense schedule has been created on ${defenseDate} from ${startTime} to ${endTime} at ${roomName}. ${panelLine}`;

    }

    if(action === "updated"){

        return `A defense schedule was updated. New schedule: ${defenseDate} from ${startTime} to ${endTime} at ${roomName}. ${panelLine}`;

    }

    if(action === "deleted" || action === "cancelled"){

        return `A defense schedule on ${defenseDate} from ${startTime} to ${endTime} at ${roomName} has been cancelled.${reasonLine} ${panelLine}`;

    }

    return `${panelLine}${reasonLine}`;

}

function notifyDefenseUsersWithDetails(groupDbId, panelistIds, title, action, defenseDate, startTime, endTime, roomName, cancelReason){

    getPanelistNamesText(panelistIds, (panelistNamesText) => {

        const message =
            buildDefenseNotificationMessage(
                action,
                defenseDate,
                startTime,
                endTime,
                roomName,
                panelistNamesText,
                cancelReason
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
                DATE_FORMAT(ds.defense_date, '%Y-%m-%d') AS defense_date,
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
                DATE_FORMAT(ds.defense_date, '%Y-%m-%d') AS defense_date,
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
                    u.student_position,
                    COALESCE(u.student_status, 'ACTIVE') AS student_status
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
                        evaluationCounts,
                        priorSchedules
                    ) => {

                        const schedulesWithDetails =
                            schedules.map(schedule => {

                                const schedulePanelists =
                                    panelists.filter(panelistItem =>
                                        Number(panelistItem.schedule_id)
                                        === Number(schedule.id)
                                    );

                                const priorMatches = (priorSchedules || []).filter(p =>
                                    Number(p.group_id) === Number(schedule.group_db_id)
                                    && Number(p.id) < Number(schedule.id)
                                    && defenseTypesMatch(p.defense_type, schedule.defense_type)
                                );
                                const lastPrior = priorMatches.length > 0 ? priorMatches[priorMatches.length - 1] : null;
                                const isFormalDef = lastPrior && (lastPrior.panel_result === 'For Formal Defense' || lastPrior.panel_result === 'For Re-Defense');
                                const isCondPass = lastPrior && (lastPrior.panel_result === 'Conditional Passed' || lastPrior.panel_result === 'Conditional Pass');

                                const is_redefense = Boolean(isFormalDef || isCondPass);
                                const prior_verdict = isFormalDef ? 'For Formal Defense' : (isCondPass ? 'Conditional Passed' : null);
                                const max_grade = isFormalDef ? 75 : null;

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
                                        && evaluationsSubmitted >= evaluationsRequired,

                                    is_redefense:is_redefense,
                                    prior_verdict:prior_verdict,
                                    max_grade:max_grade
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

                                            const priorSchedulesSql = `
                                                SELECT id, group_id, defense_type, panel_result
                                                FROM defense_schedules
                                                WHERE group_id IN (?)
                                                  AND defense_status = 'Completed'
                                                ORDER BY id ASC
                                            `;

                                            db.query(
                                                priorSchedulesSql,
                                                [groupDbIds],
                                                (priorErr, priorSchedules) => {

                                                    finishPanelistResponse(
                                                        proposals,
                                                        documents,
                                                        myEvaluations,
                                                        evaluationCounts,
                                                        priorSchedules || []
                                                    );

                                                }
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

/* ================= ARCHIVE / DELETE LATE PANELIST DEFENSE ================= */

app.post("/archive-panelist-defense", (req, res) => {
    const { schedule_id, panelist_user_id, action } = req.body;

    if (!schedule_id || !panelist_user_id) {
        return res.json({ success: false, message: "Missing schedule ID or panelist user ID." });
    }

    const findPanelistSql = `
        SELECT id, user_id, fullname
        FROM users
        WHERE (user_id = ? OR id = ?) AND role IN ('faculty', 'admin')
        LIMIT 1
    `;

    db.query(findPanelistSql, [panelist_user_id, panelist_user_id], (errUser, userRows) => {
        if (errUser) {
            console.error("Lookup panelist error:", errUser);
            return res.json({ success: false, message: "Database error finding panelist." });
        }
        if (!userRows || userRows.length === 0) {
            return res.json({ success: false, message: "Panelist account not found." });
        }

        const panelistDbId = userRows[0].id;

        if (action === "delete") {
            const delAssignmentSql = `DELETE FROM defense_schedule_panelists WHERE schedule_id = ? AND panelist_id = ?`;
            db.query(delAssignmentSql, [schedule_id, panelistDbId], (delAssignErr) => {
                if (delAssignErr) {
                    console.error("Delete panelist assignment error:", delAssignErr);
                    return res.json({ success: false, message: "Failed to remove defense assignment." });
                }

                db.query(
                    `DELETE FROM defense_panel_evaluations WHERE schedule_id = ? AND panelist_id = ?`,
                    [schedule_id, panelistDbId],
                    () => {}
                );

                console.log(`[DEFENSE ASSIGNMENT DELETED] Schedule ${schedule_id} removed for panelist ${panelistDbId}`);
                return res.json({
                    success: true,
                    message: "Defense assignment has been permanently deleted from your assigned defenses."
                });
            });
        } else if (action === "restore") {
            const restoreSql = `
                DELETE FROM defense_panel_evaluations
                WHERE schedule_id = ? AND panelist_id = ? AND panel_result IN ('Did Not Evaluate', 'Archived (Did Not Evaluate)')
            `;
            db.query(restoreSql, [schedule_id, panelistDbId], (resErr) => {
                if (resErr) {
                    console.error("Restore defense error:", resErr);
                    return res.json({ success: false, message: "Failed to restore defense." });
                }
                return res.json({
                    success: true,
                    message: "Defense restored to active defense list."
                });
            });
        } else {
            const archiveSql = `
                INSERT INTO defense_panel_evaluations
                (
                    schedule_id,
                    panelist_id,
                    score,
                    panel_result,
                    comments,
                    recommendations,
                    evaluated_at
                )
                VALUES (?, ?, 'N/A', 'Did Not Evaluate', 'Archived by panelist (Did not attend/evaluate).', '', NOW())
                ON DUPLICATE KEY UPDATE
                    score = 'N/A',
                    panel_result = 'Did Not Evaluate',
                    comments = 'Archived by panelist (Did not attend/evaluate).',
                    updated_at = NOW()
            `;

            db.query(archiveSql, [schedule_id, panelistDbId], (archErr) => {
                if (archErr) {
                    console.error("Archive defense error:", archErr);
                    return res.json({ success: false, message: "Failed to archive defense: " + archErr.message });
                }

                console.log(`[DEFENSE ARCHIVED] Schedule ${schedule_id} archived as Did Not Evaluate for panelist ${panelistDbId}`);
                return res.json({
                    success: true,
                    message: "Defense archived successfully and moved to History."
                });
            });
        }
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
        .filter(r => r && !r.toLowerCase().includes("did not evaluate") && !r.toLowerCase().includes("archived"));

    if(results.length === 0){
        return "Pending";
    }

    if(results.some(result => result === "Failed")){
        return "Failed";
    }

    if(results.some(result => result === "For Formal Defense" || result === "For Re-Defense")){
        return "For Formal Defense";
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
    if(resultStr === "Failed" || resultStr === "For Formal Defense" || resultStr === "For Re-Defense" || resultStr === "Conditional Passed" || resultStr === "Conditional Pass"){
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
        "Stage 5":100,
        "Final":100,
        "Completed":100
    };

    return progressMap[stage] ?? 0;

}

function getProgressForStage(stage){
    return getProgressPercentForStage(stage);
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
                                        if (compiledResult === "Conditional Passed" || compiledResult === "Conditional Pass" || compiledResult === "For Formal Defense" || compiledResult === "For Re-Defense") {
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
                                        if (compiledResult === "Conditional Passed" || compiledResult === "Conditional Pass" || compiledResult === "For Formal Defense" || compiledResult === "For Re-Defense") {
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
                    (evaluationsRequired > 0 && evaluationsSubmitted >= evaluationsRequired)
                    || (schedule.defense_status === 'Completed' && evaluationsSubmitted >= 2);

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

    if((panel_result === "Conditional Passed" || panel_result === "Conditional Pass" || panel_result === "For Formal Defense" || panel_result === "For Re-Defense") && (!comments || String(comments).trim() === "")){

        return res.json({
            success:false,
            message:`Comments and feedback are required when the result is "${panel_result}".`
        });

    }

    const isScoreOptional = panel_result === "Conditional Passed" || panel_result === "Conditional Pass" || panel_result === "For Formal Defense" || panel_result === "For Re-Defense";
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

                    // Check if this schedule is a re-defense following For Formal Defense (max grade 75)
                    const checkPriorVerdictSql = `
                        SELECT id, panel_result, defense_type
                        FROM defense_schedules
                        WHERE group_id = ?
                          AND defense_status = 'Completed'
                          AND id < ?
                        ORDER BY id DESC
                    `;
                    db.query(checkPriorVerdictSql, [schedule.group_id, schedule.id], (priorVerdictErr, priorVerdictRows) => {
                        const priorMatches = (priorVerdictRows || []).filter(p => defenseTypesMatch(p.defense_type, schedule.defense_type));
                        const lastPrior = priorMatches.length > 0 ? priorMatches[0] : null;
                        const wasFormalDefense = lastPrior && (lastPrior.panel_result === 'For Formal Defense' || lastPrior.panel_result === 'For Re-Defense');

                        if (wasFormalDefense && score && !isScoreOptional) {
                            const numScore = parseFloat(score);
                            if (!isNaN(numScore)) {
                                if (numScore > 5 && numScore > 75) {
                                    return res.json({
                                        success: false,
                                        message: "The highest grade allowed for this re-defense is 75 because the previous verdict was For Formal Defense."
                                    });
                                }
                                if (numScore >= 1.00 && numScore < 3.00) {
                                    return res.json({
                                        success: false,
                                        message: "The highest grade allowed for this re-defense is 75 (GPA 3.00) because the previous verdict was For Formal Defense."
                                    });
                                }
                            }
                        }

                    // Defense grading safeguard: block INACTIVE or DROPPED students from receiving points
                    const groupMembersStatusSql = `
                        SELECT u.id, u.user_id, COALESCE(u.student_status, 'ACTIVE') AS student_status
                        FROM group_members gm
                        JOIN users u ON gm.student_id = u.id
                        WHERE gm.group_id = ?
                    `;
                    db.query(groupMembersStatusSql, [schedule.group_id], (gmErr, gmRows) => {
                        const inactiveIds = new Set();
                        (gmRows || []).forEach(r => {
                            if (String(r.student_status || "").toUpperCase() !== "ACTIVE") {
                                inactiveIds.add(String(r.id));
                                inactiveIds.add(String(r.user_id));
                            }
                        });

                        let finalConceptDetails = concept_evaluation_details;
                        let finalOutlineDetails = outline_evaluation_details;

                        if (finalConceptDetails && inactiveIds.size > 0) {
                            try {
                                const parsed = typeof finalConceptDetails === 'string' ? JSON.parse(finalConceptDetails) : finalConceptDetails;
                                if (Array.isArray(parsed.presenters)) {
                                    parsed.presenters.forEach(p => {
                                        if (inactiveIds.has(String(p.student_id)) || inactiveIds.has(String(p.id))) {
                                            p.disposition_score = null;
                                            p.delivery_score = null;
                                            p.status = "NOT_GRADED";
                                        }
                                    });
                                    finalConceptDetails = JSON.stringify(parsed);
                                }
                            } catch (e) {}
                        }

                        if (finalOutlineDetails && inactiveIds.size > 0) {
                            try {
                                const parsed = typeof finalOutlineDetails === 'string' ? JSON.parse(finalOutlineDetails) : finalOutlineDetails;
                                if (Array.isArray(parsed.presenters)) {
                                    parsed.presenters.forEach(p => {
                                        if (inactiveIds.has(String(p.student_id)) || inactiveIds.has(String(p.id))) {
                                            p.disposition_score = null;
                                            p.delivery_score = null;
                                            p.status = "NOT_GRADED";
                                        }
                                    });
                                    finalOutlineDetails = JSON.stringify(parsed);
                                }
                            } catch (e) {}
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
                                finalConceptDetails || null,
                                finalOutlineDetails || null
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

            });

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
            AND (ds.target_role = 'instructor' OR ds.target_role IS NULL)
            AND ds.id IN (
                SELECT MAX(inner_ds.id)
                FROM document_submissions inner_ds
                WHERE inner_ds.receiver_id = ?
                AND (inner_ds.target_role = 'instructor' OR inner_ds.target_role IS NULL)
                GROUP BY inner_ds.document_id
            )

            ORDER BY ds.sent_at DESC
        `;

        db.query(receivedSql, [instructorDbId, instructorDbId], (err, receivedDocuments) => {

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

                    /* Sanitize text fields that may contain control characters */
                    const sanitizeStr = (v) => v == null ? null : String(v).replace(/[\x00-\x1F\x7F]/g, ' ').trim();
                    const cleanReceived = receivedDocuments.map(doc => ({
                        ...doc,
                        submission_message: sanitizeStr(doc.submission_message),
                        review_comment: sanitizeStr(doc.review_comment),
                        document_title: sanitizeStr(doc.document_title),
                        document_type: sanitizeStr(doc.document_type),
                        project_title: sanitizeStr(doc.project_title),
                        group_name: sanitizeStr(doc.group_name),
                        sender_name: sanitizeStr(doc.sender_name),
                        reviewer_name: sanitizeStr(doc.reviewer_name),
                    }));

                    res.json({
                        success:true,
                        instructor,
                        stats:{
                            receivedDocuments:cleanReceived.length,
                            sentDocuments:sentDocuments.length,
                            pendingCount,
                            approvedCount,
                            subjectToChangeCount
                        },
                        receivedDocuments: cleanReceived,
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
            AND (ds.target_role = 'adviser' OR ds.target_role IS NULL)
            AND ds.id IN (
                SELECT MAX(inner_ds.id)
                FROM document_submissions inner_ds
                WHERE inner_ds.receiver_id = ?
                AND (inner_ds.target_role = 'adviser' OR inner_ds.target_role IS NULL)
                GROUP BY inner_ds.document_id
            )

            ORDER BY ds.sent_at DESC
        `;

        db.query(receivedSql, [adviserDbId, adviserDbId], (err, receivedDocuments) => {

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
        || docType.includes("recommendation for outline")
        || docTitle.includes("recommendation for outline")
        || docType.includes("recommendation letter")
        || docTitle.includes("recommendation letter")
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

/* ================= ENVIRONMENTAL SCANNING STUDENT SIGNATURES ================= */

app.get("/env-scan-student-signatures/:documentId", (req, res) => {
    const documentId = req.params.documentId;
    const studentUserId = req.query.studentUserId;

    if (!documentId) {
        return res.json({ success: false, message: "Missing documentId parameter." });
    }

    const docSql = `
        SELECT id, group_id, document_title, document_type, document_status, file_path, signed_file_path
        FROM student_documents
        WHERE id = ?
        LIMIT 1
    `;

    db.query(docSql, [documentId], (err, docRows) => {
        if (err) {
            console.error("Error fetching student document for env scan:", err);
            return res.json({ success: false, message: "Database error fetching document." });
        }
        if (!docRows || docRows.length === 0) {
            return res.json({ success: false, message: "Environmental scanning document not found." });
        }

        const doc = docRows[0];
        const groupId = doc.group_id;

        const membersSql = `
            SELECT u.id, u.user_id, u.fullname,
                   COALESCE(gm.member_position, u.student_position, 'Member') AS student_position,
                   COALESCE(u.student_status, 'ACTIVE') AS student_status
            FROM group_members gm
            JOIN users u ON gm.student_id = u.id
            WHERE gm.group_id = ?
            ORDER BY u.id ASC
        `;

        db.query(membersSql, [groupId], (err2, memberRows) => {
            if (err2) {
                console.error("Error fetching group members for env scan:", err2);
                return res.json({ success: false, message: "Failed to fetch group members." });
            }

            const sigsSql = `
                SELECT student_user_id, student_name, student_position, signed_file_path, signed_at
                FROM env_scan_student_signatures
                WHERE document_id = ?
            `;

            db.query(sigsSql, [documentId], (err3, sigRows) => {
                if (err3) {
                    console.error("Error fetching env scan signatures:", err3);
                    return res.json({ success: false, message: "Failed to fetch signatures." });
                }

                const sigMap = {};
                (sigRows || []).forEach(s => {
                    sigMap[s.student_user_id] = s;
                });

                const members = (memberRows || []).map(m => {
                    const sig = sigMap[m.user_id];
                    return {
                        id: m.id,
                        user_id: m.user_id,
                        fullname: m.fullname,
                        student_position: m.student_position,
                        student_status: m.student_status,
                        has_signed: !!sig,
                        signed_at: sig ? sig.signed_at : null
                    };
                });

                const activeMembers = members.filter(m => m.student_status === "ACTIVE");
                const totalMembers = activeMembers.length;
                const totalSigned = activeMembers.filter(m => m.has_signed).length;
                const allSigned = totalMembers > 0 && totalSigned >= totalMembers;

                const normFilePath = doc.file_path && !doc.file_path.startsWith('/') ? '/' + doc.file_path : doc.file_path;
                const normSignedPath = doc.signed_file_path && !doc.signed_file_path.startsWith('/') ? '/' + doc.signed_file_path : doc.signed_file_path;

                res.json({
                    success: true,
                    document_id: doc.id,
                    document_title: doc.document_title,
                    file_path: normFilePath,
                    signed_file_path: normSignedPath || null,
                    total_members: totalMembers,
                    total_signed: totalSigned,
                    all_signed: allSigned,
                    members: members
                });
            });
        });
    });
});

app.post("/student-apply-env-scan-signature", async (req, res) => {
    const { studentUserId, documentId, signatureImage, signatureType, placement } = req.body;

    if (!studentUserId || !documentId || !placement) {
        return res.json({ success: false, message: "Missing required signing information." });
    }

    const studentSql = `
        SELECT id, user_id, fullname, student_position, COALESCE(student_status, 'ACTIVE') AS student_status, digital_signature
        FROM users
        WHERE user_id = ? AND role = 'student'
        LIMIT 1
    `;

    db.query(studentSql, [studentUserId], async (err, studentRows) => {
        if (err) {
            console.error("Error fetching student for env scan signing:", err);
            return res.json({ success: false, message: "Database error." });
        }
        if (!studentRows || studentRows.length === 0) {
            return res.json({ success: false, message: "Student account not found." });
        }

        const student = studentRows[0];
        if (student.student_status !== "ACTIVE") {
            return res.json({ success: false, message: `Your account is marked as ${student.student_status}. Only active members can sign documents.` });
        }

        const docSql = `
            SELECT id, group_id, document_title, document_type, document_status, file_path, signed_file_path
            FROM student_documents
            WHERE id = ?
            LIMIT 1
        `;

        db.query(docSql, [documentId], async (errDoc, docRows) => {
            if (errDoc) {
                console.error("Error fetching document for env scan signing:", errDoc);
                return res.json({ success: false, message: "Database error." });
            }
            if (!docRows || docRows.length === 0) {
                return res.json({ success: false, message: "Document not found." });
            }

            const doc = docRows[0];

            // Verify membership in doc.group_id
            const memberSql = `
                SELECT id, member_position FROM group_members WHERE group_id = ? AND student_id = ? LIMIT 1
            `;
            db.query(memberSql, [doc.group_id, student.id], async (errMem, memRows) => {
                if (errMem || !memRows || memRows.length === 0) {
                    return res.json({ success: false, message: "You are not an active member of this capstone group." });
                }

                const studentPos = (memRows[0].member_position || student.student_position || "Member");

                // Check if already signed
                const checkSigSql = `
                    SELECT id FROM env_scan_student_signatures WHERE document_id = ? AND student_user_id = ? LIMIT 1
                `;
                db.query(checkSigSql, [documentId, studentUserId], async (errCheck, existingSig) => {
                    if (errCheck) {
                        return res.json({ success: false, message: "Database error checking signature." });
                    }
                    if (existingSig && existingSig.length > 0) {
                        return res.json({ success: false, message: "You have already signed this document." });
                    }

                    // Resolve source PDF
                    const srcRelative = doc.signed_file_path || doc.file_path;
                    if (!srcRelative) {
                        return res.json({ success: false, message: "No PDF file attached to this document." });
                    }
                    const cleanRelative = String(srcRelative).replace(/^\/uploads\//, "uploads/").replace(/^\//, "");
                    const sourcePath = path.join(__dirname, cleanRelative);

                    if (!fs.existsSync(sourcePath)) {
                        return res.json({ success: false, message: "Source document PDF was not found on the server." });
                    }

                    // Resolve signature buffer
                    let signatureBuffer = null;
                    try {
                        if (signatureType === "saved" && student.digital_signature) {
                            const localSigPath = path.join(__dirname, student.digital_signature.replace(/^\//, ""));
                            if (fs.existsSync(localSigPath)) {
                                signatureBuffer = fs.readFileSync(localSigPath);
                            }
                        }
                        if (!signatureBuffer && typeof signatureImage === "string") {
                            if (signatureImage.startsWith("data:")) {
                                signatureBuffer = decodeSignatureImageData(signatureImage);
                            } else if (signatureImage.includes("/uploads/")) {
                                const relSig = "uploads/" + signatureImage.split("/uploads/")[1];
                                const localPath = path.join(__dirname, relSig);
                                if (fs.existsSync(localPath)) {
                                    signatureBuffer = fs.readFileSync(localPath);
                                }
                            }
                        }
                    } catch (sigErr) {
                        console.error("Error reading signature image:", sigErr);
                    }

                    if (!signatureBuffer || signatureBuffer.length === 0) {
                        return res.json({ success: false, message: "Invalid signature image. Please sign again." });
                    }

                    // Embed signature on PDF
                    try {
                        const signedBytes = await embedSignatureOnPdfFile(sourcePath, signatureBuffer, placement);
                        const signedDir = path.join(__dirname, "uploads", "signed_documents");
                        if (!fs.existsSync(signedDir)) {
                            fs.mkdirSync(signedDir, { recursive: true });
                        }
                        const newFileName = `env_scan_signed_${documentId}_${Date.now()}.pdf`;
                        const destPath = path.join(signedDir, newFileName);
                        fs.writeFileSync(destPath, signedBytes);
                        const newSignedFilePath = `/uploads/signed_documents/${newFileName}`;

                        // Update student_documents with new signed_file_path
                        db.query("UPDATE student_documents SET signed_file_path = ? WHERE id = ?", [newSignedFilePath, documentId], (errUp) => {
                            if (errUp) console.error("Error updating signed_file_path on student_documents:", errUp);

                            // Insert into env_scan_student_signatures
                            const insertSigSql = `
                                INSERT INTO env_scan_student_signatures
                                (document_id, student_user_id, student_name, student_position, signed_file_path)
                                VALUES (?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE signed_file_path = VALUES(signed_file_path), signed_at = CURRENT_TIMESTAMP
                            `;
                            db.query(insertSigSql, [documentId, studentUserId, student.fullname, studentPos, newSignedFilePath], (errIns) => {
                                if (errIns) {
                                    console.error("Error inserting into env_scan_student_signatures:", errIns);
                                    return res.json({ success: false, message: "Failed to record signature in database." });
                                }

                                // Check if all active members signed
                                const checkAllMembersSql = `
                                    SELECT u.user_id, COALESCE(u.student_status, 'ACTIVE') AS student_status
                                    FROM group_members gm
                                    JOIN users u ON gm.student_id = u.id
                                    WHERE gm.group_id = ?
                                `;
                                db.query(checkAllMembersSql, [doc.group_id], (errMems, allMems) => {
                                    const activeList = (allMems || []).filter(m => m.student_status === "ACTIVE");
                                    db.query("SELECT student_user_id FROM env_scan_student_signatures WHERE document_id = ?", [documentId], (errSigs, allSigs) => {
                                        const signedSet = new Set((allSigs || []).map(s => s.student_user_id));
                                        const allSigned = activeList.length > 0 && activeList.every(m => signedSet.has(m.user_id));

                                        if (allSigned) {
                                            db.query("UPDATE student_documents SET document_status = 'Students Signed' WHERE id = ?", [documentId], () => {});
                                        }

                                        return res.json({
                                            success: true,
                                            all_signed: allSigned,
                                            signed_file_path: newSignedFilePath,
                                            message: allSigned
                                                ? "Signature applied! All group members have signed. Document is ready to send."
                                                : "Signature applied! Waiting for remaining group members."
                                        });
                                    });
                                });
                            });
                        });
                    } catch (embedErr) {
                        console.error("Error embedding signature on PDF:", embedErr);
                        return res.json({ success: false, message: "Failed to stamp signature onto PDF." });
                    }
                });
            });
        });
    });
});

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

        const storedPwd = String(user.password || "");
        const isBcrypt = storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$");
        const verifyPromise = isBcrypt
            ? bcrypt.compare(String(currentPassword), storedPwd)
            : Promise.resolve(storedPwd === String(currentPassword));

        verifyPromise.then(async (isMatch) => {
        if(!isMatch){

            return res.json({
                success:false,
                message:"Current password is incorrect."
            });

        }

        const hashedNewPassword = await bcrypt.hash(String(newPassword), 10);

        const updateSql = `
            UPDATE users
            SET
                password = ?,
                force_password_change = 0
            WHERE user_id = ?
        `;

        db.query(updateSql, [hashedNewPassword, userId], (err) => {

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
        }).catch((errHash) => {
            console.error(errHash);
            res.json({
                success:false,
                message:"Failed to update password."
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

/* ── Consultation document upload ─────────────────────────────────────── */
const consultationDocStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = path.join(__dirname, "uploads", "consultation_documents");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const consultationUpload = multer({
    storage: consultationDocStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        if (file.mimetype === "application/pdf") cb(null, true);
        else cb(new Error("Only PDF files are allowed for consultation documents."), false);
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
                SELECT u.id AS faculty_id, u.fullname AS faculty_name, u.user_id AS faculty_user_id, COALESCE(u.consultation_available, 1) AS consultation_available, 'Adviser' AS assigned_role
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
                SELECT id AS faculty_id, fullname AS faculty_name, user_id AS faculty_user_id, COALESCE(consultation_available, 1) AS consultation_available, 'Instructor' AS assigned_role
                FROM users
                WHERE user_id = ? AND role IN ('faculty', 'admin')
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

app.post("/student-consultations", (req, res, next) => {
    consultationUpload.single("consultationFile")(req, res, (uploadErr) => {
        if (uploadErr) {
            return res.status(400).json({ success: false, message: uploadErr.message || "File upload error." });
        }
        next();
    });
}, (req, res) => {
    const { studentUserId, assignedFacultyId, consultationType, topic, concernMessage } = req.body;
    const uploadedFile = req.file || null;
    const filePath  = uploadedFile ? `/uploads/consultation_documents/${uploadedFile.filename}` : null;
    const fileName  = uploadedFile ? uploadedFile.originalname : null;

    if (!studentUserId || !assignedFacultyId || !consultationType || !concernMessage) {
        return res.json({ success: false, message: "Missing required fields." });
    }

    db.query("SELECT fullname, COALESCE(consultation_available, 1) AS consultation_available FROM users WHERE id = ? LIMIT 1", [assignedFacultyId], (availErr, availRows) => {
        if (availErr) {
            console.error(availErr);
            return res.json({ success: false, message: "Database error while checking faculty availability." });
        }
        if (availRows && availRows.length > 0 && Number(availRows[0].consultation_available) === 0) {
            return res.json({
                success: false,
                message: `${availRows[0].fullname} is currently unavailable and not accepting new consultation requests.`
            });
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
                        (consultation_code, student_id, group_id, assigned_faculty_id, assigned_role, consultation_type, topic, concern_message, file_path, file_name, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
                    `;
                    const insertParams = [
                        consultationCode,
                        studentDbId,
                        groupDbId,
                        assignedFacultyId,
                        assignedRole,
                        consultationType,
                        topic || null,
                        concernMessage,
                        filePath,
                        fileName
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
});

app.get("/student-consultations/:userId", (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.json({ success: false, message: "Missing userId" });
    }

    const sql = `
        SELECT c.id, c.consultation_code, c.consultation_type, c.topic, c.concern_message, c.status,
               c.decline_reason, c.declined_at, c.schedule_notes,
               DATE_FORMAT(c.scheduled_date, '%Y-%m-%d') AS scheduled_date,
               c.scheduled_start_time, c.scheduled_end_time, c.consultation_mode, c.location_or_link,
               c.created_at, c.file_path, c.file_name, u.fullname AS faculty_name, c.assigned_role
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
               c.decline_reason, c.declined_at,
               DATE_FORMAT(c.scheduled_date, '%Y-%m-%d') AS scheduled_date,
               c.scheduled_start_time, c.scheduled_end_time, c.consultation_mode, c.location_or_link,
               c.schedule_notes, c.created_at, c.file_path, c.file_name,
               s.fullname AS student_name, s.user_id AS student_user_id
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
        db.query("SELECT COALESCE(consultation_available, 1) AS consultation_available FROM users WHERE user_id = ? LIMIT 1", [facultyUserId], (availErr, availRows) => {
            const consultationAvailable = (!availErr && availRows && availRows.length > 0)
                ? Number(availRows[0].consultation_available) === 1
                : true;
            res.json({ success: true, consultations: results, consultationAvailable });
        });
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

app.put("/api/consultations/:id/decline", (req, res) => {
    const id = req.params.id;
    const { facultyUserId, reason, customNote } = req.body;

    if (!id) {
        return res.json({ success: false, message: "Missing consultation ID." });
    }

    const baseReason = String(reason || "").trim();
    const extraNote = String(customNote || "").trim();
    const finalReason = baseReason && extraNote
        ? `${baseReason} — ${extraNote}`
        : (baseReason || extraNote || "No specific reason provided.");

    const lookupSql = `
        SELECT c.id, c.student_id, c.consultation_code, c.created_at, c.scheduled_date,
               f.fullname AS faculty_name, f.user_id AS faculty_user_id
        FROM consultations c
        JOIN users f ON c.assigned_faculty_id = f.id
        WHERE c.id = ?
        LIMIT 1
    `;

    db.query(lookupSql, [id], (lookupErr, rows) => {
        if (lookupErr) {
            console.error("Decline lookup error:", lookupErr);
            return res.json({ success: false, message: "Database error." });
        }
        if (!rows || rows.length === 0) {
            return res.json({ success: false, message: "Consultation request not found." });
        }

        const item = rows[0];
        if (facultyUserId && String(item.faculty_user_id) !== String(facultyUserId)) {
            return res.json({ success: false, message: "You are not authorized to decline this request." });
        }

        const updateSql = `
            UPDATE consultations
            SET status = 'Declined',
                decline_reason = ?,
                declined_at = NOW()
            WHERE id = ?
        `;

        db.query(updateSql, [finalReason, id], (updErr) => {
            if (updErr) {
                console.error("Decline update error:", updErr);
                return res.json({ success: false, message: "Failed to decline consultation request." });
            }

            const dateSource = item.scheduled_date || item.created_at || new Date();
            const formattedDate = new Date(dateSource).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
            });

            if (item.student_id) {
                const notifSql = `
                    INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                    VALUES (?, 'Consultation Request Declined', ?, 'Consultation')
                `;
                const notifMsg = `Your consultation request on ${formattedDate} was declined by ${item.faculty_name}. Reason: ${finalReason}`;
                db.query(notifSql, [item.student_id, notifMsg], (notifErr) => {
                    if (notifErr) console.error("Student decline notification error:", notifErr);
                });
            }

            res.json({
                success: true,
                message: "Consultation request declined and student notified.",
                decline_reason: finalReason
            });
        });
    });
});

app.put("/api/faculty/consultation-availability", (req, res) => {
    const { facultyUserId, available } = req.body;
    if (!facultyUserId) {
        return res.json({ success: false, message: "Missing facultyUserId." });
    }

    const flag = (available === true || available === 1 || available === "1" || available === "true") ? 1 : 0;
    db.query(
        "UPDATE users SET consultation_available = ? WHERE user_id = ?",
        [flag, facultyUserId],
        (err) => {
            if (err) {
                console.error("Availability update error:", err);
                return res.json({ success: false, message: "Failed to update consultation availability." });
            }
            res.json({
                success: true,
                consultation_available: flag === 1,
                message: flag === 1
                    ? "You are now accepting consultation requests."
                    : "Consultations paused (marked as Unavailable)."
            });
        }
    );
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
          AND c.status NOT IN ('Cancelled', 'Declined')
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


/* ================= DEFENSE MINUTES PICTURE UPLOAD & APPROVAL ================= */

const defenseMinutesStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = path.join(__dirname, "uploads", "defense_minutes");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const defenseMinutesUpload = multer({
    storage: defenseMinutesStorage,
    fileFilter: function(req, file, cb) {
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        const ext = path.extname(file.originalname || "").toLowerCase();
        const allowedExt = [".jpg", ".jpeg", ".png", ".webp"];
        if (!allowedTypes.includes(file.mimetype) && !allowedExt.includes(ext)) {
            return cb(new Error("Only JPG, PNG, and WEBP image files are allowed."));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

app.post(
    "/upload-defense-minutes-picture",
    defenseMinutesUpload.single("documentFile"),
    (req, res) => {
        const { studentUserId, documentType, documentTitle } = req.body;

        if (!studentUserId || !documentType || !documentTitle || !req.file) {
            return res.json({ success: false, message: "Missing required fields or file." });
        }

        const groupSql = `
            SELECT cg.id AS group_db_id, u.id AS uploaded_by
            FROM group_members gm
            JOIN capstone_groups cg ON gm.group_id = cg.id
            JOIN users u ON gm.student_id = u.id
            WHERE u.user_id = ?
            LIMIT 1
        `;

        db.query(groupSql, [studentUserId], (err, groupResult) => {
            if (err || !groupResult || groupResult.length === 0) {
                return res.json({ success: false, message: "Student group not found." });
            }

            const groupDbId  = groupResult[0].group_db_id;
            const uploadedBy = groupResult[0].uploaded_by;
            const filePath   = "/uploads/defense_minutes/" + req.file.filename;
            const fileFormat = path.extname(req.file.originalname).replace(".", "").toUpperCase();

            /* Check maximum 5 pictures for defense minutes */
            const checkLimitSql = `
                SELECT COUNT(*) AS total
                FROM student_documents
                WHERE group_id = ? AND document_type = ?
            `;
            db.query(checkLimitSql, [groupDbId, documentType], (errLim, limResult) => {
                if (!errLim && limResult && limResult[0].total >= 5) {
                    if (req.file && req.file.path) {
                        try { fs.unlinkSync(req.file.path); } catch (e) {}
                    }
                    return res.json({ success: false, message: "Maximum of 5 defense minutes photos already uploaded." });
                }

                /* Generate next document code */
                const lastDocSql = `
                    SELECT document_code FROM student_documents
                    WHERE document_code LIKE 'DOC2026-%'
                    ORDER BY CAST(SUBSTRING_INDEX(document_code, '-', -1) AS UNSIGNED) DESC
                    LIMIT 1
                `;

                db.query(lastDocSql, (err2, lastResult) => {
                    if (err2) {
                        return res.json({ success: false, message: "Failed to generate document code." });
                    }

                    let nextNumber = 1;
                    if (lastResult && lastResult.length > 0) {
                        nextNumber = parseInt(lastResult[0].document_code.split("-")[1], 10) + 1;
                    }
                    const documentCode = `DOC2026-${String(nextNumber).padStart(4, "0")}`;

                    /* Always INSERT a new row (each picture is a separate record) */
                    const insertSql = `
                        INSERT INTO student_documents
                            (document_code, group_id, uploaded_by, document_type, document_title,
                             file_name, file_path, file_format, document_status, is_sent)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Uploaded', 0)
                    `;

                    db.query(
                        insertSql,
                        [documentCode, groupDbId, uploadedBy, documentType, documentTitle,
                         req.file.originalname, filePath, fileFormat],
                        (err3) => {
                            if (err3) {
                                console.error(err3);
                                return res.json({ success: false, message: "Failed to save picture record." });
                            }
                            return res.json({ success: true, message: "Picture uploaded successfully." });
                        }
                    );
                });
            });
        });
    }
);

/* ================= SEND DEFENSE MINUTES PICTURES TO ADVISER ================= */

app.post("/send-defense-minutes-pictures", (req, res) => {
    const { studentUserId, docType, adviserUserId } = req.body;

    if (!studentUserId || !docType || !adviserUserId) {
        return res.json({ success: false, message: "Missing required fields." });
    }

    const groupSql = `
        SELECT cg.id AS group_db_id
        FROM group_members gm
        JOIN capstone_groups cg ON gm.group_id = cg.id
        JOIN users u ON gm.student_id = u.id
        WHERE u.user_id = ?
        LIMIT 1
    `;

    db.query(groupSql, [studentUserId], (err, groupResult) => {
        if (err || !groupResult || groupResult.length === 0) {
            return res.json({ success: false, message: "Student group not found." });
        }

        const groupDbId = groupResult[0].group_db_id;

        const countSql = `
            SELECT COUNT(*) AS pic_count
            FROM student_documents
            WHERE group_id = ? AND document_type = ?
        `;

        db.query(countSql, [groupDbId, docType], (err2, countResult) => {
            if (err2) {
                return res.json({ success: false, message: "Database error." });
            }

            const picCount = countResult[0].pic_count;
            if (picCount < 1) {
                return res.json({ success: false, message: "Please upload at least 1 defense minutes photo before sending." });
            }
            if (picCount > 5) {
                return res.json({ success: false, message: `Maximum of 5 photos allowed. Currently: ${picCount}` });
            }

            const updateSql = `
                UPDATE student_documents
                SET is_sent = 1,
                    submission_count = COALESCE(submission_count, 0) + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE group_id = ? AND document_type = ?
            `;

            db.query(updateSql, [groupDbId, docType], (err3) => {
                if (err3) {
                    return res.json({ success: false, message: "Failed to mark pictures as sent." });
                }

                const adviserSql = `SELECT id FROM users WHERE user_id = ? OR id = ? LIMIT 1`;
                db.query(adviserSql, [adviserUserId, adviserUserId], (err4, adviserResult) => {
                    if (!err4 && adviserResult && adviserResult.length > 0) {
                        const adviserDbId = adviserResult[0].id;
                        const notifSql = `
                            INSERT INTO user_notifications (user_id, notification_title, notification_message, notification_type)
                            VALUES (?, ?, ?, ?)
                        `;
                        db.query(notifSql, [
                            adviserDbId,
                            "Defense Minutes Photos Submitted",
                            `A student group has submitted ${picCount} defense minutes photo(s) (${docType}) for your review and approval.`,
                            "Document Review"
                        ], () => {});
                    }
                });

                return res.json({ success: true, message: `${picCount} defense minutes photo(s) sent to adviser for approval.` });
            });
        });
    });
});

/* ================= ADVISER APPROVE DEFENSE MINUTES PICTURES ================= */

app.put("/approve-defense-minutes-pictures", (req, res) => {
    const { adviserUserId, groupId, docType, reviewStatus, reviewComment } = req.body;

    if (!adviserUserId || !groupId || !docType) {
        return res.json({ success: false, message: "Missing required fields." });
    }

    const checkSql = `
        SELECT cg.id AS group_db_id, cg.group_name, u.fullname AS adviser_name
        FROM capstone_groups cg
        JOIN users u ON cg.adviser_id = u.id
        WHERE (cg.group_id = ? OR cg.id = ?) AND (u.user_id = ? OR u.id = ?)
        LIMIT 1
    `;

    db.query(checkSql, [groupId, groupId, adviserUserId, adviserUserId], (err, result) => {
        if (err || !result || result.length === 0) {
            return res.json({ success: false, message: "Not authorized to approve this group's defense minutes." });
        }

        const groupDbId = result[0].group_db_id;
        const adviserName = result[0].adviser_name || "Adviser";
        const isRevision = reviewStatus === "Subject to Change" || reviewStatus === "Rejected";
        const targetStatus = isRevision ? reviewStatus : "Approved";
        const nextIsSent = isRevision ? 0 : 1;

        const updateSql = `
            UPDATE student_documents
            SET document_status = ?,
                is_sent = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE group_id = ? AND document_type = ?
        `;

        db.query(updateSql, [targetStatus, nextIsSent, groupDbId, docType], (err2) => {
            if (err2) {
                return res.json({ success: false, message: "Failed to update defense minutes status." });
            }

            /* Notify group members */
            db.query(`SELECT student_id FROM group_members WHERE group_id = ?`, [groupDbId], (mErr, members) => {
                if (!mErr && members && members.length > 0) {
                    const title = isRevision ? "Defense Minutes Photos Returned" : "Defense Minutes Photos Approved";
                    const msg = isRevision
                        ? `${adviserName} requested updated photos for "${docType}". Reason: ${reviewComment || "Please upload clearer photos."}`
                        : `${adviserName} approved your defense minutes photos for "${docType}".`;
                    insertUserNotificationsByDbIds(
                        members.map(m => m.student_id),
                        title,
                        msg,
                        "Document Review"
                    );
                }
            });

            return res.json({
                success: true,
                message: isRevision
                    ? "Requested new defense minutes photos from the group."
                    : "Defense minutes photos approved successfully."
            });
        });
    });
});

/* ================= ADVISER LOAD DEFENSE MINUTES PICTURES ================= */

app.get("/adviser-defense-minutes/:adviserUserId", (req, res) => {
    const adviserUserId = req.params.adviserUserId;

    const groupsSql = `
        SELECT
            cg.id AS group_db_id,
            cg.group_id,
            cg.group_name,
            cg.project_title,
            cg.program
        FROM capstone_groups cg
        JOIN users u ON cg.adviser_id = u.id
        WHERE u.user_id = ? OR u.id = ?
    `;

    db.query(groupsSql, [adviserUserId, adviserUserId], (err, groups) => {
        if (err) {
            return res.json({ success: false, message: "Database error." });
        }

        if (!groups || groups.length === 0) {
            return res.json({ success: true, defenseMinutesList: [] });
        }

        const groupDbIds = groups.map(g => g.group_db_id);

        const picSql = `
            SELECT sd.*, cg.group_id, cg.group_name, cg.project_title, cg.program
            FROM student_documents sd
            JOIN capstone_groups cg ON sd.group_id = cg.id
            WHERE sd.group_id IN (?)
            AND sd.document_type LIKE '% • Defense minutes'
            ORDER BY sd.group_id, sd.document_type, sd.id ASC
        `;

        db.query(picSql, [groupDbIds], (err2, pictures) => {
            if (err2) {
                return res.json({ success: false, message: "Database error." });
            }

            const grouped = {};
            (pictures || []).forEach(pic => {
                const key = `${pic.group_id}||${pic.document_type}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        group_id: pic.group_id,
                        group_db_id: pic.group_id,
                        group_name: pic.group_name,
                        project_title: pic.project_title,
                        program: pic.program,
                        doc_type: pic.document_type,
                        pictures: [],
                        is_approved: false,
                        is_sent: false
                    };
                }
                grouped[key].pictures.push(pic);
                if (String(pic.document_status || "") === "Approved") {
                    grouped[key].is_approved = true;
                }
                if (Number(pic.is_sent) === 1 || Number(pic.submission_count || 0) > 0) {
                    grouped[key].is_sent = true;
                }
            });

            return res.json({
                success: true,
                defenseMinutesList: Object.values(grouped)
            });
        });
    });
});

/* ================= SERVER ================= */

const PORT = Number(process.env.PORT) || 3005;
app.listen(PORT, '0.0.0.0', () => {
    console.log("Server running on port 3005");
    console.log("[HF-CHECK] Loading @huggingface/transformers model: Xenova/all-MiniLM-L6-v2...");
    semEngine.loadModel().then(() => {
        console.log("[HF-CHECK] Using @huggingface/transformers model: Xenova/all-MiniLM-L6-v2 (READY - Semantic similarity active)");
    }).catch(err => {
        console.error("[HF-CHECK] Failed to initialize model:", err);
    });
    runConsultationStatusSync(); /* Run once on startup */
});