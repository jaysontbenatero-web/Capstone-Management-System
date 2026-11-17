/**
 * CapstoneX2 Global Custom Alerts & Confirmations
 * Replaces default browser alert() and confirm() dialogs with a clean,
 * light academic modal UI matching the Capstone Management System.
 */
(function () {
    "use strict";

    if (window.__capxCustomAlertsInstalled) {
        return;
    }
    window.__capxCustomAlertsInstalled = true;

    const ICONS = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        danger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    function detectToneAndTitle(message, isConfirm) {
        const text = String(message || "").toLowerCase();

        if (isConfirm) {
            if (
                /\b(delete|remove|permanently|decline|reject|drop|disable)\b/.test(text)
            ) {
                return {
                    tone: "danger",
                    title: "Confirm Action",
                    confirmLabel: /\bdelete\b/.test(text)
                        ? "Delete"
                        : /\bremove\b/.test(text)
                        ? "Remove"
                        : "Confirm"
                };
            }
            return {
                tone: "info",
                title: "Please Confirm",
                confirmLabel: "Confirm"
            };
        }

        // 1. Permission / Access / Restriction notices
        if (
            /\b(permission|unauthorized|access is disabled|do not have|no permission|log in first|login first|locked|cannot delete|cannot edit|not allowed|only project manager|only students)\b/.test(text)
        ) {
            return {
                tone: "warning",
                title: "Permission & Access Notice",
                confirmLabel: "OK"
            };
        }

        // 2. Explicit Errors / Failures
        if (
            /\b(error|failed|failure|invalid|incorrect|denied|rejected|unable|not found|conflict|mismatch|cannot connect|wrong)\b/.test(text)
        ) {
            return {
                tone: "error",
                title: "Action Failed",
                confirmLabel: "OK"
            };
        }

        // 3. Success / Completion notices
        if (
            /\b(success|successfully|saved|approved|submitted|created|updated|enrolled|sent|copied|completed|accepted|assigned|forwarded|published|signed|uploaded|deleted|removed|archived|scheduled|generated)\b/.test(text)
        ) {
            return {
                tone: "success",
                title: "Success",
                confirmLabel: "OK"
            };
        }

        // 4. Validation / Warning prompts
        if (
            /\b(please|missing|required|select|enter|complete|choose|minimum|maximum|already|warning|wait|empty|incomplete|must|first)\b/.test(text)
        ) {
            return {
                tone: "warning",
                title: "Attention Required",
                confirmLabel: "OK"
            };
        }

        return {
            tone: "info",
            title: "System Notice",
            confirmLabel: "OK"
        };
    }

    let backdropEl = null;
    let cardEl = null;
    let iconWrapEl = null;
    let titleEl = null;
    let msgEl = null;
    let cancelBtnEl = null;
    let okBtnEl = null;

    const queue = [];
    let activeItem = null;

    function ensureDom() {
        if (backdropEl && backdropEl.isConnected) {
            return;
        }

        backdropEl = document.createElement("div");
        backdropEl.className = "capx-alert-backdrop";
        backdropEl.setAttribute("role", "dialog");
        backdropEl.setAttribute("aria-modal", "true");

        backdropEl.innerHTML = `
            <div class="capx-alert-card tone-info">
                <div class="capx-alert-icon-wrap">${ICONS.info}</div>
                <h3 class="capx-alert-title">System Notice</h3>
                <p class="capx-alert-message"></p>
                <div class="capx-alert-actions">
                    <button type="button" class="capx-alert-btn capx-alert-btn-cancel" style="display:none;">Cancel</button>
                    <button type="button" class="capx-alert-btn capx-alert-btn-ok">OK</button>
                </div>
            </div>
        `;

        cardEl = backdropEl.querySelector(".capx-alert-card");
        iconWrapEl = backdropEl.querySelector(".capx-alert-icon-wrap");
        titleEl = backdropEl.querySelector(".capx-alert-title");
        msgEl = backdropEl.querySelector(".capx-alert-message");
        cancelBtnEl = backdropEl.querySelector(".capx-alert-btn-cancel");
        okBtnEl = backdropEl.querySelector(".capx-alert-btn-ok");

        okBtnEl.addEventListener("click", () => resolveActive(true));
        cancelBtnEl.addEventListener("click", () => resolveActive(false));

        backdropEl.addEventListener("click", (e) => {
            if (e.target === backdropEl && activeItem && !activeItem.isConfirm) {
                resolveActive(true);
            }
        });

        document.addEventListener("keydown", (e) => {
            if (!activeItem) return;
            if (e.key === "Escape") {
                e.preventDefault();
                resolveActive(activeItem.isConfirm ? false : true);
            } else if (e.key === "Enter") {
                e.preventDefault();
                resolveActive(true);
            }
        });

        const host = document.body || document.documentElement;
        host.appendChild(backdropEl);
    }

    function showNext() {
        if (activeItem || queue.length === 0) {
            return;
        }

        ensureDom();
        activeItem = queue.shift();

        const { message, isConfirm, options } = activeItem;
        const meta = detectToneAndTitle(message, isConfirm);
        const tone = (options && options.tone) || meta.tone;
        const title = (options && options.title) || meta.title;
        const okText = (options && options.confirmText) || meta.confirmLabel || "OK";
        const cancelText = (options && options.cancelText) || "Cancel";

        cardEl.className = `capx-alert-card tone-${tone}`;
        iconWrapEl.innerHTML = ICONS[tone] || ICONS.info;
        titleEl.textContent = title;
        msgEl.textContent = String(message ?? "");

        if (isConfirm) {
            cancelBtnEl.style.display = "inline-flex";
            cancelBtnEl.textContent = cancelText;
        } else {
            cancelBtnEl.style.display = "none";
        }

        okBtnEl.textContent = okText;

        requestAnimationFrame(() => {
            backdropEl.classList.add("is-open");
            okBtnEl.focus();
        });
    }

    function resolveActive(result) {
        if (!activeItem) return;
        const current = activeItem;
        activeItem = null;

        if (backdropEl) {
            backdropEl.classList.remove("is-open");
        }

        setTimeout(() => {
            current.resolve(current.isConfirm ? Boolean(result) : undefined);
            showNext();
        }, 140);
    }

    function customAlert(message, options) {
        return new Promise((resolve) => {
            queue.push({
                message,
                isConfirm: false,
                options: options || {},
                resolve
            });
            showNext();
        });
    }

    function customConfirm(message, options) {
        return new Promise((resolve) => {
            queue.push({
                message,
                isConfirm: true,
                options: options || {},
                resolve
            });
            showNext();
        });
    }

    window.customAlert = customAlert;
    window.customConfirm = customConfirm;
    window.alert = customAlert;
    window.confirm = customConfirm;
})();

