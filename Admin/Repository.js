/* ================= ADD REPOSITORY ================= */

let currentSearchQuery = "";

function escapeRegex(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchMatch(text, query) {
    if (!text) return "";
    const escaped = escapeHtml(text);
    if (!query || !String(query).trim()) return escaped;

    const trimmed = String(query).trim();
    const tokens = [trimmed, ...trimmed.split(/\s+/).filter(t => t.length >= 2)];
    const uniqueTokens = [...new Set(tokens)].sort((a, b) => b.length - a.length);

    if (uniqueTokens.length === 0) return escaped;

    const pattern = uniqueTokens.map(escapeRegex).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

const addBtn =
    document.getElementById(
        "addBtn"
    );

addBtn.addEventListener(
    "click",

    async () => {

        const program =
            document.getElementById(
                "program"
            ).value;

        const title =
            document.getElementById(
                "title"
            ).value;

        const abstract =
            document.getElementById(
                "abstract"
            ).value;

        const objectives =
            document.getElementById(
                "objectives"
            ).value;

        const research_problem =
            document.getElementById(
                "research_problem"
            )?.value?.trim() || "";

        const methodology =
            document.getElementById(
                "methodology"
            )?.value?.trim() || "";

        const researchers =
            document.getElementById(
                "researchers"
            ).value;

        const adviser =
            document.getElementById(
                "adviser"
            ).value;

        const category =
            document.getElementById(
                "category"
            ).value;

        const year =
            document.getElementById(
                "year"
            ).value;

        if (

            !program ||
            !title ||
            !abstract ||
            !objectives ||
            !research_problem ||
            !methodology

        ) {

            alert(
                "Please complete required fields."
            );

            return;

        }

        try {

            const response = await fetch(

                "/add-repository",

                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        program,
                        title,
                        abstract,
                        objectives,
                        research_problem,
                        methodology,
                        researchers,
                        adviser,
                        category,
                        year

                    })

                }

            );

            const data =
                await response.json();

            if (data.success) {

                alert(
                    "Repository added successfully!"
                );

                document.getElementById("repositoryForm").reset();
                loadRepository();

            }

        } catch (error) {

            console.log(error);

        }

    }

);

/* ================= ARCHIVE HELPERS & EXPLORER ================= */

let repositoryItems = [];
const repositoryById = {};

// Explorer View States
let currentProgram = "all";
let currentView = "grid";
let currentPage = 1;
let itemsPerPage = 10;

// 3-Layer Semantic Search State (Gemini AI / Local HuggingFace AI / Keyword)
let _searchDebounceTimer = null;
let _lastSearchQuery = "";
let _isSemanticSearch = false;

const API_BASE = "";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getCategoryClass(category) {
    const key = String(category || "").trim().toLowerCase();
    if (key.includes("web")) return "cat-web";
    if (key.includes("mobile")) return "cat-mobile";
    if (key.includes("artificial") || key === "ai") return "cat-ai";
    if (key.includes("data")) return "cat-data";
    if (key.includes("iot")) return "cat-iot";
    return "cat-default";
}

// Stats Calculation
function updateStatsDashboard(filteredItems, allItems) {
    const totalCount = allItems.length;
    const itCount = allItems.filter(item => item.program === "IT" || item.program === "BSIT").length;
    const isCount = allItems.filter(item => item.program === "IS" || item.program === "BSIS").length;

    // Unique categories count
    const uniqueCats = new Set();
    allItems.forEach(item => {
        if (item.category) uniqueCats.add(item.category.trim());
    });

    document.getElementById("statTotalCount").textContent = totalCount;
    document.getElementById("statItCount").textContent = itCount;
    document.getElementById("statIsCount").textContent = isCount;
    document.getElementById("statCatCount").textContent = uniqueCats.size;
}

// Populate Dynamic Year Filter dropdown
function populateYearFilter(items) {
    const yearSelect = document.getElementById("filterYear");
    if (!yearSelect) return;

    // Save current selection
    const previousSelection = yearSelect.value;

    // Get unique years sorted descending
    const years = [...new Set(items.map(item => item.year).filter(Boolean))];
    years.sort((a, b) => b - a);

    // Clear except first option
    yearSelect.innerHTML = '<option value="all">All Years</option>';

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // Restore selection if it still exists
    if (years.includes(Number(previousSelection)) || previousSelection === "all") {
        yearSelect.value = previousSelection;
    }
}

