(function () {
    function esc(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function getImgBasePath() {
        const p = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
        if (p.includes("/faculty/adviser/") || p.includes("/faculty/panelist/") || p.includes("/faculty/instructor/")) {
            return "../../Images/dnsc";
        }
        if (p.includes("/student/") || p.includes("/admin/") || p.includes("/faculty/")) {
            return "../Images/dnsc";
        }
        return "Images/dnsc";
    }

    function buildHeaderHtml(imgBase) {
        return `
            <div class="dm-page-header-wrap">
                <div class="dm-dnsc-header">
                    <div class="dm-dnsc-header-left">
                        <img src="${imgBase}/dnsc_logo.png" alt="DNSC Seal" class="dm-dnsc-seal">
                        <div>
                            <div class="dm-dnsc-name">DAVAO DEL NORTE<br>STATE COLLEGE</div>
                            <div class="dm-dnsc-motto">"Inspiring Change, Creating Futures"</div>
                        </div>
                    </div>
                    <div class="dm-dnsc-header-right">
                        <div>president@dnsc.edu.ph <img src="${imgBase}/icon_email.png" alt="" class="dm-dnsc-icon"></div>
                        <div>dnsc.edu.ph <img src="${imgBase}/icon_web.png" alt="" class="dm-dnsc-icon"></div>
                        <div>@officialdnsc <img src="${imgBase}/icon_fb.png" alt="" class="dm-dnsc-icon"></div>
                        <div>New Visayas, Panabo City, 8105</div>
                    </div>
                </div>
                <div class="dm-institute-bar">Institute of Computing</div>
            </div>
        `;
    }

    function buildFooterHtml(imgBase) {
        return `
            <div class="dm-dnsc-footer">
                <div class="dm-footer-vmc">
                    <div class="dm-vmc-col">
                        <div class="dm-vmc-title">VISION</div>
                        <div class="dm-vmc-text">An institution leading in agri-fisheries and socio-cultural development in the ASEAN region.</div>
                    </div>
                    <div class="dm-vmc-col">
                        <div class="dm-vmc-title">MISSION</div>
                        <div class="dm-vmc-text">DNSC shall produce future-ready workforce, create innovative solutions and technologies, empower communities, and uphold good governance towards sustainable development.</div>
                    </div>
                    <div class="dm-vmc-col">
                        <div class="dm-vmc-title">CORE VALUES</div>
                        <div class="dm-vmc-text">Stewardship<br>Adaptability and Excellence<br>Integrity and Innovativeness<br>Love of God and Country</div>
                    </div>
                </div>
                <div class="dm-footer-logos">
                    <img src="${imgBase}/bagong_pilipinas.png" alt="Bagong Pilipinas">
                    <img src="${imgBase}/iso_w3.png" alt="ISO 9001:2015">
                </div>
            </div>
        `;
    }

    function formatBullets(text) {
        const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return "&nbsp;";
        return lines.map(l => `<div class="dm-bullet-item">${esc(l)}</div>`).join("");
    }

    function estimateRowHeight(row) {
        const commLines = Math.max(2, String(row.comments || "").split(/\r?\n/).reduce((sum, l) => sum + Math.max(1, Math.ceil(l.length / 36)), 0));
        const actLines = Math.max(2, String(row.actions || "").split(/\r?\n/).reduce((sum, l) => sum + Math.max(1, Math.ceil(l.length / 36)), 0));
        return Math.max(64, Math.max(commLines, actLines) * 15 + 24);
    }

    function renderPlacedSignaturesForPage(pageIndex, placedSignatures) {
        return (placedSignatures || [])
            .filter(sig => sig && sig.signatureImage && Number(sig.pageIndex || 0) === Number(pageIndex))
            .map(sig => `
                <div class="dm-placed-sig-box" style="left:${Number(sig.xPct || 8)}%; top:${Number(sig.yPct || 70)}%; width:${Number(sig.widthPct || 20)}%;">
                    <img src="${esc(sig.signatureImage)}" alt="Signature">
                    ${sig.dateSigned ? `<div class="dm-placed-sig-date">${esc(sig.dateSigned)}</div>` : ""}
                </div>
            `).join("");
    }

    function findMatchingPanelistSig(panelName, placedSignatures) {
        const target = String(panelName || "").trim().toLowerCase();
        if (!target) return null;
        return (placedSignatures || []).find(sig => {
            if (!sig || !sig.signatureImage || sig.adviserId) return false;
            const by = String(sig.signedBy || sig.panelistName || "").trim().toLowerCase();
            return by && (by === target || target.includes(by) || by.includes(target));
        }) || null;
    }

    function findAdviserSig(placedSignatures) {
        return (placedSignatures || []).find(sig => sig && sig.signatureImage && sig.adviserId) || null;
    }

    /**
     * Renders multi-page A4 Defense Minutes into containerEl.
     * Options: { minutesData, placedSignatures }
     * Returns { pageCount, pageElements }
     */
    function renderDefenseMinutesPages(containerEl, options) {
        const opts = options || {};
        const data = opts.minutesData || {};
        const meta = data.meta || {};
        const panelists = Array.isArray(data.panelists) ? data.panelists : [];
        const placedSignatures = Array.isArray(opts.placedSignatures) ? opts.placedSignatures : [];
        const imgBase = opts.imgBasePath || getImgBasePath();
        const adviserSig = findAdviserSig(placedSignatures);

        const members = Array.isArray(meta.members) ? meta.members : [];
        const membersHtml = members.length
            ? members.map((m, i) => `
                <div class="dm-member-row">
                    <span class="dm-member-label">${i === 0 ? "Members:" : ""}</span>
                    <span class="dm-member-name">${esc(m)}</span>
                </div>
              `).join("")
            : `<div class="dm-member-row"><span class="dm-member-label">Members:</span><span class="dm-member-name">N/A</span></div>`;

        const page1TopHtml = `
            <div class="dm-doc-title">[${esc(meta.phaseTag || "OUTLINE")}] DEFENSE MINUTES</div>
            <div class="dm-meta-block">
                <div class="dm-meta-line"><strong>Title:</strong> ${esc(meta.title || "Not Set")}</div>
                <div class="dm-meta-split">
                    <div><strong>Program:</strong> ${esc(meta.program || "BSIS")}</div>
                    <div><strong>Date of Defense:</strong> ${esc(meta.defenseDate || "TBA")}</div>
                </div>
                <div class="dm-members-block">${membersHtml}</div>
            </div>
        `;

        const adviserBlockHtml = `
            <div class="dm-adviser-signoff">
                ${adviserSig
                    ? `<div class="dm-anchored-sig-wrap"><img src="${esc(adviserSig.signatureImage)}" alt="Adviser Signature" class="dm-anchored-sig-img"></div>`
                    : `<div class="dm-adviser-sig-space"></div>`}
                <div class="dm-adviser-name">${esc(meta.adviserName || "ADVISER")}</div>
                <div class="dm-adviser-role">Adviser</div>
                <div class="dm-adviser-date">Date Signed: ${adviserSig && adviserSig.dateSigned ? `<span class="dm-anchored-date">${esc(adviserSig.dateSigned)}</span>` : ""}</div>
            </div>
        `;

        const PAGE1_BUDGET = 610;
        const PAGEX_BUDGET = 790;
        const ADVISER_HEIGHT = 115;

        const pages = [{ items: [], usedHeight: 0, budget: PAGE1_BUDGET }];
        panelists.forEach((panel, pIdx) => {
            const rows = Array.isArray(panel.rows) && panel.rows.length ? panel.rows : [{ pageNo: "", comments: "", actions: "" }];
            rows.forEach((row, rIdx) => {
                const rowH = estimateRowHeight(row);
                let currPage = pages[pages.length - 1];
                if (currPage.items.length > 0 && currPage.usedHeight + rowH > currPage.budget) {
                    pages.push({ items: [], usedHeight: 0, budget: PAGEX_BUDGET });
                    currPage = pages[pages.length - 1];
                }
                currPage.items.push({ pIdx, rIdx, panel, row, isFirstOfPanelInTotal: rIdx === 0 });
                currPage.usedHeight += rowH;
            });
        });

        let adviserOnSeparatePage = false;
        const lastPage = pages[pages.length - 1];
        if (lastPage.usedHeight + ADVISER_HEIGHT > lastPage.budget) {
            adviserOnSeparatePage = true;
        }

        const totalPages = pages.length + (adviserOnSeparatePage ? 1 : 0);

        let html = pages.map((page, pageIdx) => {
            const pCountsOnPage = new Map();
            page.items.forEach(it => pCountsOnPage.set(it.pIdx, (pCountsOnPage.get(it.pIdx) || 0) + 1));
            const seenPanelOnPage = new Set();

            const rowsHtml = page.items.map(it => {
                let panelistCell = "";
                if (!seenPanelOnPage.has(it.pIdx)) {
                    seenPanelOnPage.add(it.pIdx);
                    const span = pCountsOnPage.get(it.pIdx);
                    const pSig = findMatchingPanelistSig(it.panel.name, placedSignatures);
                    panelistCell = `
                        <td rowspan="${span}" class="dm-panelist-cell">
                            ${it.isFirstOfPanelInTotal ? `
                                <div class="dm-panelist-name">${esc(it.panel.name)}</div>
                                <div class="dm-panelist-role">${esc(it.panel.role)}</div>
                                ${pSig ? `<div class="dm-anchored-sig-wrap dm-anchored-sig-center"><img src="${esc(pSig.signatureImage)}" alt="Panelist Signature" class="dm-anchored-sig-img"></div>` : ""}
                                <div class="dm-panelist-sig">Signature:</div>
                                <div class="dm-panelist-date">Date Signed: ${pSig && pSig.dateSigned ? `<span class="dm-anchored-date">${esc(pSig.dateSigned)}</span>` : ""}</div>
                            ` : `<div class="dm-panelist-cont">${esc(it.panel.name)} <span style="font-weight:400;">(cont.)</span></div>`}
                        </td>
                    `;
                }
                return `
                    <tr>
                        ${panelistCell}
                        <td class="dm-page-cell">${esc(it.row.pageNo || "")}</td>
                        <td class="dm-text-cell">${formatBullets(it.row.comments)}</td>
                        <td class="dm-text-cell">${formatBullets(it.row.actions)}</td>
                    </tr>
                `;
            }).join("");

            const isLast = pageIdx === pages.length - 1;
            return `
                <div class="dm-a4-page" data-dm-page="${pageIdx}">
                    <div class="dm-a4-page-inner">
                        ${buildHeaderHtml(imgBase)}
                        <div class="dm-a4-page-body">
                            ${pageIdx === 0 ? page1TopHtml : ""}
                            <table class="dm-minutes-table">
                                ${pageIdx === 0 ? `
                                    <thead>
                                        <tr>
                                            <th style="width:22%;">Panelists</th>
                                            <th style="width:10%;">Page No.</th>
                                            <th style="width:34%;">Comments/Suggestions/Recommendations</th>
                                            <th style="width:34%;">Action/s Taken</th>
                                        </tr>
                                    </thead>
                                ` : ""}
                                <tbody>${rowsHtml}</tbody>
                            </table>
                            ${(isLast && !adviserOnSeparatePage) ? adviserBlockHtml : ""}
                        </div>
                    </div>
                    ${buildFooterHtml(imgBase)}
                </div>
            `;
        }).join("");

        if (adviserOnSeparatePage) {
            const advPageIdx = pages.length;
            html += `
                <div class="dm-a4-page" data-dm-page="${advPageIdx}">
                    <div class="dm-a4-page-inner">
                        ${buildHeaderHtml(imgBase)}
                        <div class="dm-a4-page-body">${adviserBlockHtml}</div>
                    </div>
                    ${buildFooterHtml(imgBase)}
                </div>
            `;
        }

        containerEl.innerHTML = html;
        return {
            pageCount: totalPages,
            pageElements: Array.from(containerEl.querySelectorAll(".dm-a4-page"))
        };
    }

    /**
     * Attaches a draggable e-signature + date box to a specific .dm-a4-page element.
     * dragState: { pageIndex, xPct, yPct, widthPct, signatureImage, dateSigned, label }
     */
    function mountDraggableSignature(containerEl, dragState) {
        containerEl.querySelectorAll(".dm-draggable-sig-box").forEach(el => el.remove());
        if (!dragState || !dragState.signatureImage) return;

        const pages = containerEl.querySelectorAll(".dm-a4-page");
        const targetIdx = Math.max(0, Math.min(pages.length - 1, Number(dragState.pageIndex || 0)));
        dragState.pageIndex = targetIdx;
        const pageEl = pages[targetIdx];
        if (!pageEl) return;

        const box = document.createElement("div");
        box.className = "dm-draggable-sig-box";
        box.style.left = `${dragState.xPct}%`;
        box.style.top = `${dragState.yPct}%`;
        box.style.width = `${dragState.widthPct || 20}%`;
        box.innerHTML = `
            <span class="dm-draggable-sig-tag">${esc(dragState.label || "Drag to position")}</span>
            <img src="${esc(dragState.signatureImage)}" alt="Your E-Signature">
            <div class="dm-draggable-sig-date">${esc(dragState.dateSigned || "")}</div>
        `;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initLeftPct = Number(dragState.xPct || 8);
        let initTopPct = Number(dragState.yPct || 70);

        box.addEventListener("pointerdown", (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initLeftPct = Number(dragState.xPct || 8);
            initTopPct = Number(dragState.yPct || 70);
            box.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        box.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const rect = pageEl.getBoundingClientRect();
            const dxPct = ((e.clientX - startX) / rect.width) * 100;
            const dyPct = ((e.clientY - startY) / rect.height) * 100;
            dragState.xPct = Math.max(2, Math.min(78, initLeftPct + dxPct));
            dragState.yPct = Math.max(4, Math.min(90, initTopPct + dyPct));
            box.style.left = `${dragState.xPct}%`;
            box.style.top = `${dragState.yPct}%`;
        });

        box.addEventListener("pointerup", (e) => {
            if (!isDragging) return;
            isDragging = false;
            try { box.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        pageEl.appendChild(box);
    }

    function renderReviewNotesHtml(rec) {
        if (!rec) return `<p style="color:#94a3b8;font-size:12px;margin:0;">No notes yet.</p>`;
        const items = [];
        try {
            if (rec.adviser_signature_json) {
                const adv = JSON.parse(rec.adviser_signature_json);
                if (adv && (adv.reviewComment || adv.signedBy)) {
                    items.push({
                        who: `${adv.signedBy || "Adviser"} (Adviser)`,
                        status: "Approved",
                        comment: adv.reviewComment || ""
                    });
                }
            }
        } catch (_) {}
        try {
            if (rec.panelist_signatures_json) {
                const arr = JSON.parse(rec.panelist_signatures_json);
                if (Array.isArray(arr)) {
                    arr.forEach(p => {
                        if (p) {
                            items.push({
                                who: `${p.signedBy || "Panelist"} (Panelist)`,
                                status: p.reviewStatus || (p.signatureImage ? "Approved" : "Pending"),
                                comment: p.reviewComment || ""
                            });
                        }
                    });
                }
            }
        } catch (_) {}

        const withNotesOrStatus = items.filter(it => it.comment || it.status);
        if (!withNotesOrStatus.length) {
            return `<p style="color:#94a3b8;font-size:12px;margin:0;">No panel or adviser notes recorded yet.</p>`;
        }

        return withNotesOrStatus.map(it => {
            const st = String(it.status || "");
            const badgeStyle = st === "Approved"
                ? "background:#dcfce7;color:#15803d;"
                : (st === "Subject to Change" ? "background:#fef3c7;color:#b45309;" : (st === "Rejected" ? "background:#fee2e2;color:#dc2626;" : "background:#f1f5f9;color:#475569;"));
            return `
                <div style="background:#faf8ff;border:1px solid #ede9fe;border-radius:10px;padding:8px 10px;margin-bottom:6px;font-size:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px;">
                        <strong style="color:#2e1065;">${esc(it.who)}</strong>
                        <span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;${badgeStyle}">${esc(st)}</span>
                    </div>
                    <div style="color:#334155;line-height:1.4;">${it.comment ? esc(it.comment) : "<span style='color:#94a3b8;font-style:italic;'>No comment</span>"}</div>
                </div>
            `;
        }).join("");
    }

    window.DefenseMinutesSheet = {
        renderPages: renderDefenseMinutesPages,
        mountDraggableSignature,
        renderReviewNotesHtml
    };
})();
