require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require('mysql2');
const db = mysql.createConnection({host:'localhost',user:'root',password: process.env.DB_PASSWORD,database:'capx_db',port:3307});
db.query(
    "UPDATE document_submissions SET review_status = 'Pending Review' WHERE review_status IS NULL AND submission_status = 'Sent'",
    (err, r) => {
        if (err) console.log('ERROR:', err.message);
        else console.log('Fixed rows:', r.affectedRows);
        db.end();
    }
);