// Filters & Sort Application
function getFilteredAndSortedItems() {
    const searchInput = document.getElementById("archiveSearch");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    currentSearchQuery = query;
    const categoryFilter = document.getElementById("filterCategory").value;
    const yearFilter = document.getElementById("filterYear").value;
    const sortBy = document.getElementById("sortRepo").value;

    let result = [...repositoryItems];

    // 1. Program Filter
    if (currentProgram !== "all") {
        result = result.filter(item => {
            if (currentProgram === "IT" || currentProgram === "BSIT") {
                return item.program === "IT" || item.program === "BSIT";
            } else if (currentProgram === "IS" || currentProgram === "BSIS") {
                return item.program === "IS" || item.program === "BSIS";
            }
            return item.program === currentProgram;
        });
    }

    // 2. Category Filter
    if (categoryFilter !== "all") {
        result = result.filter(item => item.category === categoryFilter);
    }

    // 3. Year Filter
    if (yearFilter !== "all") {
        result = result.filter(item => String(item.year) === String(yearFilter));
    }

    // 4. Search Query Filter
    // When _isSemanticSearch=true the backend /repository-search already ranked repositoryItems; skip local filter.
    if (query && !_isSemanticSearch) {
        const queryTerms = query.split(/\s+/).filter(Boolean);
        result = result.filter(item => {
            const contextFields = [
                item.title,
                item.abstract,
                item.objectives,
                item.research_problem,
                item.methodology,
                item.researchers,
                item.adviser,
                item.category,
                item.year,
                item.program
            ].map(val => String(val || "").toLowerCase());

            const combinedContext = contextFields.join(" ");

            return combinedContext.includes(query) || (queryTerms.length > 1 && queryTerms.every(term => combinedContext.includes(term)));
        });
    }

    // 5. Sorting
    // In semantic mode preserve server rank order unless user picks an explicit sort
    if (!_isSemanticSearch || sortBy !== "year-desc") {
        result.sort((a, b) => {
            if (sortBy === "year-desc") {
                return (b.year || 0) - (a.year || 0);
            } else if (sortBy === "year-asc") {
                return (a.year || 0) - (b.year || 0);
            } else if (sortBy === "title-asc") {
                return String(a.title || "").localeCompare(String(b.title || ""));
            } else if (sortBy === "title-desc") {
                return String(b.title || "").localeCompare(String(a.title || ""));
            }
            return 0;
        });
    }

    return result;
}

