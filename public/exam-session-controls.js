(function () {
    const states = new Map();

    function getState(rootId) {
        return states.get(rootId);
    }

    function toDatetimeLocal(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value).slice(0, 16);
        }

        const pad = function (num) {
            return String(num).padStart(2, "0");
        };

        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join("-") + "T" + [
            pad(date.getHours()),
            pad(date.getMinutes())
        ].join(":");
    }

    function getMode(state) {
        return typeof state.getMode === "function" ? state.getMode() : state.mode;
    }

    function getPaperKey(utils, subject, studentClass) {
        return `${utils.normalizeClassValue(studentClass)}::${utils.normalizeSubjectValue(subject)}`;
    }

    function classSortValue(utils, studentClass) {
        const normalized = utils.normalizeClassValue(studentClass);
        const order = utils.STANDARD_CLASS_OPTIONS || [];
        const index = order.indexOf(normalized);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    }

    function sortPapers(left, right, utils) {
        const classCompare = classSortValue(utils, left.Class) - classSortValue(utils, right.Class);
        if (classCompare !== 0) return classCompare;
        return utils.humanizeSubject(left.Subject).localeCompare(utils.humanizeSubject(right.Subject));
    }

    function normalizePaperInput(value, utils) {
        if (!value) return null;

        if (typeof value === "string") {
            const parts = value.split(/::|\||#/).map(function (part) {
                return utils.cleanText(part);
            }).filter(Boolean);

            const studentClass = parts.find(function (part) {
                return (utils.STANDARD_CLASS_OPTIONS || []).includes(utils.normalizeClassValue(part));
            });

            const subject = parts.find(function (part) {
                return !studentClass || utils.normalizeClassValue(part) !== utils.normalizeClassValue(studentClass);
            });

            if (!subject) return null;

            return {
                Subject: utils.normalizeSubjectValue(subject),
                Class: studentClass ? utils.normalizeClassValue(studentClass) : ""
            };
        }

        if (typeof value === "object") {
            const subject = value.Subject || value.subject || value.Name || value.name;
            const studentClass = value.Class || value.class || value.StudentClass || value.studentClass || value.Level || value.level;
            if (!subject) return null;

            return {
                Subject: utils.normalizeSubjectValue(subject),
                Class: studentClass ? utils.normalizeClassValue(studentClass) : "",
                StartTime: utils.cleanText(value.StartTime || value.startTime || value.liveStartTime || value.start || ""),
                EndTime: utils.cleanText(value.EndTime || value.endTime || value.liveEndTime || value.end || "")
            };
        }

        return null;
    }

    function paperHasExpired(paper) {
        const endTime = paper && (paper.EndTime || paper.endTime);
        return Boolean(endTime && new Date().toISOString() > endTime);
    }

    function collectPersistedPapers(configData, utils) {
        const buckets = [];
        const fields = ["activePapers", "livePapers", "scheduledPapers", "activeSubjects", "liveSubjects"];

        fields.forEach(function (field) {
            if (Array.isArray(configData && configData[field])) {
                buckets.push.apply(buckets, configData[field]);
            }
        });

        if (configData && Array.isArray(configData.schedule)) {
            buckets.push.apply(buckets, configData.schedule);
        }

        return buckets
            .map(function (item) {
                return normalizePaperInput(item, utils);
            })
            .filter(function (paper) {
                return paper && !paperHasExpired(paper);
            });
    }

    function normalizeInventory(state, inventory) {
        return (inventory || []).map(function (item) {
            return { ...item, persistedOnly: false };
        }).sort(function (left, right) {
            return sortPapers(left, right, state.utils);
        });
    }

    function mergePersistedIntoInventory(state) {
        const inventoryMap = new Map(state.inventory.map(function (paper) {
            return [paper.key, paper];
        }));

        state.persistedPapers.forEach(function (paper) {
            const key = getPaperKey(state.utils, paper.Subject, paper.Class);
            if (!key || inventoryMap.has(key)) return;
            inventoryMap.set(key, {
                key,
                Subject: paper.Subject,
                Class: paper.Class,
                questionCount: 0,
                persistedOnly: true
            });
        });

        state.inventory = Array.from(inventoryMap.values()).sort(function (left, right) {
            return sortPapers(left, right, state.utils);
        });
    }

    function applyPersistedSelection(state) {
        const validKeys = new Set(state.inventory.map(function (item) {
            return item.key;
        }));

        const nextSelected = new Set(Array.from(state.selectedKeys).filter(function (key) {
            return validKeys.has(key);
        }));

        state.persistedPapers.forEach(function (paper) {
            const normalizedSubject = state.utils.normalizeSubjectValue(paper.Subject);
            if (paper.Class) {
                const key = getPaperKey(state.utils, normalizedSubject, paper.Class);
                if (validKeys.has(key)) nextSelected.add(key);
                return;
            }

        state.inventory.forEach(function (item) {
            if (item.Subject === normalizedSubject) {
                nextSelected.add(item.key);
            }
        });
        });

        state.selectedKeys = nextSelected;
    }

    function pruneExpiredSelection(state) {
        const beforeCount = state.selectedKeys.size;
        const expiredKeys = new Set();
        state.persistedPapers.forEach(function (paper) {
            if (paperHasExpired(paper)) {
                expiredKeys.add(getPaperKey(state.utils, paper.Subject, paper.Class));
            }
        });
        state.persistedPapers = state.persistedPapers.filter(function (paper) {
            return !paperHasExpired(paper);
        });
        const activePersistedKeys = new Set(state.persistedPapers.map(function (paper) {
            return getPaperKey(state.utils, paper.Subject, paper.Class);
        }));
        state.inventory = state.inventory.filter(function (paper) {
            return !paper.persistedOnly || activePersistedKeys.has(paper.key);
        });
        state.selectedKeys.forEach(function (key) {
            if (expiredKeys.has(key)) state.selectedKeys.delete(key);
        });
        return beforeCount !== state.selectedKeys.size;
    }

    function updateSummary(state, statusText) {
        const context = [
            state.getYear(),
            state.getTerm(),
            state.getCategory()
        ].filter(Boolean).join(" / ");
        state.root.querySelector('[data-role="scope"]').textContent = context || "Choose a category";
        state.root.querySelector('[data-role="count"]').textContent = `${state.selectedKeys.size} live paper(s) selected`;
        state.root.querySelector('[data-role="status"]').textContent = statusText;
    }

    function renderPaperList(state, message) {
        const list = state.root.querySelector('[data-role="list"]');

        if (state.loading) {
            list.innerHTML = '<div class="exam-sync-empty">Querying uploaded papers for the selected category, term, and academic session...</div>';
            return;
        }

        if (!state.getCategory() || state.getCategory() === "#") {
            list.innerHTML = '<div class="exam-sync-empty">Choose the active category first, then refresh or wait for the uploaded paper list to load here.</div>';
            return;
        }

        if (!state.inventory.length) {
            list.innerHTML = `<div class="exam-sync-empty">${message || "No uploaded papers were found for this category in the current academic session and term yet."}</div>`;
            return;
        }

        list.innerHTML = state.inventory.map(function (paper) {
            const checked = state.selectedKeys.has(paper.key) ? "checked" : "";
            const statusNote = `${paper.questionCount} question(s) uploaded for this paper.`;

            return [
                '<label class="exam-sync-paper-item">',
                `<input type="checkbox" data-key="${paper.key}" ${checked}>`,
                "<div>",
                `<span class="exam-sync-paper-label">${state.utils.humanizeSubject(paper.Subject)} - ${paper.Class}</span>`,
                `<div class="exam-sync-paper-meta">${statusNote}</div>`,
                "</div>",
                "</label>"
            ].join("");
        }).join("");
    }

    async function refreshInventory(rootId, forceRefresh) {
        const state = getState(rootId);
        if (!state) return;

        const category = state.getCategory();
        const year = state.getYear();
        const term = state.getTerm();
        const mode = getMode(state);

        if (!category || category === "#" || !year || !term) {
            state.inventory = [];
            state.loading = false;
            renderPaperList(state);
            updateSummary(state, "Waiting for an active category and session context.");
            return;
        }

        state.loading = true;
        renderPaperList(state);
        updateSummary(state, "Checking uploaded papers...");

        const requestId = ++state.requestId;

        try {
            const result = await state.utils.fetchQuestionInventory({
                baseUrl: state.baseUrl,
                schoolID: state.schoolID,
                year: year,
                term: term,
                type: category,
                mode: mode,
                forceRefresh: Boolean(forceRefresh)
            });

            if (requestId !== state.requestId) return;

            state.loading = false;
            state.inventory = normalizeInventory(state, result.inventory || []);
            mergePersistedIntoInventory(state);
            applyPersistedSelection(state);
            renderPaperList(state);
            updateSummary(state, `Loaded ${state.inventory.length} paper slot(s) from ${result.source === "scan" ? "targeted discovery" : "question inventory"}.`);
        } catch (error) {
            if (requestId !== state.requestId) return;

            state.loading = false;
            state.inventory = [];
            mergePersistedIntoInventory(state);
            applyPersistedSelection(state);
            renderPaperList(state, "Uploaded papers could not be loaded right now. You can retry after checking the cloud connection.");
            updateSummary(state, "Paper discovery failed.");
        }
    }

    function syncConfig(rootId, configData) {
        const state = getState(rootId);
        if (!state) return;

        state.persistedPapers = collectPersistedPapers(configData || {}, state.utils);
        mergePersistedIntoInventory(state);
        applyPersistedSelection(state);

        const startValue =
            configData.liveStartTime ||
            configData.startTime ||
            configData.liveWindowStart ||
            configData.scheduleStart ||
            (Array.isArray(configData.activePapers) && configData.activePapers[0] && (configData.activePapers[0].StartTime || configData.activePapers[0].startTime));
        const endValue =
            configData.liveEndTime ||
            configData.endTime ||
            configData.liveWindowEnd ||
            configData.scheduleEnd ||
            (Array.isArray(configData.activePapers) && configData.activePapers[0] && (configData.activePapers[0].EndTime || configData.activePapers[0].endTime));

        const startInput = state.root.querySelector('[data-field="start"]');
        const endInput = state.root.querySelector('[data-field="end"]');
        if (startValue) startInput.value = toDatetimeLocal(startValue);
        if (endValue) endInput.value = toDatetimeLocal(endValue);

        refreshInventory(rootId, false);
    }

    function getSelectedPapers(rootId) {
        const state = getState(rootId);
        if (!state) return [];

        return state.inventory
            .filter(function (paper) {
                return state.selectedKeys.has(paper.key);
            })
            .map(function (paper) {
                const existingPaper = state.persistedPapers.find(function (persisted) {
                    return getPaperKey(state.utils, persisted.Subject, persisted.Class) === paper.key;
                });
                return {
                    Subject: paper.Subject,
                    Class: paper.Class,
                    StartTime: existingPaper ? existingPaper.StartTime || "" : "",
                    EndTime: existingPaper ? existingPaper.EndTime || "" : ""
                };
            });
    }

    function getWindowPayload(rootId) {
        const state = getState(rootId);
        if (!state) return { startTime: "", endTime: "" };

        return {
            startTime: state.root.querySelector('[data-field="start"]').value,
            endTime: state.root.querySelector('[data-field="end"]').value
        };
    }

    function init(config) {
        const root = document.getElementById(config.rootId);
        if (!root) return;

        root.innerHTML = [
            '<div class="exam-sync-panel">',
            '<div class="exam-sync-header">',
            "<div>",
            '<h4 class="exam-sync-title">Live Subject Controls</h4>',
            '<p class="exam-sync-copy">Choose the subject and class papers that should go live for the active category in the current academic session and term.</p>',
            "</div>",
            '<div class="exam-sync-toolbar">',
            '<button type="button" class="exam-sync-mini" data-action="refresh">Refresh Papers</button>',
            '<button type="button" class="exam-sync-mini" data-action="select-all">Select All</button>',
            '<button type="button" class="exam-sync-mini" data-action="clear-all">Clear All</button>',
            "</div>",
            "</div>",
            '<div class="exam-sync-summary">',
            '<span class="exam-sync-pill" data-role="scope">Choose a category</span>',
            '<span class="exam-sync-pill" data-role="count">0 live paper(s) selected</span>',
            '<span class="exam-sync-pill" data-role="status">Waiting for uploaded papers.</span>',
            "</div>",
            '<div class="exam-sync-window-grid">',
            '<div><label>Optional Live Start (Date/Time)</label><input type="datetime-local" data-field="start"></div>',
            '<div><label>Optional Live End (Date/Time)</label><input type="datetime-local" data-field="end"></div>',
            "</div>",
            '<p class="exam-sync-window-note">Optional safety window: leave these blank to make selected papers live immediately after sync and keep them live until you update the schedule again. Set both if you still want a hard cut-off for students.</p>',
            '<div class="exam-sync-paper-list" data-role="list"></div>',
            "</div>"
        ].join("");

        const state = {
            rootId: config.rootId,
            root: root,
            utils: config.utils,
            baseUrl: config.baseUrl,
            schoolID: config.schoolID,
            mode: config.mode,
            getMode: config.getMode,
            getCategory: config.getCategory,
            getYear: config.getYear,
            getTerm: config.getTerm,
            inventory: [],
            persistedPapers: [],
            selectedKeys: new Set(),
            loading: false,
            requestId: 0,
            expiryTimer: null
        };

        states.set(config.rootId, state);

        root.querySelector('[data-action="refresh"]').addEventListener("click", function () {
            refreshInventory(config.rootId, true);
        });

        root.querySelector('[data-action="select-all"]').addEventListener("click", function () {
            state.inventory.forEach(function (paper) {
                state.selectedKeys.add(paper.key);
            });
            renderPaperList(state);
            updateSummary(state, `${state.selectedKeys.size} paper slot(s) marked to go live.`);
        });

        root.querySelector('[data-action="clear-all"]').addEventListener("click", function () {
            state.selectedKeys.clear();
            renderPaperList(state);
            updateSummary(state, "All live-paper selections cleared.");
        });

        root.querySelector('[data-role="list"]').addEventListener("change", function (event) {
            if (!event.target.matches('input[type="checkbox"][data-key]')) return;

            const key = event.target.getAttribute("data-key");
            if (event.target.checked) state.selectedKeys.add(key);
            else state.selectedKeys.delete(key);

            updateSummary(state, `${state.selectedKeys.size} paper slot(s) selected for sync.`);
        });

        if (config.categorySelectId) {
            const categorySelect = document.getElementById(config.categorySelectId);
            if (categorySelect) {
                categorySelect.addEventListener("change", function () {
                    refreshInventory(config.rootId, false);
                });
            }
        }

        renderPaperList(state);
        updateSummary(state, "Waiting for uploaded papers.");

        state.expiryTimer = window.setInterval(function () {
            if (!pruneExpiredSelection(state)) return;
            renderPaperList(state);
            updateSummary(state, "Ended live papers were unchecked.");
        }, 30000);
    }

    window.LAECExamSession = {
        getSelectedPapers,
        getWindowPayload,
        init,
        refresh: refreshInventory,
        syncConfig
    };
})();
