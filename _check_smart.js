const mysql = require("mysql2");
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "capstone123",
    database: "capx_db",
    port: 3307
});

db.query(
    `SELECT ds.id, ds.schedule_code, cg.group_name, ds.defense_type, ds.defense_status,
        (SELECT COUNT(*) FROM defense_schedule_panelists WHERE schedule_id=ds.id) req,
        (SELECT COUNT(DISTINCT panelist_id) FROM defense_panel_evaluations WHERE schedule_id=ds.id) sub
     FROM defense_schedules ds
     JOIN capstone_groups cg ON ds.group_id=cg.id
     WHERE cg.group_name LIKE '%SmartDenture%' OR ds.schedule_code='DEF2026-1780155450530'`,
    (e, rows) => {
        console.log("schedules:", rows);
        if (!rows?.length) {
            db.end();
            return;
        }
        const ids = rows.map(r => r.id);
        db.query(
            `SELECT dpe.schedule_id, dpe.panelist_id, u.user_id, u.fullname, dpe.score, dpe.evaluated_at
             FROM defense_panel_evaluations dpe JOIN users u ON dpe.panelist_id=u.id
             WHERE dpe.schedule_id IN (?)`,
            [ids],
            (e2, evals) => {
                console.log("evaluations:", evals);
                db.query(
                    `SELECT dsp.schedule_id, dsp.panelist_id, u.user_id, u.fullname
                     FROM defense_schedule_panelists dsp JOIN users u ON dsp.panelist_id=u.id
                     WHERE dsp.schedule_id IN (?)`,
                    [ids],
                    (e3, p) => {
                        console.log("panelists:", p);
                        db.query(
                            `SELECT id, user_id, fullname, panelist_access FROM users WHERE user_id IN ('ADM2026-0001','FAC2026-0004','FAC2026-0010')`,
                            (e4, u) => {
                                console.log("users:", u);
                                db.end();
                            }
                        );
                    }
                );
            }
        );
    }
);