// Build cards layout html
function buildGridHtml(items) {
    if (items.length === 0) {
        return '<div class="repo-empty-state"><i class="fa-solid fa-folder-open"></i><p>No repository records match your criteria.</p></div>';
    }

    return items.map(item => {
        const catClass = getCategoryClass(item.category);
        const categoryLabel = escapeHtml(item.category || "Uncategorized");
        const programClass = item.program === "IT" ? "prog-it" : "prog-is";

        return `
            <div class="archive-card">
                <div class="archive-card-top">
                    <span class="program-tag ${programClass}">${escapeHtml(item.program)}</span>
                    <span class="archive-year">${escapeHtml(item.year || "—")}</span>
                    <span class="meta-badge ${catClass}">${categoryLabel}</span>
                </div>
                <p class="archive-title" title="${escapeHtml(item.title)}">${highlightSearchMatch(item.title, currentSearchQuery)}</p>
                <p class="archive-adviser">
                    <i class="fa-solid fa-user-tie"></i>
                    Adviser: <strong>${highlightSearchMatch(item.adviser || "No adviser", currentSearchQuery)}</strong>
                </p>
                <p class="archive-researchers" title="${escapeHtml(item.researchers)}">
                    <i class="fa-solid fa-users"></i>
                    ${highlightSearchMatch(item.researchers || "No researchers listed", currentSearchQuery)}
                </p>
                <div class="archive-actions">
                    <button class="view-btn" type="button" onclick="viewRepositoryById(${Number(item.id)})">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button class="delete-btn" type="button" onclick="deleteRepository(${Number(item.id)})">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// Build table layout html
function buildTableHtml(items) {
    if (items.length === 0) {
        return '<div class="repo-empty-state"><i class="fa-solid fa-folder-open"></i><p>No repository records match your criteria.</p></div>';
    }

    const tableRows = items.map((item, index) => {
        const catClass = getCategoryClass(item.category);
        const categoryLabel = escapeHtml(item.category || "Uncategorized");
        const programClass = item.program === "IT" ? "prog-badge it" : "prog-badge is";

        return `
            <tr>
                <td class="text-center">${(currentPage - 1) * itemsPerPage + index + 1}</td>
                <td>
                    <div class="table-title-cell" title="${escapeHtml(item.title)}">${highlightSearchMatch(item.title, currentSearchQuery)}</div>
                </td>
                <td><span class="${programClass}">${escapeHtml(item.program)}</span></td>
                <td><span class="meta-badge ${catClass}">${categoryLabel}</span></td>
                <td>${highlightSearchMatch(item.adviser || "—", currentSearchQuery)}</td>
                <td class="text-center font-bold">${escapeHtml(item.year || "—")}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action-btn view" onclick="viewRepositoryById(${Number(item.id)})" title="View Details">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="table-action-btn delete" onclick="deleteRepository(${Number(item.id)})" title="Delete Entry">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    return `
        <div class="table-responsive">
            <table class="repo-data-table">
                <thead>
                    <tr>
                        <th style="width: 50px;" class="text-center">#</th>
                        <th>Project Title</th>
                        <th style="width: 100px;">Program</th>
                        <th style="width: 140px;">Category</th>
                        <th>Adviser</th>
                        <th style="width: 80px;" class="text-center">Year</th>
                        <th style="width: 100px;" class="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// Main Render Function
function renderRepositoryExplorer() {
    const repoContainer = document.getElementById("repoContainer");
    const paginationInfo = document.getElementById("paginationInfo");
    const paginationControls = document.getElementById("paginationControls");

    const filteredAndSorted = getFilteredAndSortedItems();
    const totalItems = filteredAndSorted.length;

    // Calculate dynamic pagination pages
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filteredAndSorted.slice(startIndex, endIndex);

    // Update container layout class
    if (currentView === "grid") {
        repoContainer.className = "repo-grid-layout";
        repoContainer.innerHTML = buildGridHtml(paginatedItems);
    } else {
        repoContainer.className = "repo-table-layout";
        repoContainer.innerHTML = buildTableHtml(paginatedItems);
    }

    // Update pagination info
    if (totalItems === 0) {
        paginationInfo.textContent = "Showing 0-0 of 0 titles";
    } else {
        paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} titles`;
    }

    // Render pagination controls
    let paginationButtons = "";
    if (totalPages > 1) {
        // Prev button
        paginationButtons += `
            <button class="pag-btn" ${currentPage === 1 ? "disabled" : ""} onclick="changePage(${currentPage - 1})">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                paginationButtons += `
                    <button class="pag-btn ${currentPage === i ? "active" : ""}" onclick="changePage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                paginationButtons += `<span class="pag-dots">...</span>`;
            }
        }

        // Next button
        paginationButtons += `
            <button class="pag-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="changePage(${currentPage + 1})">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;
    }
    paginationControls.innerHTML = paginationButtons;
}

function changePage(page) {
    currentPage = page;
    renderRepositoryExplorer();
    // Scroll layout view smoothly to top of section
    document.querySelector(".archive-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Event Listeners setup
function initializeExplorerEvents() {
    // 1. Search Box Input (3-Layer Semantic Search with 400ms debounce)
    const searchInput = document.getElementById("archiveSearch");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.trim();

            if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);

            if (!q) {
                _lastSearchQuery = "";
                _isSemanticSearch = false;
                currentSearchQuery = "";
                currentPage = 1;
                const badge = document.getElementById("searchModeBadge");
                if (badge) badge.style.display = "none";
                loadRepository();
                return;
            }

            _searchDebounceTimer = setTimeout(() => {
                _searchDebounceTimer = null;
                doSemanticSearch(q);
            }, 400);
        });
    }

    // 2. Select Box Filters & Sorters
    ["filterCategory", "filterYear", "sortRepo"].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener("change", () => {
                currentPage = 1;
                renderRepositoryExplorer();
            });
        }
    });

    // 3. Program Tabs
    document.querySelectorAll(".program-tabs .tab-btn").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".program-tabs .tab-btn").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentProgram = tab.dataset.program;
            currentPage = 1;
            renderRepositoryExplorer();
        });
    });

    // 4. View Toggles (Grid / Table)
    const viewGridBtn = document.getElementById("viewGridBtn");
    const viewTableBtn = document.getElementById("viewTableBtn");

    if (viewGridBtn && viewTableBtn) {
        viewGridBtn.addEventListener("click", () => {
            viewGridBtn.classList.add("active");
            viewTableBtn.classList.remove("active");
            currentView = "grid";
            renderRepositoryExplorer();
        });

        viewTableBtn.addEventListener("click", () => {
            viewTableBtn.classList.add("active");
            viewGridBtn.classList.remove("active");
            currentView = "table";
            renderRepositoryExplorer();
        });
    }
}

async function loadRepository() {
    try {
        const response = await fetch(`${API_BASE}/repository`);
        const data = await response.json();

        repositoryItems = data.success ? data.repository : [];
        _isSemanticSearch = false;

        repositoryItems.forEach(item => {
            repositoryById[item.id] = item;
        });

        // Update top-level dashboard metrics
        updateStatsDashboard(repositoryItems, repositoryItems);

        // Populate Years dynamically
        populateYearFilter(repositoryItems);

        // Render layout
        renderRepositoryExplorer();

    } catch (error) {
        console.log(error);
    }
}

