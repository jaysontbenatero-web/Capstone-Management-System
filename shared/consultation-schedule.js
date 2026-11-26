(function () {
    "use strict";

    const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const ORDERED_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function timeToMinutes(t) {
        if (!t) return null;
        const parts = String(t).trim().slice(0, 5).split(":");
        if (parts.length < 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    function minutesToTime24(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    function formatTime12(timeStr) {
        if (!timeStr) return "";
        const parts = String(timeStr).trim().slice(0, 5).split(":");
        if (parts.length < 2) return String(timeStr);
        const h = parseInt(parts[0], 10);
        const m = parts[1];
        if (isNaN(h)) return String(timeStr);
        const period = h >= 12 ? "PM" : "AM";
        const hr12 = h % 12 || 12;
        return `${hr12}:${m} ${period}`;
    }

    function formatDatePretty(dateStr) {
        if (!dateStr) return "";
        const clean = String(dateStr).trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
        const [y, m, d] = clean.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function getLocalYmd(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function describeScope(rule) {
        if (rule.scope_type === "everyday") return "Every Day";
        if (rule.scope_type === "weekday") return rule.day_of_week || "Weekly";
        if (rule.scope_type === "specific_date") return formatDatePretty(rule.specific_date);
        return "Custom";
    }

    function describeTime(rule) {
        if (Number(rule.all_day) === 1) return "All Day";
        const s = formatTime12(rule.start_time);
        const e = formatTime12(rule.end_time);
        return (s && e) ? `${s} – ${e}` : (s || e || "Custom Time");
    }

    /* ── Subtract blocked intervals from an available interval [start, end] ── */
    function subtractIntervals(startMin, endMin, blockedList) {
        let segments = [[startMin, endMin]];
        blockedList.forEach(([bStart, bEnd]) => {
            const next = [];
            segments.forEach(([s, e]) => {
                if (bEnd <= s || bStart >= e) {
                    next.push([s, e]);
                } else {
                    if (bStart > s) next.push([s, bStart]);
                    if (bEnd < e) next.push([bEnd, e]);
                }
            });
            segments = next;
        });
        return segments.filter(([s, e]) => e - s >= 15);
    }

    /* ── Compute upcoming selectable slots for a student given faculty rules & booked slots ── */
    function computeSelectableSlots(schedules, bookedSlots, daysAhead) {
        const horizon = Number(daysAhead) || 14;
        const allRules = Array.isArray(schedules) ? schedules : [];
        const availableRules = allRules.filter(r => r.rule_type === "available");
        const unavailableRules = allRules.filter(r => r.rule_type === "unavailable");
        const booked = Array.isArray(bookedSlots) ? bookedSlots : [];

        const now = new Date();
        const todayYmd = getLocalYmd(now);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const days = [];

        for (let offset = 0; offset < horizon; offset++) {
            const dObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
            const ymd = getLocalYmd(dObj);
            const weekday = WEEKDAYS[dObj.getDay()];

            const matchingUnavail = unavailableRules.filter(r =>
                r.scope_type === "everyday" ||
                (r.scope_type === "weekday" && r.day_of_week === weekday) ||
                (r.scope_type === "specific_date" && String(r.specific_date || "").slice(0, 10) === ymd)
            );

            // If any unavailable rule blocks the entire day, skip this day
            if (matchingUnavail.some(r => Number(r.all_day) === 1)) {
                continue;
            }

            const blockedIntervals = matchingUnavail
                .map(r => [timeToMinutes(r.start_time), timeToMinutes(r.end_time)])
                .filter(([s, e]) => s !== null && e !== null && e > s);

            const matchingAvail = availableRules.filter(r =>
                r.scope_type === "everyday" ||
                (r.scope_type === "weekday" && r.day_of_week === weekday) ||
                (r.scope_type === "specific_date" && String(r.specific_date || "").slice(0, 10) === ymd)
            );

            if (matchingAvail.length === 0) continue;

            const daySlots = [];
            const seenKeys = new Set();

            matchingAvail.forEach(rule => {
                const sMin = timeToMinutes(rule.start_time);
                const eMin = timeToMinutes(rule.end_time);
                if (sMin === null || eMin === null || eMin <= sMin) return;

                const openSegments = subtractIntervals(sMin, eMin, blockedIntervals);
                openSegments.forEach(([segStart, segEnd]) => {
                    // Skip slots already ended today
                    if (ymd === todayYmd && segEnd <= nowMinutes) return;

                    const st24 = minutesToTime24(segStart);
                    const en24 = minutesToTime24(segEnd);
                    const key = `${ymd}|${st24}|${en24}`;
                    if (seenKeys.has(key)) return;
                    seenKeys.add(key);

                    const isBooked = booked.some(b => {
                        if (String(b.slot_date || "").slice(0, 10) !== ymd) return false;
                        const bStart = timeToMinutes(b.start_time);
                        const bEnd = timeToMinutes(b.end_time);
                        if (bStart === null || bEnd === null) return false;
                        return segStart < bEnd && segEnd > bStart;
                    });

                    const scopeTag = rule.scope_type === "everyday"
                        ? "Every Day"
                        : (rule.scope_type === "weekday" ? rule.day_of_week : "Specific Date");

                    daySlots.push({
                        key,
                        slot_id: rule.id,
                        date: ymd,
                        weekday,
                        datePretty: formatDatePretty(ymd),
                        start_time: st24,
                        end_time: en24,
                        timeLabel: `${formatTime12(st24)} – ${formatTime12(en24)}`,
                        scopeTag,
                        consultation_mode: rule.consultation_mode || "",
                        location_or_link: rule.location_or_link || "",
                        notes: rule.notes || "",
                        isBooked,
                        label: `${formatDatePretty(ymd)} • ${formatTime12(st24)} – ${formatTime12(en24)}`
                    });
                });
            });

            daySlots.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

            if (daySlots.length > 0) {
                days.push({
                    date: ymd,
                    weekday,
                    label: offset === 0
                        ? `Today — ${formatDatePretty(ymd)}`
                        : (offset === 1 ? `Tomorrow — ${formatDatePretty(ymd)}` : formatDatePretty(ymd)),
                    slots: daySlots
                });
            }
        }

        return { days, availableRules, unavailableRules };
    }

    /* ── Faculty Custom Schedule Manager (Shared by Adviser, Instructor, Panelist) ── */
    function initFacultyScheduler(config) {
        const apiBase = config.apiBase || "";
        const facultyUserId = config.facultyUserId || localStorage.getItem("userId");
        const summaryHostId = config.summaryHostId || "facultyScheduleSummaryCard";
        const topBtnBadgeId = config.topBtnBadgeId || "customScheduleCount";

        let schedules = [];
        let formRuleType = "available";
        let formScopeType = "everyday";
        let selectedWeekdays = new Set(["Monday"]);

        function ensureModalMounted() {
            if (document.getElementById("customScheduleModal")) return;

            const overlay = document.createElement("div");
            overlay.id = "customScheduleModal";
            overlay.className = "cs-modal-overlay";
            overlay.innerHTML = `
                <div class="cs-modal-box">
                    <div class="cs-modal-header">
                        <div>
                            <h3><i class="fa-solid fa-calendar-week" style="color:#7c3aed;"></i> Custom Consultation Schedule</h3>
                            <p>Set the days &amp; hours when you accept consultations (generic daily or specific days/dates) and block times or days when you are unavailable.</p>
                        </div>
                        <button type="button" class="cs-modal-close" id="csCloseModalBtn" aria-label="Close custom schedule" title="Close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="cs-modal-body">
                        <div class="cs-builder-card">
                            <span class="cs-step-label">1. Schedule Type</span>
                            <div class="cs-type-switch">
                                <button type="button" class="cs-type-option is-active-avail" id="csTypeAvailBtn">
                                    <strong><i class="fa-solid fa-circle-check"></i> Accept Consultations</strong>
                                    <span>Set available consultation hours students can choose from.</span>
                                </button>
                                <button type="button" class="cs-type-option" id="csTypeUnavailBtn">
                                    <strong><i class="fa-solid fa-ban"></i> Do Not Accept (Unavailable)</strong>
                                    <span>Block specific times or entire days when you are busy.</span>
                                </button>
                            </div>

                            <span class="cs-step-label">2. Applies To</span>
                            <div class="cs-scope-tabs">
                                <button type="button" class="cs-scope-btn active" data-scope="everyday">
                                    <i class="fa-solid fa-repeat"></i> Every Day (Generic)
                                </button>
                                <button type="button" class="cs-scope-btn" data-scope="weekday">
                                    <i class="fa-solid fa-calendar-week"></i> Specific Day(s) of Week
                                </button>
                                <button type="button" class="cs-scope-btn" data-scope="specific_date">
                                    <i class="fa-solid fa-calendar-day"></i> Specific Date
                                </button>
                            </div>

                            <div id="csWeekdayWrap" style="display:none;">
                                <div class="cs-weekday-pills" id="csWeekdayPills">
                                    ${ORDERED_WEEKDAYS.map(day => `
                                        <button type="button" class="cs-day-pill ${day === "Monday" ? "selected" : ""}" data-day="${day}">
                                            ${day.slice(0, 3)}
                                        </button>
                                    `).join("")}
                                </div>
                            </div>

                            <div id="csSpecificDateWrap" style="display:none;margin-bottom:14px;">
                                <div class="cs-field" style="max-width:260px;">
                                    <label for="csSpecificDateInput">Choose Date</label>
                                    <input type="date" id="csSpecificDateInput">
                                </div>
                            </div>

                            <div id="csConflictNotice" class="cs-conflict-notice" style="display:none;"></div>

                            <label class="cs-allday-row" id="csAllDayWrap" style="display:none;">
                                <input type="checkbox" id="csAllDayCheckbox">
                                <span>Unavailable All Day (no consultations accepted on selected day/date)</span>
                            </label>

                            <div id="csTimeFieldsWrap">
                                <span class="cs-step-label">3. Time Range</span>
                                <div class="cs-quick-presets">
                                    <span class="cs-preset-label">Quick Presets:</span>
                                    <button type="button" class="cs-preset-chip" data-start="09:00" data-end="10:00">9:00 AM – 10:00 AM</button>
                                    <button type="button" class="cs-preset-chip" data-start="10:00" data-end="12:00">10:00 AM – 12:00 PM</button>
                                    <button type="button" class="cs-preset-chip" data-start="13:00" data-end="14:00">1:00 PM – 2:00 PM</button>
                                    <button type="button" class="cs-preset-chip" data-start="14:00" data-end="15:00">2:00 PM – 3:00 PM</button>
                                    <button type="button" class="cs-preset-chip" data-start="15:00" data-end="17:00">3:00 PM – 5:00 PM</button>
                                </div>
                                <div class="cs-field-grid">
                                    <div class="cs-field">
                                        <label for="csStartTime">Start Time</label>
                                        <input type="time" id="csStartTime" value="13:00">
                                    </div>
                                    <div class="cs-field">
                                        <label for="csEndTime">End Time</label>
                                        <input type="time" id="csEndTime" value="14:00">
                                    </div>
                                </div>
                            </div>

                            <div id="csAvailExtraWrap">
                                <div class="cs-field-grid">
                                    <div class="cs-field">
                                        <label for="csModeSelect">Consultation Mode (Optional)</label>
                                        <select id="csModeSelect">
                                            <option value="">Any (Personal or Online)</option>
                                            <option value="Personal Consultation">Personal Consultation</option>
                                            <option value="Online Consultation">Online Consultation</option>
                                        </select>
                                    </div>
                                    <div class="cs-field">
                                        <label for="csLocationInput">Default Room / Meeting Link (Optional)</label>
                                        <input type="text" id="csLocationInput" placeholder="e.g., Faculty Room 201 or Google Meet">
                                    </div>
                                </div>
                            </div>

                            <div class="cs-field" style="margin-bottom:14px;">
                                <label for="csNotesInput">Note / Label (Optional)</label>
                                <input type="text" id="csNotesInput" placeholder="e.g., Office consultation hours, Lunch break, Department meeting...">
                            </div>

                            <button type="button" class="cs-add-rule-btn" id="csSaveRuleBtn">
                                <i class="fa-solid fa-plus"></i> Add Available Schedule
                            </button>
                        </div>

                        <div class="cs-saved-lists">
                            <div class="cs-saved-box">
                                <h4><i class="fa-solid fa-calendar-check"></i> Available Consultation Hours</h4>
                                <div id="csModalAvailList"><p class="cs-empty-hint">No available consultation times set yet.</p></div>
                            </div>
                            <div class="cs-saved-box is-unavail">
                                <h4><i class="fa-solid fa-calendar-xmark"></i> Unavailable Days &amp; Times</h4>
                                <div id="csModalUnavailList"><p class="cs-empty-hint">No blocked days or times set.</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Wire modal events
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) closeModal();
            });
            document.getElementById("csCloseModalBtn").addEventListener("click", closeModal);
            document.getElementById("csTypeAvailBtn").addEventListener("click", () => setRuleType("available"));
            document.getElementById("csTypeUnavailBtn").addEventListener("click", () => setRuleType("unavailable"));

            overlay.querySelectorAll(".cs-scope-btn").forEach(btn => {
                btn.addEventListener("click", () => setScopeType(btn.dataset.scope));
            });

            overlay.querySelectorAll(".cs-day-pill").forEach(pill => {
                pill.addEventListener("click", () => {
                    if (pill.disabled || pill.classList.contains("is-conflicted")) return;
                    const day = pill.dataset.day;
                    if (selectedWeekdays.has(day)) {
                        if (selectedWeekdays.size > 1) {
                            selectedWeekdays.delete(day);
                            pill.classList.remove("selected");
                        }
                    } else {
                        selectedWeekdays.add(day);
                        pill.classList.add("selected");
                    }
                    syncConflictState();
                });
            });

            overlay.querySelectorAll(".cs-preset-chip").forEach(chip => {
                chip.addEventListener("click", () => {
                    document.getElementById("csStartTime").value = chip.dataset.start;
                    document.getElementById("csEndTime").value = chip.dataset.end;
                    syncConflictState();
                });
            });

            document.getElementById("csAllDayCheckbox").addEventListener("change", syncBuilderVisibility);
            document.getElementById("csSaveRuleBtn").addEventListener("click", handleAddRule);

            // Default specific date to today
            const dateInput = document.getElementById("csSpecificDateInput");
            if (dateInput) {
                const today = getLocalYmd(new Date());
                dateInput.min = today;
                dateInput.value = today;
                dateInput.addEventListener("change", syncConflictState);
            }
            const startInput = document.getElementById("csStartTime");
            const endInput = document.getElementById("csEndTime");
            if (startInput) startInput.addEventListener("change", syncConflictState);
            if (endInput) endInput.addEventListener("change", syncConflictState);
        }

        function getWeekdayFromYmd(ymd) {
            if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
            const [y, m, d] = ymd.split("-").map(Number);
            return WEEKDAYS[new Date(y, m - 1, d).getDay()] || "";
        }

        function getConflictedWeekdaySet() {
            const oppositeType = formRuleType === "available" ? "unavailable" : "available";
            const allDayCb = document.getElementById("csAllDayCheckbox");
            const isAllDay = formRuleType === "unavailable" && formScopeType !== "everyday" && allDayCb && allDayCb.checked;
            const conflicted = new Set();

            schedules.forEach(r => {
                if (r.rule_type !== oppositeType) return;
                if (r.scope_type === "weekday" && r.day_of_week) {
                    conflicted.add(r.day_of_week);
                } else if (isAllDay && r.scope_type === "specific_date" && r.specific_date) {
                    const wd = getWeekdayFromYmd(String(r.specific_date).slice(0, 10));
                    if (wd) conflicted.add(wd);
                }
            });
            return conflicted;
        }

        function getCurrentConflictMessage() {
            const oppositeType = formRuleType === "available" ? "unavailable" : "available";
            const oppositeLabel = oppositeType === "unavailable" ? "Unavailable" : "Available";
            const currentLabel = formRuleType === "available" ? "Available" : "Unavailable";
            const allDayCb = document.getElementById("csAllDayCheckbox");
            const isAllDay = formRuleType === "unavailable" && formScopeType !== "everyday" && allDayCb && allDayCb.checked;
            const sMin = isAllDay ? 0 : timeToMinutes(document.getElementById("csStartTime")?.value || "");
            const eMin = isAllDay ? 24 * 60 : timeToMinutes(document.getElementById("csEndTime")?.value || "");
            const oppositeRows = schedules.filter(r => r.rule_type === oppositeType);

            const overlaps = (r) => {
                if (isAllDay || Number(r.all_day) === 1) return true;
                const rs = timeToMinutes(r.start_time);
                const re = timeToMinutes(r.end_time);
                if (rs === null || re === null || sMin === null || eMin === null) return false;
                return sMin < re && eMin > rs;
            };

            if (formScopeType === "weekday") {
                const conflicted = getConflictedWeekdaySet();
                const chosen = Array.from(selectedWeekdays);
                if (chosen.length === 0) {
                    return `All days are already set as ${oppositeLabel}. Remove an existing ${oppositeLabel} day first.`;
                }
                const bad = chosen.filter(d => conflicted.has(d));
                if (bad.length > 0) {
                    return `${bad.join(", ")} ${bad.length === 1 ? "is" : "are"} already set as ${oppositeLabel} and cannot be set as ${currentLabel}. Remove the existing rule first.`;
                }
            } else if (formScopeType === "specific_date") {
                const dateVal = document.getElementById("csSpecificDateInput")?.value || "";
                if (dateVal) {
                    const wd = getWeekdayFromYmd(dateVal);
                    const sameDate = oppositeRows.some(r =>
                        r.scope_type === "specific_date" && String(r.specific_date || "").slice(0, 10) === dateVal
                    );
                    if (sameDate) {
                        return `${formatDatePretty(dateVal)} is already set as ${oppositeLabel} and cannot be set as ${currentLabel}. Remove the existing rule first.`;
                    }
                    const wdConflict = oppositeRows.some(r =>
                        r.scope_type === "weekday" && r.day_of_week === wd && (Number(r.all_day) === 1 || isAllDay || overlaps(r))
                    );
                    if (wdConflict) {
                        return `${formatDatePretty(dateVal)} (${wd}) conflicts with your ${wd} ${oppositeLabel} schedule. Remove the existing rule first.`;
                    }
                }
            } else if (formScopeType === "everyday") {
                const evConflict = oppositeRows.some(r => r.scope_type === "everyday" && overlaps(r));
                if (evConflict) {
                    return `This Every Day time range conflicts with an existing Every Day ${oppositeLabel} rule. Remove the conflicting rule first.`;
                }
            }
            return "";
        }

        function syncConflictState() {
            const oppositeLabel = formRuleType === "available" ? "Unavailable" : "Available";
            const conflicted = getConflictedWeekdaySet();

            // Remove any newly conflicted days from selection
            conflicted.forEach(d => selectedWeekdays.delete(d));

            // If on weekday scope and nothing is selected, auto-select first non-conflicted day
            if (selectedWeekdays.size === 0) {
                const firstOpen = ORDERED_WEEKDAYS.find(d => !conflicted.has(d));
                if (firstOpen) selectedWeekdays.add(firstOpen);
            }

            document.querySelectorAll("#csWeekdayPills .cs-day-pill").forEach(pill => {
                const day = pill.dataset.day;
                const isBlocked = conflicted.has(day);
                pill.disabled = isBlocked;
                pill.classList.toggle("is-conflicted", isBlocked);
                pill.classList.toggle("selected", !isBlocked && selectedWeekdays.has(day));
                pill.title = isBlocked
                    ? `${day} is already set as ${oppositeLabel} — remove it first`
                    : day;
            });

            const noticeEl = document.getElementById("csConflictNotice");
            const saveBtn = document.getElementById("csSaveRuleBtn");
            const conflictMsg = getCurrentConflictMessage();
            if (noticeEl) {
                if (conflictMsg) {
                    noticeEl.style.display = "flex";
                    noticeEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${escapeHtml(conflictMsg)}</span>`;
                } else {
                    noticeEl.style.display = "none";
                    noticeEl.innerHTML = "";
                }
            }
            if (saveBtn) {
                saveBtn.disabled = Boolean(conflictMsg);
            }
        }

        function setRuleType(type) {
            formRuleType = type === "unavailable" ? "unavailable" : "available";
            const availBtn = document.getElementById("csTypeAvailBtn");
            const unavailBtn = document.getElementById("csTypeUnavailBtn");
            if (availBtn) availBtn.className = `cs-type-option ${formRuleType === "available" ? "is-active-avail" : ""}`;
            if (unavailBtn) unavailBtn.className = `cs-type-option ${formRuleType === "unavailable" ? "is-active-unavail" : ""}`;

            const saveBtn = document.getElementById("csSaveRuleBtn");
            if (saveBtn) {
                saveBtn.className = `cs-add-rule-btn ${formRuleType === "unavailable" ? "is-unavail" : ""}`;
                saveBtn.innerHTML = formRuleType === "unavailable"
                    ? `<i class="fa-solid fa-ban"></i> Add Unavailable Block`
                    : `<i class="fa-solid fa-plus"></i> Add Available Schedule`;
            }

            if (formRuleType === "available") {
                const cb = document.getElementById("csAllDayCheckbox");
                if (cb) cb.checked = false;
            }
            syncBuilderVisibility();
        }

        function setScopeType(scope) {
            formScopeType = scope;
            document.querySelectorAll("#customScheduleModal .cs-scope-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.scope === formScopeType);
            });
            if (formScopeType === "everyday") {
                const cb = document.getElementById("csAllDayCheckbox");
                if (cb) cb.checked = false;
            }
            syncBuilderVisibility();
        }

        function syncBuilderVisibility() {
            const wdWrap = document.getElementById("csWeekdayWrap");
            const sdWrap = document.getElementById("csSpecificDateWrap");
            const allDayWrap = document.getElementById("csAllDayWrap");
            const allDayCb = document.getElementById("csAllDayCheckbox");
            const timeWrap = document.getElementById("csTimeFieldsWrap");
            const extraWrap = document.getElementById("csAvailExtraWrap");

            if (wdWrap) wdWrap.style.display = formScopeType === "weekday" ? "block" : "none";
            if (sdWrap) sdWrap.style.display = formScopeType === "specific_date" ? "block" : "none";

            const allowAllDay = formRuleType === "unavailable" && formScopeType !== "everyday";
            if (allDayWrap) allDayWrap.style.display = allowAllDay ? "flex" : "none";
            if (!allowAllDay && allDayCb) allDayCb.checked = false;

            const isAllDay = allowAllDay && allDayCb && allDayCb.checked;
            if (timeWrap) timeWrap.style.display = isAllDay ? "none" : "block";
            if (extraWrap) extraWrap.style.display = formRuleType === "available" ? "block" : "none";
            syncConflictState();
        }

        async function handleAddRule() {
            const conflictMsg = getCurrentConflictMessage();
            if (conflictMsg) {
                alert(conflictMsg);
                return;
            }
            const saveBtn = document.getElementById("csSaveRuleBtn");
            const allDayCb = document.getElementById("csAllDayCheckbox");
            const isAllDay = formRuleType === "unavailable" && formScopeType !== "everyday" && allDayCb && allDayCb.checked;

            const payload = {
                facultyUserId,
                ruleType: formRuleType,
                scopeType: formScopeType,
                allDay: isAllDay,
                notes: (document.getElementById("csNotesInput")?.value || "").trim()
            };

            if (formScopeType === "weekday") {
                payload.daysOfWeek = Array.from(selectedWeekdays);
                if (payload.daysOfWeek.length === 0) {
                    alert("Please select at least one day of the week.");
                    return;
                }
            } else if (formScopeType === "specific_date") {
                payload.specificDate = document.getElementById("csSpecificDateInput")?.value || "";
                if (!payload.specificDate) {
                    alert("Please choose a specific date.");
                    return;
                }
            }

            if (!isAllDay) {
                payload.startTime = document.getElementById("csStartTime")?.value || "";
                payload.endTime = document.getElementById("csEndTime")?.value || "";
                if (!payload.startTime || !payload.endTime) {
                    alert("Please specify both Start Time and End Time.");
                    return;
                }
                if (timeToMinutes(payload.endTime) <= timeToMinutes(payload.startTime)) {
                    alert("End Time must be later than Start Time.");
                    return;
                }
            }

            if (formRuleType === "available") {
                payload.consultationMode = document.getElementById("csModeSelect")?.value || "";
                payload.locationOrLink = (document.getElementById("csLocationInput")?.value || "").trim();
            }

            if (saveBtn) saveBtn.disabled = true;
            try {
                const res = await fetch(`${apiBase}/api/faculty/consultation-schedule`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!data.success) {
                    alert(data.message || "Failed to save custom schedule.");
                    return;
                }
                schedules = Array.isArray(data.schedules) ? data.schedules : schedules;
                if (document.getElementById("csNotesInput")) document.getElementById("csNotesInput").value = "";
                if (document.getElementById("csLocationInput")) document.getElementById("csLocationInput").value = "";
                renderAll();
            } catch (err) {
                console.error("Save schedule error:", err);
                alert("Cannot save custom schedule right now.");
            } finally {
                if (saveBtn) saveBtn.disabled = false;
            }
        }

        async function deleteRule(ruleId) {
            try {
                const res = await fetch(`${apiBase}/api/faculty/consultation-schedule/${encodeURIComponent(ruleId)}?facultyUserId=${encodeURIComponent(facultyUserId)}`, {
                    method: "DELETE"
                });
                const data = await res.json();
                if (!data.success) {
                    alert(data.message || "Failed to remove schedule rule.");
                    return;
                }
                schedules = Array.isArray(data.schedules) ? data.schedules : schedules.filter(r => Number(r.id) !== Number(ruleId));
                renderAll();
            } catch (err) {
                console.error("Delete schedule error:", err);
                alert("Cannot remove schedule rule right now.");
            }
        }

        function renderAll() {
            const avail = schedules.filter(r => r.rule_type === "available");
            const unavail = schedules.filter(r => r.rule_type === "unavailable");

            const badge = document.getElementById(topBtnBadgeId);
            if (badge) badge.textContent = String(schedules.length);

            // Render inline summary card
            const summaryHost = document.getElementById(summaryHostId);
            if (summaryHost) {
                const availChips = avail.length
                    ? avail.map(r => `
                        <span class="cs-rule-chip">
                            <span class="cs-rule-chip-scope">${escapeHtml(describeScope(r))}</span>
                            <span>${escapeHtml(describeTime(r))}${r.consultation_mode ? ` &bull; ${escapeHtml(r.consultation_mode.replace(" Consultation", ""))}` : ""}</span>
                            <button type="button" class="cs-rule-chip-del" data-del-id="${r.id}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
                        </span>
                    `).join("")
                    : `<span class="cs-empty-hint">No consultation hours configured yet. Click "Manage Custom Schedule" to add times.</span>`;

                const unavailChips = unavail.length
                    ? unavail.map(r => `
                        <span class="cs-rule-chip is-unavail">
                            <span class="cs-rule-chip-scope">${escapeHtml(describeScope(r))}</span>
                            <span>${escapeHtml(describeTime(r))}${r.notes ? ` (${escapeHtml(r.notes)})` : ""}</span>
                            <button type="button" class="cs-rule-chip-del" data-del-id="${r.id}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
                        </span>
                    `).join("")
                    : `<span class="cs-empty-hint">No blocked days or unavailable hours set.</span>`;

                summaryHost.innerHTML = `
                    <div class="cs-summary-head">
                        <div>
                            <h2><i class="fa-solid fa-calendar-week" style="color:#7c3aed;"></i> My Consultation Schedule</h2>
                            <p>Students choose from your available hours below when submitting a consultation request. Shared across your Adviser, Instructor, and Panelist roles.</p>
                        </div>
                        <button type="button" class="cs-manage-btn" id="csInlineManageBtn">
                            <i class="fa-solid fa-sliders"></i> Manage Custom Schedule
                        </button>
                    </div>
                    <div class="cs-summary-columns">
                        <div class="cs-summary-col">
                            <div class="cs-summary-col-title"><i class="fa-solid fa-circle-check"></i> Accepting Consultations (${avail.length})</div>
                            <div class="cs-rule-chip-list">${availChips}</div>
                        </div>
                        <div class="cs-summary-col is-unavail">
                            <div class="cs-summary-col-title"><i class="fa-solid fa-ban"></i> Unavailable Days &amp; Times (${unavail.length})</div>
                            <div class="cs-rule-chip-list">${unavailChips}</div>
                        </div>
                    </div>
                `;

                const inlineBtn = document.getElementById("csInlineManageBtn");
                if (inlineBtn) inlineBtn.addEventListener("click", openModal);

                summaryHost.querySelectorAll("[data-del-id]").forEach(btn => {
                    btn.addEventListener("click", () => deleteRule(btn.dataset.delId));
                });
            }

            // Render modal lists if mounted
            const modalAvail = document.getElementById("csModalAvailList");
            const modalUnavail = document.getElementById("csModalUnavailList");
            if (modalAvail) {
                modalAvail.innerHTML = avail.length
                    ? avail.map(r => {
                        const extras = [r.consultation_mode, r.location_or_link, r.notes].filter(Boolean).join(" • ");
                        return `
                            <div class="cs-rule-row">
                                <div class="cs-rule-row-main">
                                    <strong>${escapeHtml(describeScope(r))} &bull; ${escapeHtml(describeTime(r))}</strong>
                                    ${extras ? `<div class="cs-rule-row-sub">${escapeHtml(extras)}</div>` : ""}
                                </div>
                                <button type="button" class="cs-rule-del-btn" data-del-id="${r.id}" title="Delete rule">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        `;
                    }).join("")
                    : `<p class="cs-empty-hint">No available consultation times set yet.</p>`;

                modalAvail.querySelectorAll("[data-del-id]").forEach(btn => {
                    btn.addEventListener("click", () => deleteRule(btn.dataset.delId));
                });
            }

            if (modalUnavail) {
                modalUnavail.innerHTML = unavail.length
                    ? unavail.map(r => `
                        <div class="cs-rule-row is-unavail">
                            <div class="cs-rule-row-main">
                                <strong>${escapeHtml(describeScope(r))} &bull; ${escapeHtml(describeTime(r))}</strong>
                                ${r.notes ? `<div class="cs-rule-row-sub">${escapeHtml(r.notes)}</div>` : ""}
                            </div>
                            <button type="button" class="cs-rule-del-btn" data-del-id="${r.id}" title="Delete rule">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join("")
                    : `<p class="cs-empty-hint">No unavailable days or times set.</p>`;

                modalUnavail.querySelectorAll("[data-del-id]").forEach(btn => {
                    btn.addEventListener("click", () => deleteRule(btn.dataset.delId));
                });
            }

            syncConflictState();
        }

        async function loadSchedules() {
            if (!facultyUserId) return;
            try {
                const res = await fetch(`${apiBase}/api/faculty/consultation-schedule?facultyUserId=${encodeURIComponent(facultyUserId)}`);
                const data = await res.json();
                if (data.success) {
                    schedules = Array.isArray(data.schedules) ? data.schedules : [];
                }
            } catch (err) {
                console.error("Load custom schedules error:", err);
            }
            renderAll();
        }

        function openModal() {
            ensureModalMounted();
            renderAll();
            document.getElementById("customScheduleModal").classList.add("is-open");
        }

        function closeModal() {
            const modal = document.getElementById("customScheduleModal");
            if (modal) modal.classList.remove("is-open");
        }

        ensureModalMounted();
        loadSchedules();

        return {
            openModal,
            closeModal,
            reload: loadSchedules,
            setSchedules(nextList) {
                if (Array.isArray(nextList)) {
                    schedules = nextList;
                    renderAll();
                }
            }
        };
    }

    window.ConsultationScheduleUI = {
        formatTime12,
        formatDatePretty,
        describeScope,
        describeTime,
        computeSelectableSlots,
        initFacultyScheduler
    };
})();
