async function testSubmit(panelistUserId, label) {
    const payload = {
        panelistUserId,
        score: "2.00",
        panel_result: "Passed with Revisions",
        comments: `test from ${label}`,
        recommendations: "test",
        approved_title_id: null,
        concept_evaluation_details: JSON.stringify({
            presenters: [
                { student_id: "70", fullname: "A", role: "Leader", disposition_score: 90, delivery_score: 90 }
            ],
            group_score: 88,
            signature_attached: false,
            evaluated_by: label
        })
    };

    const res = await fetch("http://localhost:3005/submit-defense-evaluation/16", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(label, data);
}

(async () => {
    await testSubmit("FAC2026-0010", "Megan");
    await testSubmit("FAC2026-0004", "Rafael");
})();
