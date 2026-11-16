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

        const role = String(localStorage.getItem("role") || "").toLowerCase().trim();
        const position = String(localStorage.getItem("position") || "").toLowerCase().trim();
        const facultyRole = String(localStorage.getItem("facultyRole") || "").toLowerCase().trim();

        // 1. MESSAGES / CHAT / CONVERSATION
        if (
            combined.includes("message") ||
            combined.includes("chat") ||
            combined.includes("conversation") ||
            combined.includes("inbox") ||
            type === "message"
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Messages.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Messages.html");
            if (role === "faculty") {
                if (position.includes("instructor") || facultyRole === "instructor") {
                    return resolveRelativeUrl("Faculty/Instructor/Messages.html");
                }
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

        // 3. ADVISER REQUEST / ADVISORY / TITLE PROPOSALS
        if (
            combined.includes("adviser request") ||
            combined.includes("adviser acceptance") ||
            combined.includes("acceptance for advisory") ||
            combined.includes("title proposal") ||
            combined.includes("proposed title")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/Req_Adviser.html");
            if (role === "faculty") return resolveRelativeUrl("Faculty/Adviser/Adviser_Request.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
        }

        // 4. DOCUMENTS / SIGNING / E-SIGNATURE / ENVIRONMENTAL SCANNING / REVISION / CONCEPT PRESENTATION
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
            if (role === "admin") return resolveRelativeUrl("Admin/Document_Review.html");
            if (role === "faculty") {
                const activePath = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
                const sessionRole = String(sessionStorage.getItem("active_faculty_role") || "").toLowerCase();

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

        // 5. DEFENSE / SCHEDULE / EVALUATION / PANELIST / GRADING
        if (
            combined.includes("defense") ||
            combined.includes("schedule") ||
            combined.includes("panel") ||
            combined.includes("evaluation") ||
            combined.includes("grading") ||
            combined.includes("room")
        ) {
            if (role === "student") return resolveRelativeUrl("Student/StudentDash.html");
            if (role === "admin") return resolveRelativeUrl("Admin/Defense_Schedule.html");
            if (role === "faculty") {
                if (position.includes("panelist") || facultyRole === "panelist") {
                    return resolveRelativeUrl("Faculty/Panelist/Assigned_Defenses.html");
                }
                return resolveRelativeUrl("Faculty/Instructor/Defense_Schedule.html");
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
                || document.querySelector(".topbar");

            if (!topbar || document.getElementById("portalNotifWrap")) {
                return;
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
                    await this.markAllUnreadAsChecked(true);
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
                    const targetUrl = getNotificationTargetUrl(item);
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
    window.PortalNotifications = PortalNotifications;

})();
