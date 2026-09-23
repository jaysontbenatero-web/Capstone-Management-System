const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'capstone123',
    database: 'capx_db',
    port: 3307
});

db.connect((err) => {
    if (err) { console.log('DB ERROR:', err.message); process.exit(1); }

    const sql = `
        SELECT 
            id,
            document_code,
            document_title,
            document_type,
            document_status,
            IFNULL(signed_file_path, 'NULL -- not set') AS signed_file_path,
            file_path
        FROM student_documents
        WHERE LOWER(document_type) LIKE '%adviser acceptance%'
           OR LOWER(document_title) LIKE '%adviser acceptance%'
           OR LOWER(document_type) LIKE '%acceptance for advisory%'
           OR LOWER(document_title) LIKE '%acceptance for advisory%'
        ORDER BY id DESC
        LIMIT 10
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.log('QUERY ERROR:', err.message);
        } else if (rows.length === 0) {
            console.log('No adviser acceptance documents found in the database.');
        } else {
            console.log('\n=== ADVISER ACCEPTANCE DOCUMENTS ===');
            rows.forEach(r => {
                console.log('---');
                console.log('  ID             :', r.id);
                console.log('  Code           :', r.document_code);
                console.log('  Title          :', r.document_title);
                console.log('  Status         :', r.document_status);
                console.log('  signed_file_path:', r.signed_file_path);
                console.log('  file_path      :', r.file_path);
            });
        }
        db.end();
    });
});
