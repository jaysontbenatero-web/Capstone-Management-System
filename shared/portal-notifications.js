(function () {

    const API_BASE = "";
    const POLL_MS = 4000;
    const POLL_HIDDEN_MS = 45000;
    const DROPDOWN_LIMIT = 5;

    function getLoggedInUserId() {
        return localStorage.getItem("userId");
    }

    const PORTAL_FOLDERS = ["Admin", "Faculty", "Student"];

    function getRolePortalFolder() {
        const role = String(localStorage.getItem("role") || "").toLowerCase().trim();

        if (role === "admin") {
            return "Admin";
        }

        if (role === "student") {
            return "Student";
        }

        if (role === "faculty") {
            return "Faculty";
        }

        return null;
    }

    function findPortalInPath(path) {
        const normalized = String(path || "").replace(/\\/g, "/");

        for (let i = 0; i < PORTAL_FOLDERS.length; i += 1) {
            const folder = PORTAL_FOLDERS[i];
            const marker = `/${folder}/`;
            const index = normalized.toLowerCase().indexOf(marker.toLowerCase());

            if (index === -1) {
                continue;
            }

            const afterPortal = normalized.slice(index + marker.length);
            const segments = afterPortal.split("/").filter(Boolean);

            return {
                folder,
                segments
            };
        }

        return null;
    }

    function getNotificationsPageUrl() {
        const path = (window.location.pathname || "").replace(/\\/g, "/");
        const rolePortal = getRolePortalFolder();
        const targetPortal = rolePortal || "Faculty";
        const currentPortal = findPortalInPath(path);

        if (currentPortal && currentPortal.folder === targetPortal) {
            const depth = Math.max(0, currentPortal.segments.length - 1);

            if (depth === 0) {
                return "Notifications.html";
            }

            return `${"../".repeat(depth)}Notifications.html`;
        }

        if (currentPortal) {
            const ups = "../".repeat(currentPortal.segments.length);
            return `${ups}${targetPortal}/Notifications.html`;
        }

        return `${targetPortal}/Notifications.html`;
    }

    function resolveRelativeUrl(targetPath) {
        const currentPath = (window.location.pathname || "").replace(/\\/g, "/");
        const portalMarker = findPortalInPath(currentPath);
        if (!portalMarker) {
            return targetPath;
        }
        const depth = portalMarker.segments.length;
        const ups = "../".repeat(depth);
        return `${ups}${targetPath}`;
    }

    function getNotificationTargetUrl(item) {
        if (!item) {
            return getNotificationsPageUrl();
        }

        const title = String(item.notification_title || "").toLowerCase();
        const message = String(item.notification_message || "").toLowerCase();
        const type = String(item.notification_type || "").toLowerCase();
        const combined = `${title} ${message} ${type}`;

        if (type === "announcement" || title.startsWith("new announcement")) {
            const role = String(localStorage.getItem("role") || "").toLowerCase().trim();
            if (role === "admin") return resolveRelativeUrl("Admin/Announcements.html");
            if (role === "faculty") return resolveRelativeUrl("Faculty/Announcements.html");
            if (role === "student") return resolveRelativeUrl("Student/StudentDash.html");
            return getNotificationsPageUrl();
        }

        const role = String(localStorage.getItem("role") || "").toLowerCase().trim();
        const position = String(localStorage.getItem("position") || "").toLowerCase().trim();
        const facultyRole = String(localStorage.getItem("facultyRole") || "").toLowerCase().trim();
        const activePath = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
        const sessionRole = String(sessionStorage.getItem("active_faculty_role") || "").toLowerCase();
        const hasPanelistAccess = localStorage.getItem("panelist_access") === "1";
        const hasInstructorAccess = localStorage.getItem("instructor_access") === "1";
        const hasAdviserAccess = localStorage.getItem("adviser_access") === "1";

        // 1. MESSAGES / CHAT / CONVERSATION
        if (
            type === "message" ||
            title.includes("message") ||
            combined.includes("new message") ||
            combined.includes("chat") ||
            combined.includes("conversation") ||
            combined.includes("inbox")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Messages.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Messages.html");
            if (role === "faculty") {
                return resolveRelativeUrl("Faculty/Messages.html");
            }
        }

        // 2. PROFILE / SETTINGS / ACCOUNT
        if (
            combined.includes("profile") ||
            combined.includes("settings") ||
            combined.includes("account") ||
            combined.includes("password")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Settings.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Settings.html");
            if (role === "faculty") return resolveRelativeUrl("Faculty/Settings.html");
        }

        // 2.5 DEFENSE MINUTES & DEPLOYMENT RECOMMENDATION E-SIGNATURE WORKFLOW
        if (type === "defense minutes" || combined.includes("defense minutes")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            if (role === "faculty" || role === "admin") {
                if (
                    combined.includes("panelist document review") ||
                    combined.includes("ready for e-signature") ||
                    activePath.includes("/panelist/")
                ) {
                    return resolveRelativeUrl("Faculty/Panelist/Document_Review.html");
                }
                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }
        }

        if (combined.includes("recommendation for deployment")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            if (combined.includes("panelist") && (hasPanelistAccess || role === "faculty" || activePath.includes("/panelist/"))) {
                return resolveRelativeUrl("Faculty/Panelist/Document_Review.html");
            }
            if ((combined.includes("chairperson") || combined.includes("dean")) && role === "admin") {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }
            if (role === "admin" && !hasAdviserAccess) {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }
            if (hasAdviserAccess || role === "faculty") {
                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }
        }

        // 3. DEFENSE / SCHEDULE / EVALUATION / PANELIST / GRADING
        // Checked before generic document matching so "Concept Presentation" defense schedules route here.
        if (
            type === "defense schedule" ||
            type === "defense evaluation" ||
            type === "defense" ||
            combined.includes("defense") ||
            combined.includes("panelist") ||
            combined.includes("panel assignment") ||
            combined.includes("panel evaluation") ||
            combined.includes("grading") ||
            (combined.includes("schedule") && !combined.includes("consultation"))
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Defense_Schedule.html");

            if (role === "faculty" || role === "admin") {
                // Explicit panelist assignment or cancellation goes to Assigned Defenses
                if (
                    combined.includes("panelist") ||
                    combined.includes("panel assignment") ||
                    combined.includes("assigned as a panelist") ||
                    title.includes("defense created") ||
                    title.includes("defense scheduled")
                ) {
                    if (hasPanelistAccess || role === "faculty") {
                        return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
                    }
                }

                // Completed / evaluation notifications go to Panel Evaluation for instructors
                if (
                    type === "defense evaluation" ||
                    combined.includes("evaluation") ||
                    combined.includes("completed")
                ) {
                    if (hasInstructorAccess) {
                        return resolveRelativeUrl("Faculty/Instructor/Panel_Evaluation.html");
                    }
                    if (hasPanelistAccess) {
                        return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
                    }
                    if (hasAdviserAccess) {
                        return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
                    }
                }

                // Respect active sub-portal if currently browsing one
                if (activePath.includes("/panelist/") || facultyRole === "panelist" || sessionRole === "panelist") {
                    return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
                }
                if (activePath.includes("/adviser/") || facultyRole === "adviser" || sessionRole === "adviser") {
                    return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
                }
                if (activePath.includes("/instructor/") || facultyRole === "instructor" || sessionRole === "instructor") {
                    return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
                }

                // Fallback by granted access
                if (hasPanelistAccess && !hasInstructorAccess) {
                    return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
                }
                if (hasInstructorAccess) {
                    return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
                }
                if (hasAdviserAccess) {
                    return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
                }
                if (role === "admin") {
                    return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
                }
                return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
            }
        }

        // 4. ADVISER REQUEST / ADVISORY / TITLE PROPOSALS
        if (
            combined.includes("adviser request") ||
            combined.includes("adviser acceptance") ||
            combined.includes("acceptance for advisory") ||
            combined.includes("title proposal") ||
            combined.includes("proposed title")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Req_Adviser.html");
            if (role === "faculty" || (role === "admin" && hasAdviserAccess)) {
                return resolveRelativeUrl("Faculty/Adviser/Adviser_Request.html");
            }
            if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
        }

        // 4.5 CONSULTATIONS
        if (combined.includes("consultation") || type === "consultation") {
            if (role === "student") return resolveRelativeUrl("Student/Consultation.html");
            if (role === "faculty" || role === "admin") {
                if (activePath.includes("/instructor/") || position.includes("instructor") || facultyRole === "instructor" || sessionRole === "instructor") {
                    return resolveRelativeUrl("Faculty/Instructor/Consultation.html");
                }
                return resolveRelativeUrl("Faculty/Adviser/Consultation.html");
            }
        }

        // 5. DOCUMENTS / SIGNING / E-SIGNATURE / ENVIRONMENTAL SCANNING / REVISION / CONCEPT PRESENTATION
        if (
            combined.includes("document") ||
            combined.includes("signing") ||
            combined.includes("signature") ||
            combined.includes("environmental scanning") ||
            combined.includes("concept presentation") ||
            combined.includes("concept paper") ||
            combined.includes("recommendation") ||
            combined.includes("review") ||
            combined.includes("revision") ||
            combined.includes("manuscript")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            if (role === "admin") {
                if (combined.includes("adviser") && hasAdviserAccess) {
                    return resolveRelativeUrl("Faculty/Adviser/Documents.html");
                }
                if (combined.includes("instructor") && hasInstructorAccess) {
                    return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
                }
                return resolveRelativeUrl("Admin/Document_Review.html");
            }
            if (role === "faculty") {
                // If message specifically indicates adviser or user is currently inside Adviser portal
                if (combined.includes("adviser") || facultyRole === "adviser" || sessionRole === "adviser" || activePath.includes("/adviser/")) {
                    return resolveRelativeUrl("Faculty/Adviser/Documents.html");
                }

                if (combined.includes("instructor") || facultyRole === "instructor" || sessionRole === "instructor" || activePath.includes("/instructor/")) {
                    return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
                }

                if (position.includes("adviser") && !position.includes("instructor")) {
                    return resolveRelativeUrl("Faculty/Adviser/Documents.html");
                }

                if (position.includes("instructor") || position.includes("chairperson")) {
                    return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
                }

                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }
        }

        // 6. ANNOUNCEMENTS
        if (combined.includes("announcement") || type === "announcement") {
            if (role === "student") return resolveRelativeUrl("Student/StudentDash.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Announcements.html");
            if (role === "faculty") return resolveRelativeUrl("Faculty/Announcements.html");
        }

        // Fallback
        return getNotificationsPageUrl();
    }

    function getActiveFacultySubPortal() {
        const activePath = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
        const facultyRole = String(localStorage.getItem("facultyRole") || "").toLowerCase().trim();
        const sessionRole = String(sessionStorage.getItem("active_faculty_role") || "").toLowerCase().trim();

        for (const sub of ["adviser", "instructor", "panelist"]) {
            if (activePath.includes(`/${sub}/`)) return sub;
        }
        for (const sub of ["adviser", "instructor", "panelist"]) {
            if (sessionRole === sub || facultyRole === sub) return sub;
        }
        return "";
    }

    const SUB_PORTAL_DASHBOARDS = {
        adviser: "Faculty/Adviser/AdviserDash.html",
        instructor: "Faculty/Instructor/InstructorDash.html",
        panelist: "Faculty/Panelist/PanelistDash.html"
    };

    // Clicking a notification in the bell opens the dashboard of the portal
    // (Admin / Faculty / Adviser / Instructor / Panelist / Student) the notification belongs to.
    function getNotificationDashboardUrl(item) {
        const role = String(localStorage.getItem("role") || "").toLowerCase().trim();
        let abs = "";

        try {
            abs = new URL(String(getNotificationTargetUrl(item) || ""), window.location.href)
                .pathname.replace(/\\/g, "/").toLowerCase();
        } catch (e) {
            abs = "";
        }

        let dash = "";

        if (abs.includes("/student/")) {
            dash = "Student/StudentDash.html";
        } else if (abs.includes("/admin/")) {
            dash = "Admin/AdminDash.html";
        } else if (abs.includes("/faculty/adviser/")) {
            dash = SUB_PORTAL_DASHBOARDS.adviser;
        } else if (abs.includes("/faculty/instructor/")) {
            dash = SUB_PORTAL_DASHBOARDS.instructor;
        } else if (abs.includes("/faculty/panelist/")) {
            dash = SUB_PORTAL_DASHBOARDS.panelist;
        } else if (abs.includes("/faculty/")) {
            dash = SUB_PORTAL_DASHBOARDS[getActiveFacultySubPortal()] || "Faculty/FacultyDash.html";
        } else if (role === "student") {
            dash = "Student/StudentDash.html";
        } else if (role === "admin") {
            dash = "Admin/AdminDash.html";
        } else {
            dash = SUB_PORTAL_DASHBOARDS[getActiveFacultySubPortal()] || "Faculty/FacultyDash.html";
        }

        return resolveRelativeUrl(dash);
    }

    function formatNotificationTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const now = new Date();
        const diffMs = now - date;

        if (diffMs < 60000) {
            return "Just now";
        }

        if (diffMs < 3600000) {
            const mins = Math.floor(diffMs / 60000);
            return `${mins}m ago`;
        }

        if (diffMs < 86400000) {
            const hours = Math.floor(diffMs / 3600000);
            return `${hours}h ago`;
        }

        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        });
    }

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function ensureTopActionsHost(topbar) {
        let actions = topbar.querySelector(".top-actions");

        if (actions) {
            return actions;
        }

        actions = document.createElement("div");
        actions.className = "top-actions";

        const welcome = topbar.querySelector(".welcome");
        const looseSelectors =
            ".search-box, .edit-btn, .back-btn, .refresh-btn, .profile-btn";

        const looseNodes = Array.from(topbar.children).filter((node) => {
            if (node.classList.contains("welcome") || node.classList.contains("top-actions")) {
                return false;
            }

            return node.matches(looseSelectors);
        });

        let welcomeBlock = welcome;

        if (!welcomeBlock) {
            const looseHeadings = Array.from(topbar.children).filter((node) =>
                node.matches("h1, p")
            );

            if (looseHeadings.length) {
                welcomeBlock = document.createElement("div");
                welcomeBlock.className = "welcome";
                looseHeadings.forEach((node) => welcomeBlock.appendChild(node));
                topbar.insertBefore(welcomeBlock, topbar.firstChild);
            }
        }

        if (welcomeBlock) {
            welcomeBlock.insertAdjacentElement("afterend", actions);
        } else {
            topbar.appendChild(actions);
        }

        looseNodes.forEach((node) => {
            actions.appendChild(node);
        });

        if (!actions.parentElement) {
            topbar.appendChild(actions);
        }

        return actions;
    }

    function buildBellMarkup() {
        return `
            <div class="portal-notif-wrap" id="portalNotifWrap">
                <button
                    type="button"
                    class="portal-notif-bell"
                    id="portalNotifBell"
                    aria-label="Notifications"
                    aria-expanded="false"
                >
                    <i class="fa-solid fa-bell"></i>
                    <span class="portal-notif-dot" id="portalNotifDot" hidden></span>
                </button>
                <div class="portal-notif-dropdown" id="portalNotifDropdown">
                    <div class="portal-notif-dropdown-head">
                        <strong>Notifications</strong>
                    </div>
                    <div class="portal-notif-dropdown-list" id="portalNotifList"></div>
                    <a class="portal-notif-view-all" id="portalNotifViewAll" href="#">View all</a>
                </div>
            </div>
        `;
    }

    const PortalNotifications = {
        unreadCount: 0,
        cachedNotifications: [],
        cachedNotificationsJson: "",
        pollTimer: null,
        isDropdownOpen: false,

        init() {
            const userId = getLoggedInUserId();

            if (!userId || !document.body.classList.contains("admin-portal")) {
                return;
            }

            this.injectMobileDrawer();
            this.injectBell();
            this.bindEvents();
            this.refresh(true);
            this.startPolling();

            document.addEventListener("visibilitychange", () => {
                this.startPolling();
                if (!document.hidden) {
                    this.refresh(false);
                }
            });
        },

        injectMobileDrawer() {
            const sidebar = document.querySelector(".sidebar.admin-sidebar");
            if (!sidebar || document.getElementById("mobileMenuToggleBtn")) {
                return;
            }

            let backdrop = document.getElementById("mobileSidebarBackdrop");
            if (!backdrop) {
                backdrop = document.createElement("div");
                backdrop.id = "mobileSidebarBackdrop";
                backdrop.className = "mobile-sidebar-backdrop";
                document.body.appendChild(backdrop);
            }

            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.id = "mobileMenuToggleBtn";
            toggleBtn.className = "mobile-menu-toggle";
            toggleBtn.setAttribute("aria-label", "Toggle navigation menu");
            toggleBtn.innerHTML = `<i class="fa-solid fa-bars"></i>`;

            const header =
                document.querySelector(".admin-main .topbar")
                || document.querySelector(".topbar")
                || document.querySelector(".admin-main .admin-header")
                || document.querySelector(".admin-header");

            if (header) {
                header.insertBefore(toggleBtn, header.firstChild);
            } else {
                const main = document.querySelector(".admin-main") || document.body;
                main.insertBefore(toggleBtn, main.firstChild);
            }

            const closeDrawer = () => {
                document.body.classList.remove("mobile-sidebar-open");
                backdrop.classList.remove("is-open");
            };

            toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = document.body.classList.toggle("mobile-sidebar-open");
                backdrop.classList.toggle("is-open", isOpen);
            });

            backdrop.addEventListener("click", closeDrawer);
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closeDrawer();
            });
        },

        startPolling() {
            if (this.pollTimer) {
                window.clearInterval(this.pollTimer);
            }

            const interval =
                document.hidden
                ? POLL_HIDDEN_MS
                : POLL_MS;

            this.pollTimer = window.setInterval(() => {
                this.refresh(false);
            }, interval);
        },

        isDropdownVisible() {
            const dropdown = document.getElementById("portalNotifDropdown");
            return Boolean(dropdown && dropdown.classList.contains("is-open"));
        },

        isNotificationsFullPage() {
            const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
            return path.endsWith("/notifications.html") || path.endsWith("notifications.html");
        },

        injectBell() {
            const topbar =
                document.querySelector(".admin-main .topbar")
                || document.querySelector(".topbar")
                || document.querySelector(".admin-main .admin-header")
                || document.querySelector(".admin-header");

            if (!topbar || document.getElementById("portalNotifWrap")) {
                return;
            }

            if (topbar.classList.contains("admin-header")) {
                topbar.style.display = "flex";
                topbar.style.justifyContent = "space-between";
                topbar.style.alignItems = "center";
            }

            if (this.isNotificationsFullPage()) {
                document.body.classList.add("notifications-full-page");
            }

            const actions = ensureTopActionsHost(topbar);
            const temp = document.createElement("div");
            temp.innerHTML = buildBellMarkup().trim();
            const bellNode = temp.firstElementChild;

            actions.insertBefore(bellNode, actions.firstChild);

            const viewAll = document.getElementById("portalNotifViewAll");

            if (viewAll) {
                viewAll.href = getNotificationsPageUrl();
            }
        },

        bindEvents() {
            const bell = document.getElementById("portalNotifBell");
            const dropdown = document.getElementById("portalNotifDropdown");
            const wrap = document.getElementById("portalNotifWrap");

            if (!bell || !dropdown || !wrap) {
                return;
            }

            bell.addEventListener("click", async (event) => {
                event.stopPropagation();
                const isOpen = dropdown.classList.contains("is-open");

                if (!isOpen) {
                    this.setDropdownOpen(true);
                    await this.refresh(true);
                } else {
                    this.setDropdownOpen(false);
                }
            });

            const viewAll = document.getElementById("portalNotifViewAll");

            if (viewAll) {
                viewAll.addEventListener("click", async (event) => {
                    event.preventDefault();
                    await this.markAllUnreadAsChecked();
                    window.location.href = getNotificationsPageUrl();
                });
            }

            document.addEventListener("click", (event) => {
                const dropdownEl = document.getElementById("portalNotifDropdown");

                if (
                    !wrap.contains(event.target)
                    && !(dropdownEl && dropdownEl.contains(event.target))
                ) {
                    this.setDropdownOpen(false);
                }
            });
        },

        positionDropdown() {
            const bell = document.getElementById("portalNotifBell");
            const dropdown = document.getElementById("portalNotifDropdown");

            if (!bell || !dropdown) {
                return;
            }

            const rect = bell.getBoundingClientRect();
            const panelWidth = Math.min(340, window.innerWidth - 24);
            let left = rect.right - panelWidth;

            left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

            dropdown.style.position = "fixed";
            dropdown.style.top = `${rect.bottom + 8}px`;
            dropdown.style.left = `${left}px`;
            dropdown.style.right = "auto";
            dropdown.style.width = `${panelWidth}px`;
            dropdown.style.zIndex = "10000";
        },

        setDropdownOpen(open) {
            const bell = document.getElementById("portalNotifBell");
            const dropdown = document.getElementById("portalNotifDropdown");
            const wrap = document.getElementById("portalNotifWrap");

            if (!bell || !dropdown || !wrap) {
                return;
            }

            this.isDropdownOpen = open;

            if (open) {
                document.body.appendChild(dropdown);
                dropdown.classList.add("is-open");
                this.positionDropdown();
                bell.setAttribute("aria-expanded", "true");
                window.addEventListener("resize", this._onReposition);
                window.addEventListener("scroll", this._onReposition, true);
            } else {
                dropdown.classList.remove("is-open");
                dropdown.removeAttribute("style");
                wrap.appendChild(dropdown);
                bell.setAttribute("aria-expanded", "false");
                window.removeEventListener("resize", this._onReposition);
                window.removeEventListener("scroll", this._onReposition, true);
            }
        },

        _onReposition() {
            if (document.getElementById("portalNotifDropdown")?.classList.contains("is-open")) {
                PortalNotifications.positionDropdown();
            }
        },

        async refresh(showLoading) {
            const userId = getLoggedInUserId();

            if (!userId) {
                return;
            }

            const list = document.getElementById("portalNotifList");
            const isFullPage = this.isNotificationsFullPage();
            const dropdownOpen =
                showLoading || this.isDropdownVisible() || isFullPage;

            const limit =
                isFullPage
                ? 100
                : (dropdownOpen ? DROPDOWN_LIMIT : 0);

            if (showLoading && list) {
                list.innerHTML = `<div class="portal-notif-empty">Loading...</div>`;
            }

            try {
                const response = await fetch(
                    `${API_BASE}/portal-notifications/${encodeURIComponent(userId)}?limit=${limit}`
                );

                const data = await response.json();

                if (!data.success) {
                    if (dropdownOpen) {
                        this.renderList([]);
                    }

                    this.unreadCount = 0;
                    this.updateDot(0);
                    return;
                }

                const nextUnread =
                    Number(data.unread_count || 0);
                const notifications = data.notifications || [];
                const notificationsStr = JSON.stringify(notifications);

                const changed = (nextUnread !== this.unreadCount) || (notificationsStr !== this.cachedNotificationsJson);

                this.unreadCount = nextUnread;
                this.cachedNotificationsJson = notificationsStr;
                this.updateDot(nextUnread);
                this.syncSidebarDots(nextUnread, changed);

                if (dropdownOpen) {
                    this.cachedNotifications = notifications;
                    if (this.isDropdownVisible()) {
                        this.renderList(this.cachedNotifications);
                    }
                }

                if (changed && isFullPage) {
                    if (typeof window.loadPortalNotificationsPage === "function") {
                        window.loadPortalNotificationsPage(true);
                    } else if (typeof window.loadStudentNotifications === "function") {
                        window.loadStudentNotifications(true);
                    }
                }
            } catch (error) {
                console.log(error);

                if (showLoading && list) {
                    list.innerHTML = `<div class="portal-notif-empty">Unable to load notifications.</div>`;
                }
            }
        },

        async markAllUnreadAsChecked(skipRender = false) {
            const userId = getLoggedInUserId();

            if (!userId || this.unreadCount <= 0) {
                this.updateDot(0);
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE}/portal-notifications-read-all`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ userId })
                    }
                );

                const data = await response.json();

                if (!data.success) {
                    return;
                }

                this.unreadCount = 0;
                this.updateDot(0);

                this.cachedNotifications =
                    (this.cachedNotifications || []).map((item) => ({
                        ...item,
                        is_read: 1
                    }));

                if (!skipRender && this.isDropdownVisible()) {
                    this.renderList(this.cachedNotifications);
                }
            } catch (error) {
                console.log(error);
            }
        },

        ensureSidebarDotStyle() {
            if (document.getElementById("portalSidebarDotStyle")) return;
            const style = document.createElement("style");
            style.id = "portalSidebarDotStyle";
            style.textContent = `
                .sidebar .menu-item { position: relative; }
                .sidebar-new-dot {
                    width: 9px; height: 9px; min-width: 9px;
                    margin-left: auto; border-radius: 50%;
                    background: #ef4444;
                    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.28);
                    flex-shrink: 0;
                }
            `;
            document.head.appendChild(style);
        },

        getSidebarItems() {
            const items = [];
            document.querySelectorAll(".sidebar .menu-item").forEach((el) => {
                let href = "";
                const onclick = el.getAttribute("onclick") || "";
                const m = onclick.match(/location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
                if (m) {
                    href = m[1];
                } else if (el.tagName === "A") {
                    href = el.getAttribute("href") || "";
                } else {
                    const a = el.querySelector("a[href]");
                    if (a) href = a.getAttribute("href") || "";
                }
                if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
                try {
                    const path = new URL(href, window.location.href).pathname.replace(/\\/g, "/").toLowerCase();
                    items.push({ el, path });
                } catch (e) { /* ignore */ }
            });
            return items;
        },

        // Puts a red dot on each sidebar item whose page has unread notifications.
        // Opening that page marks its notifications as read, which clears the dot.
        async syncSidebarDots(unreadNow, force) {
            const userId = getLoggedInUserId();
            if (!userId || this._dotsBusy) return;
            if (!force && unreadNow === this._dotsUnread) return;

            this._dotsBusy = true;

            try {
                const response = await fetch(
                    `${API_BASE}/portal-notifications/${encodeURIComponent(userId)}?limit=100`
                );
                const data = await response.json();
                if (!data.success) return;

                this._dotsUnread = Number(data.unread_count || 0);
                const unread = (data.notifications || []).filter((n) => Number(n.is_read) === 0);
                const toPath = (url) => {
                    try {
                        return new URL(url, window.location.href).pathname.replace(/\\/g, "/").toLowerCase();
                    } catch (e) {
                        return "";
                    }
                };
                const here = toPath(window.location.href);
                const byPage = new Map();

                unread.forEach((n) => {
                    const p = toPath(getNotificationTargetUrl(n));
                    if (!p) return;
                    if (!byPage.has(p)) byPage.set(p, []);
                    byPage.get(p).push(n.id);
                });

                // Visiting a page counts as seeing its notifications.
                if (!this.isNotificationsFullPage() && byPage.has(here)) {
                    const ids = byPage.get(here);
                    byPage.delete(here);
                    this._dotsUnread = -1;
                    for (const id of ids) {
                        await this.markRead(id);
                    }
                }

                this.ensureSidebarDotStyle();

                this.getSidebarItems().forEach(({ el, path }) => {
                    const isNotifPage = path.endsWith("/notifications.html");
                    const shouldShow = isNotifPage
                        ? (unread.length > 0 && path !== here)
                        : byPage.has(path);
                    const existing = el.querySelector(".sidebar-new-dot");

                    if (shouldShow && !existing) {
                        const dot = document.createElement("span");
                        dot.className = "sidebar-new-dot";
                        dot.setAttribute("title", "New notification");
                        el.appendChild(dot);
                    } else if (!shouldShow && existing) {
                        existing.remove();
                    }
                });
            } catch (error) {
                console.log(error);
            } finally {
                this._dotsBusy = false;
            }
        },

        updateDot(count) {
            const dot = document.getElementById("portalNotifDot");

            if (!dot) {
                return;
            }

            if (count > 0) {
                dot.hidden = false;
                dot.style.display = "block";
                dot.setAttribute("title", `${count} unread`);
            } else {
                dot.hidden = true;
                dot.style.display = "none";
                dot.removeAttribute("title");
            }
        },

        renderList(items) {
            const list = document.getElementById("portalNotifList");

            if (!list) {
                return;
            }

            if (!items.length) {
                list.innerHTML = `<div class="portal-notif-empty">No notifications yet.</div>`;
                return;
            }

            list.innerHTML = items.map((item) => {
                const unread = Number(item.is_read) === 0;
                const title = escapeHtml(item.notification_title);
                const message = escapeHtml(item.notification_message);
                const type = escapeHtml(item.notification_type || "System");
                const time = formatNotificationTime(item.created_at);

                return `
                    <button
                        type="button"
                        class="portal-notif-item${unread ? " unread" : ""}"
                        data-notification-id="${item.id}"
                    >
                        <div class="portal-notif-item-top">
                            <span class="portal-notif-item-title">${title}</span>
                            <span class="portal-notif-item-time">${time}</span>
                        </div>
                        <span class="portal-notif-item-type">${type}</span>
                        <span class="portal-notif-item-msg">${message}</span>
                    </button>
                `;
            }).join("");

            list.querySelectorAll(".portal-notif-item").forEach((node) => {
                node.addEventListener("click", async () => {
                    const id = node.getAttribute("data-notification-id");
                    const item = (this.cachedNotifications || []).find((n) => String(n.id) === String(id));
                    await this.markRead(id);
                    const targetUrl = getNotificationDashboardUrl(item);
                    if (targetUrl) {
                        window.location.href = targetUrl;
                    }
                });
            });
        },

        async markRead(notificationId) {
            const userId = getLoggedInUserId();

            if (!notificationId || !userId) {
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE}/portal-notification-read/${encodeURIComponent(notificationId)}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ userId })
                    }
                );

                const data = await response.json();

                if (!data.success) {
                    return;
                }

                const wasUnread =
                    (this.cachedNotifications || []).some((item) =>
                        String(item.id) === String(notificationId)
                        && Number(item.is_read) === 0
                    );

                this.cachedNotifications =
                    (this.cachedNotifications || []).map((item) =>
                        String(item.id) === String(notificationId)
                        ? { ...item, is_read: 1 }
                        : item
                    );

                if (wasUnread) {
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateDot(this.unreadCount);
                }

                if (this.isDropdownVisible()) {
                    this.renderList(this.cachedNotifications);
                }
            } catch (error) {
                console.log(error);
            }
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => PortalNotifications.init());
    } else {
        PortalNotifications.init();
    }

    PortalNotifications.getNotificationTargetUrl = getNotificationTargetUrl;
    PortalNotifications.getNotificationDashboardUrl = getNotificationDashboardUrl;
    window.PortalNotifications = PortalNotifications;

})();
