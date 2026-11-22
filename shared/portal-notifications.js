(function () {

    const API_BASE = "";
    const POLL_MS = 4000;
    const POLL_HIDDEN_MS = 45000;
    const DROPDOWN_LIMIT = 8;

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

    function isAdminOrFacultyRole() {
        const role = String(localStorage.getItem("role") || "").toLowerCase().trim();
        return role === "admin" || role === "faculty";
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

    function trackActiveSubPortal() {
        const activePath = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
        if (activePath.includes("/faculty/adviser/")) {
            sessionStorage.setItem("active_faculty_role", "Adviser");
        } else if (activePath.includes("/faculty/instructor/")) {
            sessionStorage.setItem("active_faculty_role", "Instructor");
        } else if (activePath.includes("/faculty/panelist/")) {
            sessionStorage.setItem("active_faculty_role", "Panelist");
        }
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

    // Strict deterministic notification target resolver (never guesses from activePath or stale localStorage.facultyRole)
    function getNotificationTargetUrl(item) {
        if (!item) {
            return getNotificationsPageUrl();
        }

        const title = String(item.notification_title || "").toLowerCase().trim();
        const message = String(item.notification_message || "").toLowerCase().trim();
        const type = String(item.notification_type || "").toLowerCase().trim();
        const combined = `${title} ${message} ${type}`;

        const role = String(localStorage.getItem("role") || "").toLowerCase().trim();
        const position = String(localStorage.getItem("position") || "").toLowerCase().trim();
        const hasPanelistAccess = localStorage.getItem("panelist_access") === "1";
        const hasInstructorAccess = localStorage.getItem("instructor_access") === "1";
        const hasAdviserAccess = localStorage.getItem("adviser_access") === "1";

        // 1. Announcements
        if (type === "announcement" || title.startsWith("new announcement")) {
            if (role === "admin") return resolveRelativeUrl("Admin/Announcements.html");
            if (role === "student") return resolveRelativeUrl("Student/StudentDash.html");
            return resolveRelativeUrl("Faculty/Announcements.html");
        }

        // 2. Messages / Chat
        if (
            type === "message" ||
            title.includes("new message") ||
            title.includes("message") ||
            combined.includes("sent you a message")
        ) {
            const curPath = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
            if (curPath.includes("/faculty/panelist/")) return resolveRelativeUrl("Faculty/Panelist/Messages.html");
            if (role === "student") return resolveRelativeUrl("Student/Messages.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Messages.html");
            return resolveRelativeUrl("Faculty/Messages.html");
        }

        // 3. Account / Security / Settings
        if (
            title.includes("security update") ||
            combined.includes("password has been changed") ||
            combined.includes("profile updated")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Settings.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Settings.html");
            return resolveRelativeUrl("Faculty/Settings.html");
        }

        // 4. Defense Minutes E-Signature Workflow
        if (type === "defense minutes" || combined.includes("defense minutes")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            if (
                combined.includes("panelist document review") ||
                title.includes("ready for e-signature") ||
                title.includes("updated defense minutes for review") ||
                combined.includes("open for your e-signature")
            ) {
                return resolveRelativeUrl("Faculty/Panelist/Document_Review.html");
            }
            return resolveRelativeUrl("Faculty/Adviser/Documents.html");
        }

        // 5. Recommendation for Deployment (check Chairperson/Dean BEFORE Panelist!)
        if (combined.includes("recommendation for deployment")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            if (
                combined.includes("pending your chairperson signature") ||
                combined.includes("pending your signature") ||
                combined.includes("pending chairperson") ||
                combined.includes("pending dean") ||
                title.includes("chairperson") ||
                title.includes("dean")
            ) {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }
            if (
                combined.includes("pending a panelist e-signature") ||
                combined.includes("panelist e-signature")
            ) {
                return resolveRelativeUrl("Faculty/Panelist/Document_Review.html");
            }
            if (hasAdviserAccess || role === "faculty") {
                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }
            return resolveRelativeUrl("Admin/Document_Review.html");
        }

        // 6. Adviser Requests / Title Proposals
        if (
            type === "adviser request" ||
            title.includes("adviser request") ||
            combined.includes("requested you as their adviser") ||
            combined.includes("adviser assignment")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Req_Adviser.html");
            return resolveRelativeUrl("Faculty/Adviser/Adviser_Request.html");
        }

        // 7. Consultations
        if (type === "consultation" || combined.includes("consultation")) {
            if (role === "student") return resolveRelativeUrl("Student/Consultation.html");
            if (combined.includes("instructor") && hasInstructorAccess) {
                return resolveRelativeUrl("Faculty/Instructor/Consultation.html");
            }
            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Consultation.html");
            if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Consultation.html");
            return resolveRelativeUrl("Faculty/Adviser/Consultation.html");
        }

        // 8. Defense Evaluation & Schedules
        if (
            type === "defense evaluation" ||
            type === "defense schedule" ||
            type === "defense" ||
            title.includes("panel evaluation") ||
            title.includes("defense schedule") ||
            title.includes("defense completed") ||
            title.includes("defense evaluation")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Defense_Schedule.html");

            if (
                title.includes("panel evaluation submitted") ||
                title.includes("panel evaluations complete") ||
                combined.includes("please create schedule again")
            ) {
                return resolveRelativeUrl("Faculty/Instructor/Panel_Evaluation.html");
            }

            if (
                combined.includes("assigned as a panelist") ||
                combined.includes("panelist") ||
                title.includes("defense schedule")
            ) {
                if (hasPanelistAccess) return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
                if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
                if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
            }

            if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
            if (hasPanelistAccess) return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
            return getNotificationsPageUrl();
        }

        // 9. Document Review / Signing / Environmental Scanning / Submissions
        if (
            type === "document" ||
            type === "document review" ||
            combined.includes("document") ||
            combined.includes("environmental scanning") ||
            combined.includes("adviser acceptance") ||
            combined.includes("acceptance for advisory") ||
            combined.includes("signature") ||
            combined.includes("recommendation") ||
            combined.includes("concept paper")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");

            if (
                role === "admin" && (
                    combined.includes("pending your signature") ||
                    combined.includes("pending dean") ||
                    combined.includes("pending chairperson") ||
                    title.includes("adviser acceptance form") ||
                    title.includes("environmental scanning") ||
                    title.includes("declined by organization") ||
                    position.includes("dean") ||
                    position.includes("chairperson")
                ) && !title.includes("new document submission")
            ) {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }

            if (combined.includes("environmental scanning")) {
                if (role === "admin" && (position.includes("dean") || position.includes("chairperson")) && !title.includes("new document submission")) {
                    return resolveRelativeUrl("Admin/Document_Review.html");
                }
                if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
                if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
            }

            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
            return resolveRelativeUrl("Faculty/Adviser/Documents.html");
        }

        return getNotificationsPageUrl();
    }

    function getNotificationDashboardUrl(item) {
        if (isAdminOrFacultyRole()) {
            return getNotificationsPageUrl();
        }
        return getNotificationTargetUrl(item);
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
                    title="Notifications"
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
        sectionCounts: {},
        cachedNotifications: [],
        cachedNotificationsJson: "",
        pollTimer: null,
        isDropdownOpen: false,
        _refreshBusy: false,
        _markedCurrentSection: false,

        init() {
            const userId = getLoggedInUserId();

            if (!userId || !document.body.classList.contains("admin-portal")) {
                return;
            }

            trackActiveSubPortal();
            this.injectMobileDrawer();
            this.injectBell();
            this.bindNotificationsSidebarLinks();
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

        // Ensure Notifications sidebar links inside Adviser/Panelist/Instructor route Admin users to Admin/Notifications.html
        // and Faculty users to Faculty/Notifications.html
        bindNotificationsSidebarLinks() {
            document.querySelectorAll('.sidebar .menu-item[data-notif-nav="1"], .sidebar .menu-item#nav-notifications').forEach((el) => {
                if (el.dataset.notifBound === "1") return;
                el.dataset.notifBound = "1";
                el.removeAttribute("onclick");
                el.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = getNotificationsPageUrl();
                });
            });
        },

        openNotificationsPage() {
            window.location.href = getNotificationsPageUrl();
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

            const sidebarLogo = sidebar.querySelector(".logo");
            if (sidebarLogo && !document.getElementById("mobileSidebarCloseBtn")) {
                const closeBtn = document.createElement("button");
                closeBtn.type = "button";
                closeBtn.id = "mobileSidebarCloseBtn";
                closeBtn.className = "mobile-sidebar-close";
                closeBtn.setAttribute("aria-label", "Close navigation menu");
                closeBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
                closeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    closeDrawer();
                });
                sidebarLogo.appendChild(closeBtn);
            }

            toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = document.body.classList.toggle("mobile-sidebar-open");
                backdrop.classList.toggle("is-open", isOpen);
            });

            sidebar.querySelectorAll(".menu-item").forEach((item) => {
                item.addEventListener("click", () => {
                    if (window.innerWidth <= 768) {
                        closeDrawer();
                    }
                });
            });

            backdrop.addEventListener("click", closeDrawer);
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closeDrawer();
            });
            window.addEventListener("resize", () => {
                if (window.innerWidth > 768 && document.body.classList.contains("mobile-sidebar-open")) {
                    closeDrawer();
                }
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
                    this.setDropdownOpen(false);
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

        getCurrentNormalizedPath() {
            try {
                return new URL(window.location.href).pathname.replace(/\\/g, "/").toLowerCase();
            } catch (e) {
                return "";
            }
        },

        async refresh(showLoading) {
            const userId = getLoggedInUserId();

            if (!userId) {
                return;
            }

            if (this._refreshBusy && !showLoading) {
                return;
            }
            this._refreshBusy = true;

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
                    `${API_BASE}/api/portal-notifications/summary/${encodeURIComponent(userId)}?limit=${limit}`,
                    { cache: "no-store" }
                );

                const data = await response.json();

                if (!data.success) {
                    if (dropdownOpen) {
                        this.renderList([]);
                    }

                    this.unreadCount = 0;
                    this.sectionCounts = {};
                    this.updateDot(0);
                    this.renderSidebarDots({}, 0);
                    return;
                }

                const nextUnread = Number(data.unread_count || 0);
                const notifications = data.notifications || [];

                const notificationsStr = JSON.stringify(notifications);
                const changed = (nextUnread !== this.unreadCount) || (notificationsStr !== this.cachedNotificationsJson);

                this.unreadCount = nextUnread;
                this.sectionCounts = {};
                this.cachedNotificationsJson = notificationsStr;
                this.updateDot(nextUnread);
                this.renderSidebarDots({}, 0);

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
            } finally {
                this._refreshBusy = false;
            }
        },

        async markAllUnreadAsChecked(skipRender = false) {
            const userId = getLoggedInUserId();

            if (!userId || this.unreadCount <= 0) {
                this.updateDot(0);
                this.renderSidebarDots({}, 0);
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE}/api/portal-notifications/read-all`,
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
                this.sectionCounts = {};
                this.updateDot(0);
                this.renderSidebarDots({}, 0);

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
                .sidebar-notif-badge {
                    margin-left: auto;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 6px;
                    border-radius: 999px;
                    background: #ef4444;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 20px;
                    text-align: center;
                    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.28);
                    flex-shrink: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
            `;
            document.head.appendChild(style);
        },

        getSidebarItems() {
            const items = [];
            document.querySelectorAll(".sidebar .menu-item").forEach((el) => {
                const isNotifAttr = el.id === "nav-notifications" || el.getAttribute("data-notif-nav") === "1";
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
                if (isNotifAttr && !href) {
                    href = getNotificationsPageUrl();
                }
                if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
                try {
                    const path = new URL(href, window.location.href).pathname.replace(/\\/g, "/").toLowerCase();
                    const isNotifItem = isNotifAttr || path.endsWith("/notifications.html");
                    items.push({ el, path, isNotifItem });
                } catch (e) { /* ignore */ }
            });
            return items;
        },

        renderSidebarDots() {
            // Sidebar red dots and badges are disabled; clean up any stale elements
            document.querySelectorAll(".sidebar .sidebar-new-dot, .sidebar .sidebar-notif-badge").forEach((node) => {
                node.remove();
            });
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
                const rawTitle = String(item.notification_title || "");
                const rawMsg = String(item.notification_message || "");
                const title = escapeHtml(rawTitle);
                const type = escapeHtml(item.notification_type || "System");
                const time = formatNotificationTime(item.created_at);

                const noteMatch = rawMsg.match(/\n\n(Adviser Feedback|Adviser Note|Panelist Note(?:\s*\([^)]+\))?|Feedback|Comment):\n([\s\S]*)$/i);
                const mainMsg = noteMatch ? rawMsg.substring(0, noteMatch.index) : rawMsg;
                const noteLabel = noteMatch ? noteMatch[1] : "";
                const feedbackMsg = noteMatch ? noteMatch[2].trim() : "";

                const isDeclined = rawTitle.toLowerCase().includes("declined") || rawTitle.toLowerCase().includes("rejected") || rawTitle.toLowerCase().includes("revision") || rawMsg.toLowerCase().includes("declined");
                const feedbackHtml = feedbackMsg
                    ? `<span class="portal-notif-item-feedback" style="display:block; margin-top:7px; padding:8px 10px; border-radius:9px; background:${isDeclined ? "#fef2f2" : "#f5f3ff"}; border:1px solid ${isDeclined ? "#fecaca" : "#ddd6fe"}; color:${isDeclined ? "#991b1b" : "#4c1d95"}; font-size:12px; line-height:1.45; white-space:pre-wrap;"><strong style="display:block; margin-bottom:2px; color:${isDeclined ? "#dc2626" : "#6d28d9"};"><i class="fa-solid fa-comment-dots"></i> ${escapeHtml(noteLabel || "Feedback")}:</strong>${escapeHtml(feedbackMsg)}</span>`
                    : "";

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
                        <span class="portal-notif-item-msg">${escapeHtml(mainMsg)}</span>
                        ${feedbackHtml}
                    </button>
                `;
            }).join("");

            list.querySelectorAll(".portal-notif-item").forEach((node) => {
                node.addEventListener("click", async () => {
                    const id = node.getAttribute("data-notification-id");
                    await this.markRead(id);
                    this.setDropdownOpen(false);
                    // Always navigate directly to the user's respective Notifications sidebar page
                    window.location.href = `${getNotificationsPageUrl()}?notifId=${encodeURIComponent(id)}`;
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
                    `${API_BASE}/api/portal-notifications/read/${encodeURIComponent(notificationId)}`,
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

                this.cachedNotifications =
                    (this.cachedNotifications || []).map((item) =>
                        String(item.id) === String(notificationId)
                        ? { ...item, is_read: 1 }
                        : item
                    );

                if (data.unread_count !== undefined) {
                    this.unreadCount = Math.max(0, Number(data.unread_count || 0));
                } else {
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                }

                this.updateDot(this.unreadCount);
                this.renderSidebarDots(this.sectionCounts, this.unreadCount);

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
    PortalNotifications.getNotificationsPageUrl = getNotificationsPageUrl;
    window.PortalNotifications = PortalNotifications;

})();
