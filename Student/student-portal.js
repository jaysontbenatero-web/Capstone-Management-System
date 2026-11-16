(function () {
    const API_BASE = (function() {
        if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
            if (window.location.port === "3005" || window.location.host.endsWith(":3005")) {
                return "";
            }
            return `${window.location.protocol}//${window.location.hostname}:3005`;
        }
        return "http://localhost:3005";
    })();

    let cachedGroup = null;
    let cachedGroupUserId = null;

    async function fetchStudentGroup(userId) {
        const id = String(userId || localStorage.getItem("userId") || "").trim();

        if (!id) {
            return { hasGroup: false, group: null };
        }

        if (cachedGroupUserId === id && cachedGroup !== null) {
            return cachedGroup;
        }

        try {
            const response = await fetch(
                `${API_BASE}/student-group/${encodeURIComponent(id)}`
            );
            const data = await response.json();

            cachedGroup = {
                hasGroup: Boolean(data.success && data.group),
                group: data.success ? data.group : null
            };
        } catch (error) {
            console.error("fetchStudentGroup:", error);
            cachedGroup = { hasGroup: false, group: null };
        }

        cachedGroupUserId = id;
        return cachedGroup;
    }

    function clearStudentGroupCache() {
        cachedGroup = null;
        cachedGroupUserId = null;
    }

    function setStudentActiveNav(navId) {
        if (!navId) {
            return;
        }

        document.querySelectorAll(".menu-item").forEach((item) => {
            item.classList.remove("active");
        });

        const nav = document.getElementById(navId);

        if (nav) {
            nav.classList.add("active");
        }
    }

    function ensureGroupGateOverlay() {
        let overlay = document.getElementById("groupRequiredOverlay");

        if (overlay) {
            return overlay;
        }

        overlay = document.createElement("div");
        overlay.id = "groupRequiredOverlay";
        overlay.className = "student-group-gate";
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="student-group-gate-panel">
                <i class="fa-solid fa-users-slash"></i>
                <h2>Please Create or Join a Group First</h2>
                <p>
                    This page unlocks after your capstone team is set up.
                    Go to <strong>Members</strong> to create or join a group, then return here.
                </p>
                <button type="button" class="gate-btn" onclick="window.location.href='Members.html'">
                    <i class="fa-solid fa-user-plus"></i>
                    Go to Members
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    async function initStudentGroupGate(options) {
        const opts = options || {};
        const { hasGroup } = await fetchStudentGroup();

        if (opts.activeNav) {
            setStudentActiveNav(opts.activeNav);
        }

        if (!opts.requireGroup || hasGroup) {
            const overlay = document.getElementById("groupRequiredOverlay");

            if (overlay) {
                overlay.hidden = true;
            }

            return hasGroup;
        }

        const overlay = ensureGroupGateOverlay();
        overlay.hidden = false;
        return false;
    }

    window.fetchStudentGroup = fetchStudentGroup;
    window.clearStudentGroupCache = clearStudentGroupCache;
    window.setStudentActiveNav = setStudentActiveNav;
    window.initStudentGroupGate = initStudentGroupGate;
})();