// 3-Layer Semantic / Synonym Search via Backend (/repository-search)
async function doSemanticSearch(query) {
    currentSearchQuery = query;
    _lastSearchQuery = query;

    const searchInput = document.getElementById("archiveSearch");
    if (searchInput) searchInput.style.opacity = "0.6";

    try {
        const response = await fetch(`${API_BASE}/repository-search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!data.success) return;

        repositoryItems = data.titles || [];
        _isSemanticSearch = true;

        repositoryItems.forEach(item => {
            repositoryById[item.id] = item;
        });

        const matchCount = data.matchCount ?? repositoryItems.length;
        const mode = data.mode || "keyword";
        console.log(`[Admin Repo Search] mode=${mode}, matched=${matchCount}/${repositoryItems.length}`);

        const badge = document.getElementById("searchModeBadge");
        if (badge) {
            badge.textContent = `${matchCount} match${matchCount !== 1 ? "es" : ""}`;
            if (mode === "gemini") {
                badge.style.background = "#eff6ff";
                badge.style.color = "#1d4ed8";
                badge.style.border = "1px solid #bfdbfe";
            } else if (mode === "huggingface" || mode === "semantic") {
                badge.style.background = "#f5f3ff";
                badge.style.color = "#7c3aed";
                badge.style.border = "1px solid #ece3ff";
            } else {
                badge.style.background = "#f3f4f6";
                badge.style.color = "#4b5563";
                badge.style.border = "1px solid #e5e7eb";
            }
            badge.style.display = matchCount > 0 ? "inline-block" : "none";
        }

        currentPage = 1;
        renderRepositoryExplorer();

    } catch (err) {
        console.error("[Admin Repo Search] Semantic search failed, using local filter:", err);
        _isSemanticSearch = false;
        currentPage = 1;
        renderRepositoryExplorer();
    } finally {
        if (searchInput) searchInput.style.opacity = "1";
    }
}

function viewRepositoryById(id) {
    const item = repositoryById[id];
    if (item) {
        viewRepository(item);
    }
}

function viewRepository(item) {
    document.getElementById("modal").style.display = "flex";

    const query = currentSearchQuery;

    document.getElementById("modalTitle").innerHTML = `
        ${highlightSearchMatch(item.title, query)}
        <span class="meta-badge ${getCategoryClass(item.category)}" style="display:inline-block;margin-left:10px;vertical-align:middle;">
            ${escapeHtml(item.category || "Uncategorized")}
        </span>
    `;

    let sectionsHtml = `
        <div class="repository-field">
            <strong>Abstract</strong>
            <div class="repository-preserved-text">${highlightSearchMatch(item.abstract, query)}</div>
        </div>
        <div class="repository-field">
            <strong>Objectives</strong>
            <div class="repository-preserved-text">${highlightSearchMatch(item.objectives, query)}</div>
        </div>
    `;

    if (item.research_problem && item.research_problem.trim()) {
        sectionsHtml += `
            <div class="repository-field">
                <strong>Research Problem</strong>
                <div class="repository-preserved-text">${highlightSearchMatch(item.research_problem, query)}</div>
            </div>
        `;
    }

    if (item.methodology && item.methodology.trim()) {
        sectionsHtml += `
            <div class="repository-field">
                <strong>Methodology</strong>
                <div class="repository-preserved-text">${highlightSearchMatch(item.methodology, query)}</div>
            </div>
        `;
    }

    document.getElementById("modalAbstract").innerHTML = sectionsHtml;

    document.getElementById("modalProgram").innerText = item.program || "—";
    document.getElementById("modalResearchers").innerHTML = highlightSearchMatch(item.researchers, query) || "—";
    document.getElementById("modalAdviser").innerHTML = highlightSearchMatch(item.adviser, query) || "—";
    document.getElementById("modalYear").innerText = item.year || "—";

    // Smoothly scroll to the first highlighted search match if present
    setTimeout(() => {
        const modalContainer = document.getElementById("modal");
        const firstHighlight = modalContainer ? modalContainer.querySelector("mark.search-highlight") : null;
        if (firstHighlight) {
            firstHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, 120);
}

/* ================= CLOSE MODAL ================= */

function closeModal() {
    document.getElementById("modal").style.display = "none";
}

/* ================= DELETE ================= */

async function deleteRepository(id) {
    const confirmDelete = await confirm("Delete this repository?");
    if (!confirmDelete) {
        return;
    }

    try {
        const response = await fetch(
            `/delete-repository/${id}`,
            { method: "DELETE" }
        );

        const data = await response.json();
        if (data.success) {
            loadRepository();
        }
    } catch (error) {
        console.log(error);
    }
}

/* ================= LOGOUT ================= */

function logout() {
    localStorage.clear();
    window.location.href = "../Log-in.html";
}

/* ================= AUTO LOAD & ATTACH ================= */

initializeExplorerEvents();
loadRepository();