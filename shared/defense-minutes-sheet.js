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
        return lines.map(l => {
            const clean = l.replace(/^[-•*]\s*/, "");
            return `<div class="dm-bullet-item">- ${esc(clean)}</div>`;
        }).join("");
    }

    function normalizePersonName(name) {
        return String(name || "")
            .toLowerCase()
            .replace(/\b(dr|engr|prof|mr|ms|mrs|sir|maam|phd|mit|msit|mscs|dit)\b\.?/g, " ")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function namesMatch(a, b) {
        const na = normalizePersonName(a);
        const nb = normalizePersonName(b);
        if (!na || !nb) return false;
        if (na === nb || na.includes(nb) || nb.includes(na)) return true;
        const ta = na.split(" ").filter(t => t.length > 1);
        const tb = nb.split(" ").filter(t => t.length > 1);
        if (ta.length >= 2 && tb.length >= 2) {
            const shared = ta.filter(t => tb.includes(t));
            if (shared.length >= 2) return true;
        }
        return false;
    }

    function estimateRowHeight(row) {
        const commLines = Math.max(2, String(row.comments || "").split(/\r?\n/).reduce((sum, l) => sum + Math.max(1, Math.ceil(l.length / 36)), 0));
        const actLines = Math.max(2, String(row.actions || "").split(/\r?\n/).reduce((sum, l) => sum + Math.max(1, Math.ceil(l.length / 36)), 0));
        return Math.max(64, Math.max(commLines, actLines) * 15 + 24);
    }

    function findMatchingPanelistSig(panel, placedSignatures, panelIdx) {
        const panelName = typeof panel === "string" ? panel : (panel && panel.name);
        const panelId = (panel && typeof panel === "object" && panel.panelistId) ? Number(panel.panelistId) : 0;
        const validSigs = (placedSignatures || []).filter(sig =>
            sig && sig.signatureImage && !sig.adviserId &&
            sig.reviewStatus !== "Subject to Change" && sig.reviewStatus !== "Rejected"
        );
        // 1. Strict panelistId match first so each panelist's signature ONLY ever appears on their own slot
        if (panelId) {
            const byPanelId = validSigs.find(sig => sig.panelistId && Number(sig.panelistId) === panelId);
            if (byPanelId) return byPanelId;
            // If this slot has an explicit panelistId, do not let a DIFFERENT panelistId's signature render here
            return validSigs.find(sig => !sig.panelistId && namesMatch(panelName, sig.signedBy || sig.panelistName || sig.targetPanelName || "")) || null;
        }
        // 2. Fallback when panel row has no panelistId: match by signer name or clicked slot
        const bySignerName = validSigs.find(sig => namesMatch(panelName, sig.signedBy || sig.panelistName || ""));
        if (bySignerName) return bySignerName;
        if (panelIdx !== undefined && panelIdx !== null) {
            const byIdx = validSigs.find(sig =>
                sig.targetPanelIndex !== undefined && sig.targetPanelIndex !== null && Number(sig.targetPanelIndex) === Number(panelIdx)
            );
            if (byIdx) return byIdx;
        }
        return validSigs.find(sig => sig.targetPanelName && namesMatch(panelName, sig.targetPanelName)) || null;
    }

    function findAdviserSig(placedSignatures) {
        return (placedSignatures || []).find(sig => sig && sig.signatureImage && sig.adviserId) || null;
    }

    const resizeObservers = new WeakMap();

    /**
     * Proportionally fits .dm-a4-page elements inside containerEl when narrower than 210mm,
     * keeping the exact A4 Student document layout intact without horizontal clipping.
     */
    function fitPagesToViewport(containerEl) {
        if (!containerEl) return;
        const wraps = containerEl.querySelectorAll(".dm-a4-scale-wrap");
        if (!wraps.length) return;
        const style = window.getComputedStyle(containerEl);
        const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        const availableW = containerEl.clientWidth - padX - 8;
        if (availableW <= 0) return;

        wraps.forEach(wrap => {
            const page = wrap.querySelector(".dm-a4-page");
            if (!page) return;
            page.style.transform = "none";
            const naturalW = page.offsetWidth || 794;
            const naturalH = page.offsetHeight || 1123;
            const scale = availableW < naturalW ? Math.max(0.45, availableW / naturalW) : 1;
            page.style.transform = scale < 1 ? `scale(${scale})` : "none";
            wrap.style.width = `${Math.round(naturalW * scale)}px`;
            wrap.style.height = `${Math.round(naturalH * scale)}px`;
        });
    }

    function observeViewportResize(containerEl) {
        if (!containerEl || typeof ResizeObserver === "undefined") return;
        if (resizeObservers.has(containerEl)) return;
        const ro = new ResizeObserver(() => fitPagesToViewport(containerEl));
        ro.observe(containerEl);
        resizeObservers.set(containerEl, ro);
    }

    /**
     * Returns a neutral starting position near the top of Page 1 so signers can
     * freely drag their e-signature to any spot on the document without auto-snapping
     * onto a specific panelist or adviser slot.
     */
    function getAnchorPosition(containerEl, role, signerName) {
        return {
            pageIndex: 0,
            xPct: 6,
            yPct: 16,
            widthPct: role === "adviser" ? 22 : 18
        };
    }

    function buildPlacedSignaturesHtmlForPage(placedSignatures, pageIdx, totalPages) {
        const list = Array.isArray(placedSignatures) ? placedSignatures : [];
        const maxIdx = Math.max(0, Number(totalPages || 1) - 1);
        return list
            .filter(sig => sig && sig.signatureImage && sig.reviewStatus !== "Subject to Change" && sig.reviewStatus !== "Rejected")
            .filter(sig => {
                const targetIdx = Math.max(0, Math.min(maxIdx, Number(sig.pageIndex || 0)));
                return targetIdx === pageIdx;
            })
            .map(sig => {
                const xPct = Number.isFinite(Number(sig.xPct)) ? Number(sig.xPct) : 6;
                const yPct = Number.isFinite(Number(sig.yPct)) ? Number(sig.yPct) : 16;
                const widthPct = Number.isFinite(Number(sig.widthPct)) ? Number(sig.widthPct) : (sig.adviserId ? 22 : 18);
                return `
                    <div class="dm-placed-sig-box" style="left:${xPct}%; top:${yPct}%; width:${widthPct}%;">
                        <img src="${esc(sig.signatureImage)}" alt="${esc(sig.signedBy || "E-Signature")}">
                        ${sig.dateSigned ? `<div class="dm-placed-sig-date">${esc(sig.dateSigned)}</div>` : ""}
                    </div>
                `;
            })
            .join("");
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
            <div class="dm-adviser-signoff" data-dm-adviser-block="1"${adviserSig ? ' data-dm-has-committed-sig="1"' : ""}>
                <div class="dm-adviser-sig-slot">
                    ${adviserSig
                        ? `<img src="${esc(adviserSig.signatureImage)}" alt="Adviser Signature" class="dm-anchored-sig-img">`
                        : ""}
                </div>
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
                    const pSig = it.isFirstOfPanelInTotal
                        ? findMatchingPanelistSig(it.panel, placedSignatures, it.pIdx)
                        : null;
                    panelistCell = `
                        <td rowspan="${span}" class="dm-panelist-cell"${it.isFirstOfPanelInTotal ? ` data-dm-panel-index="${it.pIdx}" data-dm-panelist-id="${it.panel.panelistId ? Number(it.panel.panelistId) : ""}" data-dm-panelist-name="${esc(it.panel.name)}"${pSig ? ' data-dm-has-committed-sig="1"' : ""}` : ""}>
                            ${it.isFirstOfPanelInTotal ? `
                                <div class="dm-panelist-name">${esc(it.panel.name)}</div>
                                <div class="dm-panelist-role">${esc(it.panel.role)}</div>
                                <div class="dm-panelist-sig-block">
                                    <div class="dm-panelist-sig">Signature:</div>
                                    <div class="dm-panelist-sig-slot">
                                        ${pSig ? `<img src="${esc(pSig.signatureImage)}" alt="Panelist Signature" class="dm-anchored-sig-img">` : ""}
                                    </div>
                                    <div class="dm-panelist-date">Date Signed: ${pSig && pSig.dateSigned ? `<span class="dm-anchored-date">${esc(pSig.dateSigned)}</span>` : ""}</div>
                                </div>
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
                <div class="dm-a4-scale-wrap">
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
                </div>
            `;
        }).join("");

        if (adviserOnSeparatePage) {
            const advPageIdx = pages.length;
            html += `
                <div class="dm-a4-scale-wrap">
                    <div class="dm-a4-page" data-dm-page="${advPageIdx}">
                        <div class="dm-a4-page-inner">
                            ${buildHeaderHtml(imgBase)}
                            <div class="dm-a4-page-body">${adviserBlockHtml}</div>
                        </div>
                        ${buildFooterHtml(imgBase)}
                    </div>
                </div>
            `;
        }

        containerEl.innerHTML = html;
        observeViewportResize(containerEl);
        requestAnimationFrame(() => fitPagesToViewport(containerEl));
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
                if (adv && (adv.reviewComment || adv.reviewStatus === "Subject to Change" || adv.reviewStatus === "Rejected")) {
                    items.push({
                        who: `${adv.signedBy || "Adviser"} (Adviser)`,
                        status: adv.reviewStatus || (adv.signatureImage ? "Approved" : "Pending"),
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
                        if (p && (p.reviewComment || p.reviewStatus === "Subject to Change" || p.reviewStatus === "Rejected")) {
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

        if (!items.length) {
            return `<p style="color:#94a3b8;font-size:12px;margin:0;">No revision or rejection notes recorded yet.</p>`;
        }

        return items.map(it => {
            const st = String(it.status || "");
            const displaySt = st === "Subject to Change" ? "Needs Revision" : st;
            const badgeStyle = st === "Approved"
                ? "background:#dcfce7;color:#15803d;"
                : (st === "Subject to Change" ? "background:#fef3c7;color:#b45309;" : (st === "Rejected" ? "background:#fee2e2;color:#dc2626;" : "background:#f1f5f9;color:#475569;"));
            return `
                <div style="background:#faf8ff;border:1px solid #ede9fe;border-radius:10px;padding:8px 10px;margin-bottom:6px;font-size:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px;">
                        <strong style="color:#2e1065;">${esc(it.who)}</strong>
                        <span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;${badgeStyle}">${esc(displaySt)}</span>
                    </div>
                    <div style="color:#334155;line-height:1.4;white-space:pre-wrap;">${it.comment ? esc(it.comment) : "<span style='color:#94a3b8;font-style:italic;'>No comment</span>"}</div>
                </div>
            `;
        }).join("");
    }

    /**
     * Enables click-to-sign directly on the rendered panelist or adviser name/title slots.
     * options: { role: "panelist" | "adviser", signatureImage, dateSigned, onSelectSlot(selection) }
     */
    function enableClickToSign(containerEl, options) {
        if (!containerEl) return;
        const opts = options || {};
        const role = opts.role === "adviser" ? "adviser" : "panelist";
        const sigImg = opts.signatureImage || "";
        let currentDate = opts.dateSigned || "";

        const selector = role === "adviser"
            ? ".dm-adviser-signoff[data-dm-adviser-block='1']:not([data-dm-has-committed-sig='1'])"
            : ".dm-panelist-cell[data-dm-panel-index]:not([data-dm-has-committed-sig='1'])";

        let targets = Array.from(containerEl.querySelectorAll(selector));
        if (role === "panelist" && (opts.panelistId || opts.panelistName)) {
            const targetPid = Number(opts.panelistId || 0);
            const targetName = String(opts.panelistName || "").trim();
            const ownTargets = targets.filter(el => {
                const elPid = Number(el.getAttribute("data-dm-panelist-id") || 0);
                const elName = el.getAttribute("data-dm-panelist-name") || "";
                if (targetPid && elPid) return elPid === targetPid;
                if (targetName && elName) return namesMatch(elName, targetName);
                return false;
            });
            targets = ownTargets;
        }
        const slotSelector = role === "adviser" ? ".dm-adviser-sig-slot" : ".dm-panelist-sig-slot";
        const dateSelector = role === "adviser" ? ".dm-adviser-date" : ".dm-panelist-date";

        const clearPreviewFromTarget = (el) => {
            el.classList.remove("dm-slot-signed-preview");
            el.removeAttribute("data-dm-preview-selected");
            const slotEl = el.querySelector(slotSelector);
            if (slotEl) {
                slotEl.innerHTML = `<span class="dm-click-to-sign-hint">Click here to sign</span>`;
            }
            const dateEl = el.querySelector(dateSelector);
            if (dateEl) {
                dateEl.innerHTML = `Date Signed: `;
            }
        };

        const applyPreviewToTarget = (el) => {
            targets.forEach(clearPreviewFromTarget);
            el.classList.add("dm-slot-signed-preview");
            el.setAttribute("data-dm-preview-selected", "1");
            const slotEl = el.querySelector(slotSelector);
            if (slotEl && sigImg) {
                slotEl.innerHTML = `<img src="${esc(sigImg)}" alt="E-Signature" class="dm-anchored-sig-img">`;
            }
            const dateEl = el.querySelector(dateSelector);
            if (dateEl) {
                dateEl.innerHTML = `Date Signed: ${currentDate ? `<span class="dm-anchored-date">${esc(currentDate)}</span>` : ""}`;
            }

            const pageEl = el.closest(".dm-a4-page");
            const pageIndex = pageEl ? Number(pageEl.getAttribute("data-dm-page") || 0) : 0;

            if (typeof opts.onSelectSlot === "function") {
                if (role === "adviser") {
                    const advNameEl = el.querySelector(".dm-adviser-name");
                    opts.onSelectSlot({
                        pageIndex,
                        targetSlot: "adviser",
                        targetName: advNameEl ? advNameEl.textContent.trim() : "Adviser"
                    });
                } else {
                    opts.onSelectSlot({
                        pageIndex,
                        targetPanelIndex: Number(el.getAttribute("data-dm-panel-index")),
                        targetPanelName: el.getAttribute("data-dm-panelist-name") || ""
                    });
                }
            }
        };

        targets.forEach(el => {
            el.classList.add("dm-clickable-sign-slot");
            el.title = "Click to sign under this name";
            clearPreviewFromTarget(el);
            el.addEventListener("click", () => {
                if (!sigImg) {
                    alert("No saved e-signature found in Faculty Settings. Please upload your e-signature first.");
                    return;
                }
                applyPreviewToTarget(el);
            });
        });

        containerEl._dmUpdateClickSignDate = (newDate) => {
            currentDate = newDate || "";
            const selected = containerEl.querySelector("[data-dm-preview-selected='1']");
            if (!selected) return;
            const dateEl = selected.querySelector(dateSelector);
            if (dateEl) {
                dateEl.innerHTML = `Date Signed: ${currentDate ? `<span class="dm-anchored-date">${esc(currentDate)}</span>` : ""}`;
            }
        };
    }

    function updateClickToSignDate(containerEl, newDate) {
        if (containerEl && typeof containerEl._dmUpdateClickSignDate === "function") {
            containerEl._dmUpdateClickSignDate(newDate);
        }
    }

    window.DefenseMinutesSheet = {
        renderPages: renderDefenseMinutesPages,
        mountDraggableSignature,
        enableClickToSign,
        updateClickToSignDate,
        renderReviewNotesHtml,
        fitPagesToViewport,
        getAnchorPosition,
        findMatchingPanelistSig,
        buildPlacedSignaturesHtmlForPage
    };
})();
