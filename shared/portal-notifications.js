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

    /** @param {string} path */
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

    /** @param {string} targetPath */
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

    // Strict deterministic notification target resolver (routes accurately to the exact portal role & page)
    /** @param {Record<string, any> | null | undefined} item */
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
        const myFullname = String(localStorage.getItem("fullname") || "").toLowerCase().trim();
        const hasPanelistAccess = localStorage.getItem("panelist_access") === "1";
        const hasInstructorAccess = localStorage.getItem("instructor_access") === "1";
        const hasAdviserAccess = localStorage.getItem("adviser_access") === "1";

        // 1. Announcements
        if (type === "announcement" || title.startsWith("new announcement")) {
            if (role === "admin") return resolveRelativeUrl("Admin/Announcements.html");
            if (role === "student") return resolveRelativeUrl("Student/StudentDash.html");
            return resolveRelativeUrl("Faculty/Announcements.html");
        }

        // 2. Messages / Group Chat
        if (
            type === "message" ||
            title.includes("new message") ||
            title.includes("group chat") ||
            title.includes("message") ||
            combined.includes("sent you a message") ||
            combined.includes("open in messages")
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

        // 4. Deployment Complete / Capstone Completed
        if (title.includes("deployment complete") || title.includes("capstone completed")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
        }

        // 5. Defense Minutes E-Signature Workflow
        if (type === "defense minutes" || combined.includes("defense minutes")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            if (
                combined.includes("panelist document review") ||
                title.includes("ready for e-signature") ||
                title.includes("updated defense minutes for review") ||
                combined.includes("open for your e-signature") ||
                (combined.includes("adviser") && combined.includes("signed") && combined.includes("affix your e-signature"))
            ) {
                return resolveRelativeUrl("Faculty/Panelist/Document_Review.html");
            }
            // Adviser e-sign / draft / photos submitted -> always Adviser side, never Instructor
            return resolveRelativeUrl("Faculty/Adviser/Documents.html");
        }

        // 6. Recommendation for Deployment E-Signature Workflow
        // Route order: Student -> Adviser -> Panelists -> Program Chair -> Dean
        if (combined.includes("recommendation for deployment")) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");
            // Explicit Adviser review / initial submission from student -> Adviser side
            if (
                title.includes("adviser review") ||
                combined.includes("for your adviser review") ||
                title.includes("new document submission") ||
                combined.includes("has submitted a")
            ) {
                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }
            // Chairperson / Dean e-sign step (after Panelists or Chairperson signed) — check BEFORE Panelist!
            if (
                combined.includes("panelists have signed") ||
                combined.includes("pending your chairperson signature") ||
                combined.includes("pending your signature") ||
                combined.includes("pending chairperson") ||
                combined.includes("pending dean") ||
                (title.includes("pending signature") && !title.includes("pending e-signature")) ||
                title.includes("chairperson") ||
                title.includes("dean")
            ) {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }
            // Panelist e-sign step (after Adviser signed)
            if (
                title.includes("pending e-signature") ||
                combined.includes("pending a panelist e-signature") ||
                combined.includes("panelist e-signature") ||
                combined.includes("adviser signed recommendation for deployment")
            ) {
                return resolveRelativeUrl("Faculty/Panelist/Document_Review.html");
            }
            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            return resolveRelativeUrl("Admin/Document_Review.html");
        }

        // 7. Adviser Requests / Title Proposals
        if (
            type === "adviser request" ||
            title.includes("adviser request") ||
            combined.includes("requested you as their adviser") ||
            combined.includes("adviser assignment")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Req_Adviser.html");
            return resolveRelativeUrl("Faculty/Adviser/Adviser_Request.html");
        }

        // 8. Consultations
        if (type === "consultation" || combined.includes("consultation")) {
            if (role === "student") return resolveRelativeUrl("Student/Consultation.html");
            if (combined.includes("panelist") && hasPanelistAccess) {
                return resolveRelativeUrl("Faculty/Panelist/Consultation.html");
            }
            if (combined.includes("instructor") && hasInstructorAccess) {
                return resolveRelativeUrl("Faculty/Instructor/Consultation.html");
            }
            if (combined.includes("adviser") && hasAdviserAccess) {
                return resolveRelativeUrl("Faculty/Adviser/Consultation.html");
            }
            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Consultation.html");
            if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Consultation.html");
            if (hasPanelistAccess) return resolveRelativeUrl("Faculty/Panelist/Consultation.html");
            return resolveRelativeUrl("Faculty/Adviser/Consultation.html");
        }

        // 9. Defense Evaluation & Defense Schedules
        if (
            type === "defense evaluation" ||
            type === "defense schedule" ||
            type === "defense" ||
            title.includes("panel evaluation") ||
            title.includes("re-evaluation ready") ||
            title.includes("action required: schedule") ||
            title.includes("defense schedule") ||
            title.includes("defense completed") ||
            title.includes("defense evaluation") ||
            title.includes("defense panel")
        ) {
            if (role === "student") {
                if (combined.includes("defense minutes in records management")) {
                    return resolveRelativeUrl("Student/Documents.html");
                }
                return resolveRelativeUrl("Student/Defense_Schedule.html");
            }

            // Instructor required to create a new Formal Defense / re-defense schedule -> Schedule Defense
            if (
                title.includes("action required: schedule") ||
                combined.includes("required to create another defense schedule") ||
                combined.includes("please create schedule again") ||
                combined.includes("create a new schedule")
            ) {
                return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
            }

            // Instructor receiving panelist evaluation submission / completion summary -> Panel Evaluation
            if (
                title.includes("panel evaluation submitted") ||
                title.includes("panel evaluations complete")
            ) {
                return resolveRelativeUrl("Faculty/Instructor/Panel_Evaluation.html");
            }

            // Panelist re-evaluation ready -> Panelist Defense Evaluation
            if (
                title.includes("re-evaluation ready") ||
                combined.includes("conditional passed re-evaluation") ||
                combined.includes("submit your updated evaluation")
            ) {
                return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
            }

            // Defense Schedule Created / Updated / Cancelled -> distinguish Panelist vs Adviser vs Instructor
            if (
                type === "defense schedule" ||
                title.includes("defense schedule") ||
                title.includes("new defense panelist assignment") ||
                title.includes("defense panel assignment") ||
                combined.includes("defense schedule")
            ) {
                if (combined.includes("advisory group") && hasAdviserAccess) {
                    return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
                }
                const panelSectionIdx = message.indexOf("panelist");
                const panelLineText = panelSectionIdx !== -1 ? message.slice(panelSectionIdx) : "";
                const namedAsPanelist = Boolean(myFullname && panelLineText.includes(myFullname));
                if (hasPanelistAccess && (namedAsPanelist || combined.includes("assigned as a panelist") || !hasAdviserAccess)) {
                    return resolveRelativeUrl("Faculty/Panelist/Defense_Schedule.html");
                }
                if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
                if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
                if (hasPanelistAccess) return resolveRelativeUrl("Faculty/Panelist/Defense_Schedule.html");
            }

            if (hasPanelistAccess) return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
            if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Capstone_Group.html");
            return getNotificationsPageUrl();
        }

        // 10. Document Review / E-Signing / Environmental Scanning / Submissions
        if (
            type === "document" ||
            type === "document review" ||
            combined.includes("document") ||
            combined.includes("environmental scanning") ||
            combined.includes("adviser acceptance") ||
            combined.includes("acceptance for advisory") ||
            combined.includes("signature") ||
            combined.includes("e-sign") ||
            combined.includes("recommendation") ||
            combined.includes("concept paper") ||
            combined.includes("chapter ")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Documents.html");

            // Explicit target role tags in title/message (highest accuracy)
            if (title.includes("adviser review") || title.includes("adviser e-sign") || combined.includes("for your adviser review")) {
                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }
            if (title.includes("instructor review") || title.includes("instructor e-sign") || combined.includes("for your instructor review")) {
                return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
            }
            if (title.includes("admin e-signature") || combined.includes("for your admin signature")) {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }

            // Step 1: Student submitted a document directly (New Document Submission)
            if (title.includes("new document submission") || combined.includes("has submitted a")) {
                // Environmental Scanning goes to Instructor for initial e-sign
                if (combined.includes("environmental scanning")) {
                    return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
                }
                // All Adviser e-sign & review docs (Adviser Acceptance, Recommendation letters, Concept Papers, Chapters, etc.)
                // MUST go to Adviser Documents — NOT Instructor or Admin!
                return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }

            // Step 2: Routed to Program Chairperson / Dean for e-signature (Admin Document Review)
            if (
                combined.includes("pending your signature") ||
                combined.includes("pending dean") ||
                combined.includes("pending chairperson") ||
                title.includes("adviser acceptance form pending signature") ||
                title.includes("adviser acceptance form signed") ||
                title.includes("environmental scanning pending signature") ||
                title.includes("environmental scanning form signed")
            ) {
                return resolveRelativeUrl("Admin/Document_Review.html");
            }

            // Step 3: Environmental Scanning status / decline notices
            if (combined.includes("environmental scanning")) {
                if (role === "admin" && (position.includes("dean") || position.includes("chairperson"))) {
                    return resolveRelativeUrl("Admin/Document_Review.html");
                }
                if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
                if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
            }

            // Step 4: Adviser Acceptance / Recommendation Letters / Chapters requiring Adviser review or e-sign
            if (
                combined.includes("adviser acceptance") ||
                combined.includes("acceptance for advisory") ||
                combined.includes("recommendation") ||
                combined.includes("concept paper") ||
                combined.includes("chapter ")
            ) {
                if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            }

            if (hasAdviserAccess) return resolveRelativeUrl("Faculty/Adviser/Documents.html");
            if (hasInstructorAccess) return resolveRelativeUrl("Faculty/Instructor/Document_Review.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
            return resolveRelativeUrl("Faculty/Adviser/Documents.html");
        }

        return getNotificationsPageUrl();
    }

    /** @param {Record<string, any> | null | undefined} item */
    function getNotificationDashboardUrl(item) {
        return getNotificationTargetUrl(item);
    }

    /** @param {any} value */
    function formatNotificationTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();

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

    /** @param {any} text */
    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /** @param {Element} topbar */
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
                    <span class="portal-notif-badge" id="portalNotifDot" hidden>0</span>
                </button>
                <div class="portal-notif-dropdown" id="portalNotifDropdown">
                    <div class="portal-notif-dropdown-head">
                        <div class="portal-notif-head-left">
                            <strong>Notifications</strong>
                            <span class="portal-notif-head-count" id="portalNotifHeadCount" style="display:none;">0 unread</span>
                        </div>
                        <button
                            type="button"
                            class="portal-notif-mark-all-btn"
                            id="portalNotifMarkAllBtn"
                            title="Mark all notifications as read"
                            disabled
                        >
                            <i class="fa-solid fa-check-double"></i>
                            <span>Mark all as read</span>
                        </button>
                    </div>
                    <div class="portal-notif-dropdown-list" id="portalNotifList"></div>
                    <a class="portal-notif-view-all" id="portalNotifViewAll" href="#">View all</a>
                </div>
            </div>
        `;
    }

    const PortalNotifications = {
        unreadCount: 0,
        /** @type {Record<string, number>} */
        sectionCounts: {},
        /** @type {Array<Record<string, any>>} */
        cachedNotifications: [],
        cachedNotificationsJson: "",
        /** @type {number | null} */
        pollTimer: null,
        isDropdownOpen: false,
        _refreshBusy: false,
        _markedCurrentSection: false,
        getNotificationTargetUrl,
        getNotificationDashboardUrl,
        getNotificationsPageUrl,

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
                if (!(el instanceof HTMLElement) || el.dataset.notifBound === "1") return;
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
            if (this.pollTimer !== null) {
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

            if (topbar instanceof HTMLElement && topbar.classList.contains("admin-header")) {
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

            if (bellNode) {
                actions.insertBefore(bellNode, actions.firstChild);
            }

            const viewAll = document.getElementById("portalNotifViewAll");

            if (viewAll instanceof HTMLAnchorElement) {
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

            const markAllBtn = document.getElementById("portalNotifMarkAllBtn");

            if (markAllBtn) {
                markAllBtn.addEventListener("click", async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (markAllBtn.hasAttribute("disabled")) return;
                    await this.markAllUnreadAsChecked(false);
                });
            }

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
                const targetNode = event.target instanceof Node ? event.target : null;

                if (
                    targetNode
                    && !wrap.contains(targetNode)
                    && !(dropdownEl && dropdownEl.contains(targetNode))
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
            const panelWidth = Math.min(360, window.innerWidth - 24);
            let left = rect.right - panelWidth;

            left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

            dropdown.style.position = "fixed";
            dropdown.style.top = `${rect.bottom + 8}px`;
            dropdown.style.left = `${left}px`;
            dropdown.style.right = "auto";
            dropdown.style.width = `${panelWidth}px`;
            dropdown.style.zIndex = "10000";
        },

        /** @param {boolean} open */
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
            } catch {
                return "";
            }
        },

        /** @param {boolean} showLoading */
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
                    this.renderSidebarDots();
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
                this.renderSidebarDots();

                if (dropdownOpen) {
                    this.cachedNotifications = notifications;
                    if (this.isDropdownVisible()) {
                        this.renderList(this.cachedNotifications);
                    }
                }

                if (changed && isFullPage) {
                    const win = /** @type {any} */ (window);
                    if (typeof win.loadPortalNotificationsPage === "function") {
                        win.loadPortalNotificationsPage(true);
                    } else if (typeof win.loadStudentNotifications === "function") {
                        win.loadStudentNotifications(true);
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
            const markAllBtn = document.getElementById("portalNotifMarkAllBtn");
            const hasUnreadCached = (this.cachedNotifications || []).some((item) => Number(item.is_read) === 0);

            if (!userId || (this.unreadCount <= 0 && !hasUnreadCached)) {
                this.updateDot(0);
                this.renderSidebarDots();
                return;
            }

            if (markAllBtn instanceof HTMLButtonElement) {
                markAllBtn.disabled = true;
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
                    this.updateDot(this.unreadCount);
                    return;
                }

                this.unreadCount = 0;
                this.sectionCounts = {};
                this.updateDot(0);
                this.renderSidebarDots();

                this.cachedNotifications =
                    (this.cachedNotifications || []).map((item) => ({
                        ...item,
                        is_read: 1
                    }));
                this.cachedNotificationsJson = JSON.stringify(this.cachedNotifications);

                if (!skipRender && this.isDropdownVisible()) {
                    this.renderList(this.cachedNotifications);
                }

                if (this.isNotificationsFullPage()) {
                    const win = /** @type {any} */ (window);
                    if (typeof win.loadPortalNotificationsPage === "function") {
                        win.loadPortalNotificationsPage(true);
                    } else if (typeof win.loadStudentNotifications === "function") {
                        win.loadStudentNotifications(true);
                    }
                }
            } catch (error) {
                console.log(error);
                this.updateDot(this.unreadCount);
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
            /** @type {Array<{el: Element, path: string, isNotifItem: boolean}>} */
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
                } catch { /* ignore */ }
            });
            return items;
        },

        renderSidebarDots() {
            // Sidebar red dots and badges are disabled; clean up any stale elements
            document.querySelectorAll(".sidebar .sidebar-new-dot, .sidebar .sidebar-notif-badge").forEach((node) => {
                node.remove();
            });
        },

        /** @param {any} count */
        updateDot(count) {
            const dot = document.getElementById("portalNotifDot");
            const bell = document.getElementById("portalNotifBell");
            const headCount = document.getElementById("portalNotifHeadCount");
            const safeCount = Math.max(0, Number(count || 0));

            if (dot) {
                if (safeCount > 0) {
                    dot.hidden = false;
                    dot.style.display = "inline-flex";
                    dot.textContent = safeCount > 99 ? "99+" : String(safeCount);
                    dot.setAttribute("title", `${safeCount} unread notification${safeCount === 1 ? "" : "s"}`);
                } else {
                    dot.hidden = true;
                    dot.style.display = "none";
                    dot.textContent = "";
                    dot.removeAttribute("title");
                }
            }

            if (bell) {
                bell.setAttribute("aria-label", safeCount > 0 ? `Notifications (${safeCount} unread)` : "Notifications");
                bell.setAttribute("title", safeCount > 0 ? `Notifications (${safeCount} unread)` : "Notifications");
            }

            if (headCount) {
                if (safeCount > 0) {
                    headCount.textContent = `${safeCount} unread`;
                    headCount.style.display = "inline-block";
                } else {
                    headCount.style.display = "none";
                }
            }

            const markAllBtn = document.getElementById("portalNotifMarkAllBtn");
            if (markAllBtn instanceof HTMLButtonElement) {
                markAllBtn.disabled = safeCount === 0;
                markAllBtn.title = safeCount > 0
                    ? "Mark all notifications as read"
                    : "All notifications are already read";
            }
        },

        /** @param {Array<Record<string, any>>} items */
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
                const mainMsg = (noteMatch && typeof noteMatch.index === "number") ? rawMsg.substring(0, noteMatch.index) : rawMsg;
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
                    const clickedItem = (this.cachedNotifications || []).find(
                        (entry) => String(entry.id) === String(id)
                    ) || null;
                    if (id) {
                        await this.markRead(id);
                    }
                    this.setDropdownOpen(false);
                    const targetUrl = getNotificationTargetUrl(clickedItem);
                    window.location.href = targetUrl || `${getNotificationsPageUrl()}?notifId=${encodeURIComponent(id || "")}`;
                });
            });
        },

        /** @param {string | number} notificationId */
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
                this.renderSidebarDots();

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

    /** @type {any} */ (window).PortalNotifications = PortalNotifications;

})();
