(function () {
    const state = {
        questions: []
    };
    const DEFAULT_YEAR = "2025/2026";

    function getAlert() {
        return typeof window.winAlert === "function"
            ? window.winAlert
            : function (title, message) { alert(`${title}: ${message}`); };
    }

    function getSchoolID() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("/admin/") || path.includes("/joint-comm/")) return "GLOBAL";
        return localStorage.getItem("SchoolID") || "SFC";
    }

    function getDefaultMode() {
        return getSchoolID() === "GLOBAL" ? "MODE_A" : "MODE_B";
    }

    function getModeLabel() {
        return getDefaultMode() === "MODE_A" ? "MODE A (JOINT)" : "MODE B (INTERNAL)";
    }

    function getAcademicYear() {
        const select = document.getElementById("global-academic-year");
        if (select && /^\d{4}[/-]\d{4}$/.test(select.value)) return select.value.replace("-", "/");
        const display = document.getElementById("global-session-display") || document.getElementById("current-session-display");
        const text = display && display.innerText ? display.innerText.trim() : "";
        return /^\d{4}[/-]\d{4}$/.test(text) ? text.replace("-", "/") : DEFAULT_YEAR;
    }

    function getTerm() {
        const select = document.getElementById("global-active-term");
        if (select && select.value) return select.value;
        return window.ACTIVE_SYNC_TERM || "TERM1";
    }

    function getCategory() {
        const select = document.getElementById("global-exam-type");
        return select && select.value && select.value !== "#" ? select.value : "EXAM";
    }

    function optionList(values, selectedValue, labelMap) {
        return values.map((value) => {
            const selected = value === selectedValue ? " selected" : "";
            const label = labelMap && labelMap[value] ? labelMap[value] : value;
            return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
        }).join("");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getSubjectOptions() {
        const subjects = window.LAEC_UTILS && Array.isArray(window.LAEC_UTILS.STANDARD_SUBJECT_OPTIONS)
            ? window.LAEC_UTILS.STANDARD_SUBJECT_OPTIONS
            : ["MATHEMATICS", "ENGLISH_LANGUAGE", "BIOLOGY", "CHEMISTRY", "PHYSICS"];
        const humanize = window.LAEC_UTILS && window.LAEC_UTILS.humanizeSubject
            ? window.LAEC_UTILS.humanizeSubject
            : (value) => value.replace(/_/g, " ");
        return subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(humanize(subject))}</option>`).join("");
    }

    function buildManagerCard() {
        return `
            <div class="card" id="question-manager-card" style="border-top: 5px solid var(--laec-accent);">
                <h3 style="color: var(--laec-blue);">Uploaded Question Viewer and Editor</h3>
                <div class="grid-2">
                    <div><label>Question Source</label><input type="text" id="qm-mode-label" readonly style="background:#f7f9fc; font-weight:800; color:var(--laec-blue);"></div>
                    <div><label>Target Category</label><select id="qm-category">
                        <option value="CA1">CA 1</option>
                        <option value="CA2">CA 2</option>
                        <option value="EXAM">EXAM</option>
                    </select></div>
                    <div><label>Term</label><select id="qm-term">
                        <option value="TERM1">1st Term</option>
                        <option value="TERM2">2nd Term</option>
                        <option value="TERM3">3rd Term</option>
                    </select></div>
                    <div><label>Academic Year</label><input type="text" id="qm-year" placeholder="2025/2026"></div>
                    <div><label>Subject</label><select id="qm-subject">${getSubjectOptions()}</select></div>
                    <div><label>Class</label><select id="qm-class">
                        ${optionList(["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"], "SS1")}
                    </select></div>
                </div>
                <div style="display:flex; gap:10px; margin-top:20px; flex-wrap:wrap;">
                    <button class="btn-primary" type="button" onclick="LAECQuestionManager.load()">VIEW UPLOADED QUESTIONS</button>
                    <button class="btn-secondary" type="button" onclick="LAECQuestionManager.syncFromSession()">USE ACTIVE SESSION</button>
                    <button class="btn-success" type="button" onclick="LAECQuestionManager.add()">ADD QUESTION</button>
                    <button class="btn-danger" type="button" onclick="LAECQuestionManager.removePaper()">DELETE SELECTED PAPER</button>
                </div>
                <div id="qm-status" style="margin-top:12px; font-size:0.78rem; color:#5f7087; font-weight:700;">Select subject, class, category, term, and academic year to edit questions that are not live.</div>
                <div class="table-responsive" style="margin-top:15px; box-shadow:none;">
                    <table id="qm-table" style="min-width:1600px;">
                        <thead>
                            <tr>
                                <th style="width:55px;">SN</th>
                                <th style="min-width:520px; width:34%;">Question</th>
                                <th style="min-width:90px;">Type</th>
                                <th>A</th>
                                <th>B</th>
                                <th>C</th>
                                <th>D</th>
                                <th style="min-width:80px;">Correct</th>
                                <th style="min-width:70px;">CA1</th>
                                <th style="min-width:70px;">CA2</th>
                                <th style="min-width:70px;">EXAM</th>
                                <th style="min-width:180px;">Image URL</th>
                                <th style="min-width:180px;">Instruction</th>
                                <th style="width:180px;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="qm-table-body">
                            <tr><td colspan="14" style="text-align:center; color:#7f8c9d;">Load a paper to view, add, delete, and edit its uploaded questions.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function setStatus(message, danger) {
        const status = document.getElementById("qm-status");
        if (!status) return;
        status.textContent = message;
        status.style.color = danger ? "var(--danger)" : "#5f7087";
    }

    function syncFromSession() {
        setValue("qm-mode-label", getModeLabel());
        setValue("qm-category", getCategory());
        setValue("qm-term", getTerm());
        setValue("qm-year", getAcademicYear());
    }

    function renderRows() {
        const tbody = document.getElementById("qm-table-body");
        if (!tbody) return;
        if (!state.questions.length) {
            tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; color:#7f8c9d;">No questions found for this paper.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.questions.map((q, index) => `
            <tr data-qm-index="${index}">
                <td>${index + 1}</td>
                <td><textarea data-field="Question" rows="5" style="min-width:520px; width:100%; line-height:1.45;">${escapeHtml(q.Question || q.Text)}</textarea></td>
                <td><select data-field="QuestionType">
                    ${optionList(["OBJECTIVE", "SUB_OBJECTIVE", "THEORY"], q.QuestionType || "OBJECTIVE", { SUB_OBJECTIVE: "SUB OBJ" })}
                </select></td>
                <td><textarea data-field="A" rows="2">${escapeHtml(q.A)}</textarea></td>
                <td><textarea data-field="B" rows="2">${escapeHtml(q.B)}</textarea></td>
                <td><textarea data-field="C" rows="2">${escapeHtml(q.C)}</textarea></td>
                <td><textarea data-field="D" rows="2">${escapeHtml(q.D)}</textarea></td>
                <td><input data-field="Correct" value="${escapeHtml(q.Correct)}"></td>
                <td><input type="number" step="0.01" data-field="CA1" value="${escapeHtml(q.CA1)}"></td>
                <td><input type="number" step="0.01" data-field="CA2" value="${escapeHtml(q.CA2)}"></td>
                <td><input type="number" step="0.01" data-field="EXAM" value="${escapeHtml(q.EXAM)}"></td>
                <td><textarea data-field="ImageURL" rows="2">${escapeHtml(q.ImageURL)}</textarea></td>
                <td><textarea data-field="AssessmentInstruction" rows="2">${escapeHtml(q.AssessmentInstruction)}</textarea></td>
                <td style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn-success" type="button" onclick="LAECQuestionManager.save(${index})">SAVE</button>
                    <button class="btn-danger" type="button" onclick="LAECQuestionManager.remove(${index})">DELETE</button>
                </td>
            </tr>
        `).join("");
    }

    async function load() {
        const alertUser = getAlert();
        const subject = document.getElementById("qm-subject").value;
        const studentClass = document.getElementById("qm-class").value;
        const mode = getDefaultMode();
        const category = document.getElementById("qm-category").value;
        const term = document.getElementById("qm-term").value;
        const year = document.getElementById("qm-year").value || getAcademicYear();
        const schoolID = mode === "MODE_A" ? "GLOBAL" : getSchoolID();

        if (!subject || !studentClass || !category) {
            alertUser("Selection Required", "Select subject, class, and category.");
            return;
        }

        const tbody = document.getElementById("qm-table-body");
        if (tbody) tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; color:#7f8c9d;">Loading questions...</td></tr>`;

        try {
            const params = new URLSearchParams({
                action: "GET_SECURE_QUESTIONS",
                schoolID,
                year: year.replace("/", "-"),
                term,
                class: studentClass,
                subject,
                type: category,
                mode,
                noCache: "1",
                editorMode: "1"
            });
            const response = await fetch(`${AWS_CONFIG.getStudentsEndpoint}?${params.toString()}`, { method: "GET", mode: "cors" });
            const data = await response.json();
            state.questions = data.status === "success" ? (data.questions || []) : [];
            renderRows();
            setStatus(`Loaded ${state.questions.length} question(s). Live papers are protected from editing by the cloud engine.`);
            if (data.status !== "success") alertUser("Lookup Notice", data.message || "No question data was returned.");
        } catch (error) {
            state.questions = [];
            renderRows();
            setStatus("Question lookup failed. Check cloud connection and retry.", true);
            alertUser("Lookup Error", "Unable to load uploaded questions right now.");
        }
    }

    async function save(index) {
        const alertUser = getAlert();
        const original = state.questions[index];
        const row = document.querySelector(`[data-qm-index="${index}"]`);
        if (!original || !row) return;
        const mode = getDefaultMode();
        const schoolID = mode === "MODE_A" ? "GLOBAL" : getSchoolID();

        const updated = {};
        row.querySelectorAll("[data-field]").forEach((field) => {
            updated[field.getAttribute("data-field")] = field.value;
        });

        try {
            const response = await fetch(AWS_CONFIG.registerEndpoint, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "UPDATE_QUESTION",
                    pk: original.PK,
                    sk: original.SK,
                    mode,
                    schoolID,
                    question: updated
                })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.status !== "success") throw new Error(result.message || "Question update failed.");
            state.questions[index] = { ...original, ...updated };
            setStatus("Question saved successfully.");
            alertUser("Saved", "Question updated successfully.");
        } catch (error) {
            setStatus(error.message || "Unable to save this question.", true);
            alertUser("Save Error", error.message || "Unable to save this question.");
        }
    }

    async function add() {
        const alertUser = getAlert();
        const subject = document.getElementById("qm-subject").value;
        const studentClass = document.getElementById("qm-class").value;
        const mode = getDefaultMode();
        const category = document.getElementById("qm-category").value;
        const term = document.getElementById("qm-term").value;
        const year = document.getElementById("qm-year").value || getAcademicYear();
        const schoolID = mode === "MODE_A" ? "GLOBAL" : getSchoolID();

        if (!subject || !studentClass || !category) {
            alertUser("Selection Required", "Select subject, class, and category before adding a question.");
            return;
        }

        const question = {
            Subject: subject,
            Class: studentClass,
            QuestionType: "OBJECTIVE",
            Question: "",
            A: "",
            B: "",
            C: "",
            D: "",
            Correct: "",
            CA1: 0,
            CA2: 0,
            EXAM: 0,
            ImageURL: "",
            AssessmentInstruction: ""
        };

        try {
            const response = await fetch(AWS_CONFIG.registerEndpoint, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "ADD_QUESTION",
                    mode,
                    schoolID,
                    year,
                    term,
                    category,
                    question
                })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.status !== "success") throw new Error(result.message || "Question add failed.");
            state.questions.push(result.question || question);
            renderRows();
            setStatus("New question added. Fill the row and click SAVE.");
            alertUser("Added", "A new blank question has been added.");
        } catch (error) {
            setStatus(error.message || "Unable to add this question.", true);
            alertUser("Add Error", error.message || "Unable to add this question.");
        }
    }

    async function remove(index) {
        const alertUser = getAlert();
        const original = state.questions[index];
        if (!original) return;
        const mode = getDefaultMode();
        const schoolID = mode === "MODE_A" ? "GLOBAL" : getSchoolID();
        if (!original.PK || !original.SK) {
            setStatus("This question cannot be deleted because its database key is missing. Reload the paper and try again.", true);
            alertUser("Delete Error", "This question cannot be deleted because its database key is missing. Reload the paper and try again.");
            return;
        }

        alertUser("CONFIRM DELETE", "Delete this question permanently from the database?", "confirm", async () => {
            try {
                const response = await fetch(AWS_CONFIG.registerEndpoint, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "DELETE_QUESTION",
                        pk: original.PK,
                        sk: original.SK,
                        mode,
                        schoolID
                    })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.status !== "success") throw new Error(result.message || "Question delete failed.");
                state.questions.splice(index, 1);
                renderRows();
                setStatus("Question deleted permanently from the database.");
                alertUser("Deleted", "Question deleted successfully.");
            } catch (error) {
                setStatus(error.message || "Unable to delete this question.", true);
                alertUser("Delete Error", error.message || "Unable to delete this question.");
            }
        });
    }

    async function removePaper() {
        const alertUser = getAlert();
        const subject = document.getElementById("qm-subject").value;
        const studentClass = document.getElementById("qm-class").value;
        const mode = getDefaultMode();
        const category = document.getElementById("qm-category").value;
        const term = document.getElementById("qm-term").value;
        const year = document.getElementById("qm-year").value || getAcademicYear();
        const schoolID = mode === "MODE_A" ? "GLOBAL" : getSchoolID();
        const humanize = window.LAEC_UTILS && window.LAEC_UTILS.humanizeSubject
            ? window.LAEC_UTILS.humanizeSubject
            : (value) => value.replace(/_/g, " ");

        if (!subject || !studentClass || !category) {
            alertUser("Selection Required", "Select subject, class, and category before deleting a paper.");
            return;
        }

        alertUser(
            "CONFIRM PAPER DELETE",
            `Delete all ${humanize(subject)} questions for ${studentClass} under ${category}? This cannot be undone.`,
            "confirm",
            async () => {
                try {
                    const response = await fetch(AWS_CONFIG.registerEndpoint, {
                        method: "POST",
                        mode: "cors",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "DELETE_QUESTION_PAPER",
                            mode,
                            schoolID,
                            year,
                            term,
                            category,
                            subject,
                            studentClass
                        })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok || result.status !== "success") throw new Error(result.message || "Paper delete failed.");
                    state.questions = [];
                    renderRows();
                    setStatus(result.message || "Selected paper deleted permanently from the database.");
                    alertUser("Deleted", result.message || "Selected paper deleted successfully.");
                } catch (error) {
                    setStatus(error.message || "Unable to delete the selected paper.", true);
                    alertUser("Delete Error", error.message || "Unable to delete the selected paper.");
                }
            }
        );
    }

    function init() {
        const host = document.getElementById("exam-mgt") || document.getElementById("exam-center");
        if (!host || document.getElementById("question-manager-card")) return;
        const promotionHeading = Array.from(host.querySelectorAll(".card h3"))
            .find(node => node.textContent.includes("Academic Session & Promotion"));
        const promotionCard = promotionHeading ? promotionHeading.closest(".card") : null;
        if (promotionCard && window.location.pathname.toLowerCase().includes("/admin/")) {
            promotionCard.insertAdjacentHTML("beforebegin", buildManagerCard());
        } else {
            host.insertAdjacentHTML("beforeend", buildManagerCard());
        }
        syncFromSession();
    }

    window.LAECQuestionManager = {
        init,
        load,
        save,
        add,
        remove,
        removePaper,
        syncFromSession
    };

    document.addEventListener("DOMContentLoaded", init);
})();
