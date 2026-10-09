<template>
  <!--
    PRD §4.7 `/ict/` — ICT Center (ICT Administrator).

    Origin: origin-pages/ict.html. DOM 867–1464, script 1466–3024, style 26–863
    (generated into src/styles/ict-page.css). Seven tab panels keep the origin
    ids; `#register-portal-root` and `#exam-session-root` stay empty in the
    markup because the first-party libraries render into them.
  -->
  <div class="bubble-field" aria-hidden="true">
    <span class="bubble" style="--size: 72px; --left: 6%; --duration: 19s; --delay: -4s; --drift: 34px"></span>
    <span class="bubble" style="--size: 46px; --left: 14%; --duration: 15s; --delay: -10s; --drift: -26px"></span>
    <span class="bubble" style="--size: 118px; --left: 24%; --duration: 24s; --delay: -7s; --drift: 52px"></span>
    <span class="bubble" style="--size: 58px; --left: 38%; --duration: 17s; --delay: -2s; --drift: -42px"></span>
    <span class="bubble" style="--size: 92px; --left: 52%; --duration: 22s; --delay: -13s; --drift: 30px"></span>
    <span class="bubble" style="--size: 40px; --left: 63%; --duration: 14s; --delay: -5s; --drift: -18px"></span>
    <span class="bubble" style="--size: 132px; --left: 72%; --duration: 27s; --delay: -15s; --drift: -58px"></span>
    <span class="bubble" style="--size: 64px; --left: 84%; --duration: 18s; --delay: -8s; --drift: 36px"></span>
    <span class="bubble" style="--size: 34px; --left: 93%; --duration: 13s; --delay: -1s; --drift: -24px"></span>
  </div>

  <AppLoading :visible="loadingVisible" :text="loadingText" />

  <AppAlert
    :visible="alertVisible"
    :title="alertTitle"
    :msg="alertMsg"
    cancel-visible
    :confirm-visible="alertConfirmVisible"
    @close="closeAlert()"
    @confirm="confirmAlert()"
  >
    <template #media>
      <div id="alert-photo-area" :style="alertPhoto ? { display: 'block', margin: '15px auto' } : { display: 'none', margin: '15px auto' }">
        <img
          id="alert-passport"
          :src="alertPhoto"
          style="width: 150px; height: 150px; border-radius: 10px; border: 3px solid var(--laec-blue); object-fit: cover"
        />
      </div>
    </template>
  </AppAlert>

  <AppShell
    :role="currentRole"
    :role-label="navMeta.roleLabel"
    :breadcrumb="navMeta.breadcrumb"
    :groups="navGroups"
    :scope="SHELL_SCOPE"
    :scope-kind="navMeta.scopeKind"
    :active-id="activeTab"
    :identity="schoolIdentity"
    @select="showTab"
    @logout="handleLogout"
  >

  <button class="back-to-top" id="backToTopBtn" aria-label="Back to top" :class="{ visible: backToTopVisible }" @click="scrollToTopPage()">
    ↑
  </button>

  <div class="view-well">
    <datalist id="reg-numbers-list">
      <option v-for="o in regNumberOptions" :key="o.value" :value="o.value"></option>
    </datalist>
    <datalist id="student-names-list">
      <option v-for="o in studentNameOptions" :key="o.value + o.label" :value="o.value">{{ o.label }}</option>
    </datalist>

    <!-- ── OVERVIEW ─────────────────────────────────────────────────── -->
    <div id="dashboard" class="tab-panel" :class="{ active: activeTab === 'dashboard' }">
      <div class="control-box">
        <div>
          <h2 style="margin: 0">School Performance Summary</h2>
          <p id="global-mode-hint" style="opacity: 0.8; margin: 5px 0 0">{{ globalModeHint }}</p>
        </div>
        <div>
          <button class="btn-success" @click="loadSchoolStats()">REFRESH DASHBOARD</button>
        </div>
      </div>
      <div class="stats-grid">
        <!--
          Stat cards share one value treatment (see styles/overview-charts.css).
          Each value carried its own inline font-size and the second card a
          `border-left-color` that made it look selected; there is no selection
          concept on this row, so the tint only broke the set.
        -->
        <div class="stat-card"><h4>My Registered Students</h4><div class="value" id="count-total">{{ countTotal }}</div></div>
        <div class="stat-card">
          <h4>Active Academic Session</h4>
          <div class="value stat-value-accent" id="current-session-display">{{ currentSessionDisplay }}</div>
        </div>
        <div
          id="promotion-alert-banner"
          class="stat-card promotion-alert-card"
          :style="promotionNoticeVisible ? { display: 'block' } : { display: 'none' }"
          @click="showPromotionNoticeDetails()"
        >
          <h4>Promotion Notice</h4>
          <div class="value" id="promotion-alert-msg">{{ promotionNoticeMessage }}</div>
        </div>
        <div class="stat-card">
          <h4>System Mode</h4>
          <div class="value stat-value-accent" id="current-mode-display">{{ currentModeShort }}</div>
          <p class="stat-sub">{{ currentModeDisplay }}</p>
        </div>
        <div class="stat-card">
          <h4>Cloud Sync</h4>
          <div class="value" id="ping-ms" :class="`stat-tone-${pingTone}`">{{ pingMs }}</div>
          <p class="stat-sub" :title="`${pingWhat} Last checked ${pingCheckedAt || 'not yet'}.`">
            {{ pingWhat }} · {{ pingCheckedAt }}
          </p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="overview-card-header">
            <div>
              <h3>Subject Performance Analytics</h3>
              <p id="subject-performance-note" class="overview-chart-note" v-html="subjectPerformanceNote"></p>
            </div>
          </div>
          <div class="overview-filter-row">
            <div style="display: flex; gap: 15px; align-items: center">
              <div>
                <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 5px">Academic Session</label>
                <select id="pie-year-filter" v-model="pieYearFilter" style="padding: 6px; border-radius: 6px; border: 1px solid #ddd" @change="loadSchoolStats()">
                  <option v-for="year in yearOptions" :key="year" :value="'YEAR#' + year">{{ year }}/{{ year + 1 }}</option>
                </select>
              </div>
              <div>
                <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 5px">Section Filter</label>
                <select id="subject-stage-filter" v-model="subjectStageFilter" style="padding: 6px; border-radius: 6px; border: 1px solid #ddd" @change="renderSubjectPerformanceChart()">
                  <option value="ALL">All Levels</option>
                  <option value="JUNIOR">Junior Section</option>
                  <option value="SENIOR">Senior Section</option>
                </select>
              </div>
            </div>
          </div>
          <div class="overview-chart-frame">
            <div class="overview-chart-canvas" v-show="!subjectPerformanceEmpty">
              <canvas id="subjectStatsChart"></canvas>
            </div>
            <ChartEmptyState
              v-if="subjectPerformanceEmpty"
              :title="subjectEmptyTitle"
              :description="subjectEmptyDesc"
            />
          </div>
        </div>
        <div class="card">
          <div class="overview-card-header">
            <div>
              <h3>School Population Histogram</h3>
              <p id="class-population-note" class="overview-chart-note" v-html="classPopulationNote"></p>
            </div>
          </div>
          <div class="overview-chart-frame">
            <div class="overview-chart-canvas overview-chart-canvas-bars" v-show="!classPopulationEmpty">
              <canvas id="classPopulationChart"></canvas>
            </div>
            <ChartEmptyState
              v-if="classPopulationEmpty"
              title="No students yet"
              description="No students are registered for this college, so there is no class distribution to show. The histogram appears here as soon as the directory has entries."
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ── REGISTRATION PORTAL ──────────────────────────────────────── -->
    <div id="register" class="tab-panel" :class="{ active: activeTab === 'register' }">
      <div id="register-portal-root"></div>
    </div>

    <!-- ── STUDENT DIRECTORY ────────────────────────────────────────── -->
    <div id="students" class="tab-panel" :class="{ active: activeTab === 'students' }">
      <div class="card">
        <div class="grid-2">
          <div>
            <label>Current School (Locked)</label>
            <input type="text" id="school-lock-display" readonly :value="schoolLockDisplay" style="background: #f0f0f0; font-weight: bold; color: var(--laec-blue)" />
          </div>
          <div>
            <label>Quick Search</label>
            <input type="text" id="dir-search" list="student-names-list" placeholder="Search Student Name or ID..." v-model="dirSearch" @keyup="localSearch()" />
          </div>
          <div>
            <label>Filter By Class</label>
            <select id="dir-class-filter" v-model="dirClassFilter" @change="getStudentsFromLambda()">
              <option value="ALL">All Classes</option>
              <option v-for="c in CLASS_OPTIONS" :key="c" :value="c">{{ c.replace('SS', 'SS ') }}</option>
            </select>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 15px">
          <button class="btn-primary" @click="getStudentsFromLambda()">LOAD MY DIRECTORY</button>
          <button class="btn-success" @click="exportStudentData()">DOWNLOAD EXCEL EXPORT</button>
          <button class="btn-primary" @click="downloadStudentCredentialPdf()">DOWNLOAD PDF</button>
        </div>

        <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5edf6">
          <h3 style="margin: 0 0 10px; font-size: 0.95rem; color: var(--laec-blue)">Student Subject Editor</h3>
          <div class="grid-2">
            <div>
              <label>Select Student</label>
              <select id="subject-editor-student" v-model="subjectEditorStudent" @change="loadStudentSubjectEditor()">
                <option value="">Load directory, then choose student...</option>
                <option v-for="s in subjectEditorStudents" :key="s.RegNo" :value="s.RegNo">
                  {{ s.FullName }} - {{ s.RegNo }} ({{ s.Class }})
                </option>
              </select>
            </div>
            <div>
              <label>Current Subjects</label>
              <input type="text" id="subject-editor-summary" readonly :value="subjectEditorSummary" style="background: #f7f9fc" />
            </div>
          </div>
          <div
            id="subject-editor-grid"
            style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; max-height: 260px; overflow: auto; margin-top: 12px; padding: 10px; border: 1px solid #dbe6f2; border-radius: 10px; background: #f8fbff"
          >
            <label
              v-for="subject in subjectEditorOptions"
              :key="subject"
              style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e1e8f0; border-radius: 8px; padding: 8px; font-size: 0.75rem; font-weight: 700; color: #344054"
            >
              <input type="checkbox" class="subject-editor-check" :value="subject" v-model="subjectEditorChecks" style="width: auto" />
              <span>{{ getSubjectEditorLabel(subject, subjectEditorClass) }}</span>
            </label>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 12px">
            <button class="btn-primary" v-if="sessionStore.can('students.manage')" @click="saveStudentSubjectEditor()">SAVE SUBJECT CHANGES</button>
            <button
              style="background: #eef2f7; color: #344054; border: 1px solid #cfd8e3; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer"
              @click="clearStudentSubjectEditor()"
            >
              CLEAR SELECTION
            </button>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table id="studentTable">
          <thead>
            <tr>
              <th>S/N</th>
              <th>Photo</th>
              <th>Full Name</th>
              <th>Reg ID</th>
              <th>Class</th>
              <th>Date</th>
              <th colspan="3" style="text-align: center">Actions</th>
            </tr>
          </thead>
          <tbody id="student-table-body">
            <tr v-for="(s, index) in visibleStudents" :key="s.RegNo">
              <td>{{ index + 1 }}</td>
              <td><img :src="s.PassportURL || '/nicegene_logo.png'" class="photo-circle" /></td>
              <td><b>{{ s.FullName }}</b></td>
              <td style="color: var(--laec-blue); font-weight: bold">{{ s.RegNo }}</td>
              <td>{{ s.Class }}</td>
              <td><span style="color: #666; font-weight: bold">{{ studentJoined(s) }}</span></td>
              <td>
                <button
                  style="background: #f0f0f0; border: 1px solid #ccc; font-size: 9px; padding: 4px 8px; border-radius: 4px; cursor: pointer"
                  @click="viewStudentProfileByReg(s.RegNo)"
                >
                  VIEW
                </button>
              </td>
              <td>
                <button
                  style="background: var(--danger); color: white; border: none; font-size: 9px; padding: 4px 8px; border-radius: 4px; cursor: pointer"
                  @click="confirmDeleteStudent(s.RegNo)"
                >
                  DELETE
                </button>
              </td>
              <td>
                <button
                  style="background: #f0f0f0; border: 1px solid #ccc; font-size: 9px; padding: 4px 8px; border-radius: 4px; cursor: pointer"
                  @click="printStudentSlip(s.RegNo)"
                >
                  PRINT
                </button>
              </td>
            </tr>
            <tr v-if="!visibleStudents.length">
              <td colspan="9" style="text-align: center; color: #999">No student records found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── SCHOOL RESULTS ───────────────────────────────────────────── -->
    <div id="results" class="tab-panel" :class="{ active: activeTab === 'results' }">
      <div class="card">
        <h3>School Results Archive</h3>
        <div class="grid-2">
          <div>
            <label>Academic Year</label>
            <select id="res-year" v-model="resYear">
              <option v-for="year in yearOptions" :key="year" :value="year + '/' + (year + 1)">{{ year }}/{{ year + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Term</label>
            <select id="res-term" v-model="resTerm">
              <option value="TERM1">1ST TERM</option>
              <option value="TERM2">2ND TERM</option>
              <option value="TERM3">3RD TERM</option>
            </select>
          </div>
          <div>
            <label>Target Category</label>
            <select id="res-category" v-model="resCategory">
              <option value="CA1">CA 1</option>
              <option value="CA2">CA 2</option>
              <option value="EXAM">EXAM</option>
              <option value="ALL_CUMULATIVE" style="font-weight: bold; color: var(--laec-blue)">All Results</option>
            </select>
          </div>
          <div>
            <label>Result Mode (Joint/Internal)</label>
            <select id="res-mode" v-model="resMode">
              <option value="MODE_A">MODE A (JOINT EXAM)</option>
              <option value="MODE_B">MODE B (INTERNAL EXAM)</option>
            </select>
          </div>
          <div>
            <label>Subject</label>
            <input type="text" id="res-subject" list="res-subject-options" placeholder="Type or choose a subject" v-model="resSubjectInput" @input="localResultSearch()" />
            <datalist id="res-subject-options">
              <optgroup v-for="group in SUBJECT_GROUPS" :key="group.label" :label="group.label">
                <option v-for="subject in group.subjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option>
              </optgroup>
            </datalist>
          </div>
          <div>
            <label>Class</label>
            <select id="res-class" v-model="resClassFilter" @change="localResultSearch()">
              <option value="ALL">All Classes</option>
              <option v-for="c in CLASS_OPTIONS" :key="c" :value="c">{{ c.replace('SS', 'SS ') }}</option>
            </select>
          </div>
          <div>
            <label>Filter By Student Name</label>
            <input type="text" id="res-reg-filter" list="reg-numbers-list" placeholder="Type student name" v-model="resRegFilter" @keyup="localResultSearch()" />
          </div>
        </div>
        <div class="filter-action-cell">
          <label>&nbsp;</label>
          <div class="filter-action-buttons">
            <button class="btn-primary" @click="loadSchoolResults()">LOAD RESULTS</button>
            <button class="btn-warning" v-if="sessionStore.can('results.remark')" @click="remarkLoadedResults()">REMARK</button>
            <button class="btn-success" @click="exportToExcel('resultsTable', 'School_Results')">DOWNLOAD SPREADSHEET</button>
            <button class="btn-danger" v-if="sessionStore.can('results.delete')" @click="deleteSelectedSubjectResults()">DELETE SUBJECT RESULTS</button>
          </div>
        </div>
      </div>
      <div class="result-scroll-shell">
        <button type="button" class="result-scroll-btn result-scroll-left" aria-label="Scroll results left" @click="scrollResultsTable(-1)">&lt;</button>
        <button type="button" class="result-scroll-btn result-scroll-right" aria-label="Scroll results right" @click="scrollResultsTable(1)">&gt;</button>
        <div class="table-responsive">
          <table id="resultsTable">
            <thead id="results-thead">
              <tr>
                <th>S/N</th>
                <th>Student Name</th>
                <th>Reg No</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="results-table-body">
              <tr v-for="(r, index) in renderedResultList" :key="(r.PK || '') + (r.SK || '') + index">
                <td>{{ index + 1 }}</td>
                <td><b>{{ r.FullName }}</b></td>
                <td>{{ r.RegNo }}</td>
                <td>{{ getResultClassValue(r) || 'N/A' }}</td>
                <td>{{ r.Subject }}</td>
                <td style="font-weight: bold">{{ formatResultScore(r) }}</td>
                <td>
                  <div style="display: flex; align-items: flex-start; justify-content: center; gap: 6px">
                    <span v-html="formatResultStatus(r)"></span>
                    <details>
                      <summary style="list-style: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--laec-blue); font-weight: bold">+</summary>
                      <div style="min-width: 120px; margin-top: 6px; padding: 8px; background: white; border: 1px solid #dbe6f2; border-radius: 8px; box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12)">
                        <div style="font-size: 10px; font-weight: bold; color: #475467; margin-bottom: 6px" v-html="formatResultStatus(r)"></div>
                        <button class="btn-danger" style="width: 100%; padding: 6px 10px; font-size: 10px" @click="confirmDeleteResult(r.PK || '', r.SK || '')">
                          DELETE
                        </button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
              <tr v-if="!renderedResultList.length">
                <td colspan="7" style="text-align: center; color: #999">No data found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── EXAMINATION CENTER ───────────────────────────────────────── -->
    <div id="exam-center" class="tab-panel" :class="{ active: activeTab === 'exam-center' }">
      <div class="control-box">
        <div>
          <h2 style="margin: 0">Internal Exam Control</h2>
          <p id="local-mode-hint" style="opacity: 0.8; margin: 5px 0 0">{{ localModeHint }}</p>
        </div>
        <div class="mode-toggle-group">
          <button id="mode-a-btn" :class="modeAButtonClass" @click="toggleLocalMode('MODE_A')">MODE A (JOINT)</button>
          <button id="mode-b-btn" :class="modeBButtonClass" @click="toggleLocalMode('MODE_B')">MODE B (INTERNAL)</button>
        </div>
      </div>

      <div class="card" style="border-top: 5px solid var(--laec-blue)">
        <h3 style="color: var(--laec-blue)">⚙️ Examination Global Settings</h3>
        <div class="grid-2">
          <div>
            <label>Active Category</label>
            <select id="global-exam-type" v-model="globalExamType" @change="handleCategoryChange()">
              <option value="#">...Select Category...</option>
              <option value="CA1">CA 1</option>
              <option value="CA2">CA 2</option>
              <option value="EXAM">Exam</option>
            </select>
          </div>
          <div>
            <label>Default Safety Timer (Optional HH:MM:SS)</label>
            <div style="display: flex; gap: 5px">
              <input type="number" id="timer-h" placeholder="HH" style="text-align: center" v-model="timerH" />
              <input type="number" id="timer-m" placeholder="MM" style="text-align: center" v-model="timerM" />
              <input type="number" id="timer-s" placeholder="SS" style="text-align: center" v-model="timerS" />
            </div>
          </div>
        </div>
        <!-- rendered by the first-party /exam-session-controls.js module -->
        <div id="exam-session-root"></div>
        <button class="btn-primary" style="margin-top: 20px; width: 100%" @click="updateExamGlobal()">SYNC INTERNAL SESSION SETTINGS</button>
      </div>

      <div class="grid-2">
        <div class="card" style="border-top: 5px solid var(--success)">
          <h3 style="color: var(--success)">🚀 Internal Question Blaster</h3>
          <label>Target Category</label>
          <select id="blast-session" v-model="blastSession" style="border-left: 4px solid var(--success)">
            <option value="CA1">CA 1</option>
            <option value="CA2">CA 2</option>
            <option value="EXAM">EXAM</option>
          </select>

          <div style="margin-top: 15px; padding: 12px; background: #f0fff4; border-radius: 8px; border: 1px dashed var(--success)">
            <label style="color: var(--success)">Student Exam Duration (HH:MM:SS)</label>
            <div style="display: flex; gap: 8px; margin-top: 5px">
              <input type="number" id="blast-h" placeholder="HH" v-model="blastH" style="text-align: center; background: white" />
              <input type="number" id="blast-m" placeholder="MM" v-model="blastM" style="text-align: center; background: white" />
              <input type="number" id="blast-s" placeholder="SS" v-model="blastS" style="text-align: center; background: white" />
            </div>
            <p style="font-size: 10px; color: #555; margin-top: 8px; font-style: italic">* Mandatory: Paper-specific writing time.</p>
          </div>

          <label style="margin-top: 10px">Upload Question Pool (Excel)</label>
          <input type="file" id="excel-blast" accept=".xlsx, .xls" style="margin-bottom: 10px" />
          <label style="margin-top: 10px">Assessment Specific Instruction</label>
          <textarea
            id="blast-instruction"
            rows="4"
            v-model="blastInstruction"
            placeholder="Example: Answer all questions. Use the diagram supplied for questions 4-6."
            style="width: 100%; box-sizing: border-box; margin-bottom: 10px; resize: vertical"
          ></textarea>
          <p style="margin: 0 0 10px; font-size: 0.78rem; color: #5f7087; line-height: 1.5">
            Go-live subject control now lives in the internal session settings card above. Use this blaster only to upload papers and set the
            compulsory student timer for that paper batch.
          </p>

          <button class="btn-success" style="width: 100%; font-weight: 800; padding: 15px" @click="handleBulkBlast()">
            START SYNCHRONIZED BLAST
          </button>
        </div>

        <div class="card" style="border-top: 5px solid var(--laec-accent)">
          <h3 style="color: var(--laec-blue)">🖼️ Internal Diagram Hosting</h3>
          <label>Upload Image</label>
          <input type="file" id="img-hosting" accept="image/*" style="margin-bottom: 10px" />
          <button class="btn-primary" style="width: 100%" @click="uploadQuestionImage()">GET CLOUD LINK</button>

          <div
            id="hosting-result-area"
            :class="{ hidden: !hostingResultVisible }"
            style="margin-top: 15px; padding: 12px; background: #eef5ff; border-radius: 8px; border: 1px solid var(--laec-blue)"
          >
            <label style="color: var(--laec-blue); font-size: 10px">Cloud URL (Paste into your Excel):</label>
            <div style="display: flex; gap: 5px; margin-top: 5px">
              <input type="text" id="generated-url-field" readonly v-model="generatedUrl" style="flex: 1; padding: 8px; font-size: 11px; background: white" />
              <button class="btn-success" style="padding: 5px 12px; font-size: 11px" @click="copyDiagramURL()">COPY</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── PAST QUESTIONS ───────────────────────────────────────────── -->
    <div id="past-questions" class="tab-panel" :class="{ active: activeTab === 'past-questions' }">
      <div class="card">
        <h3>Global Archive Access</h3>
        <div class="grid-2">
          <div>
            <label>Question Source (Mode)</label>
            <select id="pq-mode" v-model="pqMode">
              <option value="MODE_A">MODE A (GLOBAL QUESTIONS)</option>
              <option value="MODE_B">MODE B (INTERNAL QUESTIONS)</option>
            </select>
          </div>
          <div>
            <label>Subject</label>
            <select id="pq-subject" v-model="pqSubject">
              <option value="#">....Select Subject....</option>
              <optgroup v-for="group in SUBJECT_GROUPS" :key="group.label" :label="group.label">
                <option v-for="subject in group.subjects" :key="subject.value" :value="subject.value">{{ subject.label }}</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label>Term Filter</label>
            <select id="pq-term" v-model="pqTerm">
              <option value="TERM1">Term 1</option>
              <option value="TERM2">Term 2</option>
              <option value="TERM3">Term 3</option>
            </select>
          </div>
          <div>
            <label>Target Category</label>
            <select id="pq-type" v-model="pqType">
              <option value="CA1">CA 1</option>
              <option value="CA2">CA 2</option>
              <option value="EXAM">EXAM</option>
            </select>
          </div>
          <div>
            <label>Year</label>
            <select id="pq-year" v-model="pqYear">
              <option v-for="year in yearOptions" :key="year" :value="year + '/' + (year + 1)">{{ year }}/{{ year + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Target Class</label>
            <select id="pq-class" v-model="pqClass">
              <option v-for="c in CLASS_OPTIONS" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px">
          <button class="btn-primary" @click="loadPastQuestions()">LOAD QUESTIONS</button>
          <button class="btn-success" @click="exportToExcel('pqTable', 'Question_Archive_Export')">DOWNLOAD QUESTIONS</button>
        </div>
      </div>
      <div class="table-responsive">
        <table id="pqTable">
          <thead>
            <tr><th>SN</th><th>Subject</th><th>Class</th><th>Type</th><th>Question text</th></tr>
          </thead>
          <tbody id="pq-table-body">
            <tr v-for="(q, index) in pastQuestionRows" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ LAEC.humanizeSubject(q.Subject || '') }}</td>
              <td>{{ q.Class }}</td>
              <td>{{ pqType }}</td>
              <td style="font-size: 11px">{{ q.Question || q.Text }}</td>
            </tr>
            <tr v-if="!pastQuestionRows.length">
              <td colspan="5" style="text-align: center; color: #999">{{ archiveEmptyLabel }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── SYSTEM HEALTH ────────────────────────────────────────────── -->
    <div id="health" class="tab-panel" :class="{ active: activeTab === 'health' }">
      <div class="card" style="text-align: center; padding: 2rem 1rem">
        <h3>Cloud Heartbeat details (Latency Nigeria to USA)</h3>
        <h1 id="ping-large" style="font-size: 5rem; margin: 0; color: var(--laec-blue)">{{ pingLarge }}</h1>
        <p id="ping-status" style="font-weight: bold">{{ pingStatus }}</p>
      </div>

      <div class="card" style="border-top: 5px solid var(--danger)">
        <h3>Real-Time Proctoring &amp; Invigilation Monitor</h3>
        <p style="font-size: 0.8rem; color: #666; margin-bottom: 1.5rem">
          🚨 <b>Internal Oversight:</b> Strictly monitoring flagged violations for this college.
        </p>

        <div class="grid-2" style="margin-bottom: 20px">
          <div>
            <label>Academic Year</label>
            <select id="invigilator-year-filter" v-model="invigilatorYearFilter">
              <option v-for="year in yearOptions" :key="year" :value="year + '/' + (year + 1)">{{ year }}/{{ year + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Term</label>
            <select id="invigilator-term-filter" v-model="invigilatorTermFilter">
              <option value="TERM1">1st Term</option>
              <option value="TERM2">2nd Term</option>
              <option value="TERM3">3rd Term</option>
            </select>
          </div>
          <div>
            <label>Violation Mode Filter</label>
            <select id="invigilator-mode-filter" v-model="invigMode">
              <option value="MODE_B">Internal Exam (Mode B)</option>
            </select>
          </div>
          <div>
            <label>Class</label>
            <select id="invigilator-class-filter" v-model="invigClass" @change="refreshInvigilatorFeed()">
              <option value="ALL">All Classes</option>
              <option value="JSS1">JSS 1</option>
              <option value="JSS2">JSS 2</option>
              <option value="JSS3">JSS 3</option>
              <option value="SS1">SS 1</option>
              <option value="SS2">SS 2</option>
            </select>
          </div>
          <div>
            <label>Subject</label>
            <input type="text" id="invigilator-subject-filter" list="res-subject-options" placeholder="Type or choose subject" v-model="invigSubject" @change="refreshInvigilatorFeed()" />
          </div>
          <div style="display: flex; align-items: flex-end; gap: 10px">
            <button class="btn-primary" style="flex: 1; border-radius: 4px; padding: 10px 14px" @click="refreshInvigilatorFeed()">REFRESH MONITOR</button>
            <button class="btn-danger" style="flex: 1; border-radius: 4px; padding: 10px 14px" @click="deleteFilteredFlaggedResults()">
              DELETE FILTERED FLAGGED RESULTS
            </button>
            <button class="btn-success" style="flex: 1; border-radius: 4px; padding: 10px 14px" @click="exportToExcel('invigilatorTable', 'Security_Violation_Log')">
              DOWNLOAD VIOLATION LOG
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table id="invigilatorTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Student Name</th>
                <th>School</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Exam Category</th>
                <th>Violation Reason</th>
              </tr>
            </thead>
            <tbody id="invigilator-feed-body">
              <tr v-for="(result, index) in invigilatorRows" :key="(result.PK || '') + (result.SK || '') + index">
                <td>{{ result.Timestamp ? new Date(result.Timestamp).toLocaleString() : '---' }}</td>
                <td>
                  <b>{{ result.FullName || 'UNKNOWN' }}</b><br />
                  <span style="font-size: 0.72rem; color: #777">{{ result.RegNo || '' }}</span>
                </td>
                <td>{{ result.SchoolID || 'N/A' }}</td>
                <td>{{ getResultClassValue(result) || 'N/A' }}</td>
                <td>{{ LAEC.humanizeSubject(result.Subject || '') }}</td>
                <td>{{ result.Category || 'N/A' }} ({{ result.Mode || 'N/A' }})</td>
                <td style="color: var(--danger); font-weight: bold">{{ result.Violation || 'Tab Switch/Focus Lost' }}</td>
              </tr>
              <tr v-if="!invigilatorRows.length">
                <td colspan="7" style="text-align: center; color: #999">{{ invigilatorEmptyLabel }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  <footer class="system-footer" style="width: 100%; padding: 20px 0; background: var(--border); border-top: 1px solid var(--border); margin-top: auto; text-align: center">
    <div style="max-width: 1200px; margin: 0 auto; padding: 0 20px">
      <p style="margin: 5px 0 0; font-size: 0.65rem; font-weight: 500; color: #55606b; text-transform: uppercase; letter-spacing: 2px">
        LAEC CLOUD-BASED INTEGRATED EXAMINATION MANAGEMENT SYSTEM
      </p>
      <p style="margin: 0; font-size: 0.8rem; color: #55606b; font-weight: 500; letter-spacing: 0.5px">
        &copy; {{ copyrightYear }}
        <span style="color: var(--laec-blue); font-weight: 700">NICEGENE TECHNOLOGIES</span>.
        All Rights Reserved.
      </p>
    </div>
  </footer>
  </div>
  </AppShell>
</template>

<script setup lang="ts">
/**
 * PRD §4.7 `/ict/` — ICT Center.
 *
 * Transcribed from origin-pages/ict.html (DOM 867–1464, script 1466–3024).
 * Notes on the deviations from a literal port:
 *  - No client-side guard of any kind (D-11 / PRD D6): `window.onload` never
 *    checks `LAEC_Session`, not even for presence.
 *  - The origin's <title> duplicates /ca/ — reproduced verbatim (DEV-12).
 *  - `SCHOOL_NAMES` on this page uses typographic apostrophes ("Finbarr's",
 *    "Kizito's", "Girl's"), unlike /ca/'s straight ones; each page keeps its
 *    own map, as served.
 *  - The first-party libraries are pointed at the mock transport (D-39) and the
 *    registration portal at a non-routable host (DEV-9).
 *  - The results table's Status cell carries the origin's `+` disclosure
 *    (formatResultStatusAction), which is the only place the per-row answer
 *    script viewer is reachable from on this page.
 */
import { Chart } from 'chart.js/auto';
import * as XLSX from 'xlsx';
import AWS from 'aws-sdk';
import { computed, nextTick, onMounted, ref } from 'vue';
import { jsPDF } from 'jspdf';
import { callApi } from '../api';
import AppShell from '../components/AppShell.vue';
import ChartEmptyState from '../components/ChartEmptyState.vue';
import AppAlert from '../components/AppAlert.vue';
import AppLoading from '../components/AppLoading.vue';
import { canOpenPanel, filterNav, navFor, takePendingPanel } from '../lib/nav';
import { useSessionStore } from '../stores/session';
import {
  ACADEMIC_YEARS,
  LAEC,
  buildLibraryUtils,
  dedupeInvigilatorResults,
  exportToExcel,
  formatResultScore,
  formatResultStatus,
  formatTermLabel,
  getAcademicYearStart,
  getResultClassValue,
  installLibraryFetchBridge,
  createMockGetFetch,
  installResultScriptViewer,
  INVIGILATOR_CATEGORIES,
  isTimeExpiryViolation,
  msgOf,
  normalizeSubjectInput,
  resultMatchesFilters,
} from '../lib/console';
import { useIdleTimeout } from '../composables/useIdleTimeout';
import { STORAGE_KEYS } from '../types';
import type { ExamCategory, ExamTerm, Question, ResultRecord, Student } from '../types';
import '../styles/ict-page.css';
import '../styles/overview-charts.css';

(window as unknown as { XLSX: typeof XLSX }).XLSX = XLSX;

/* The flat tab strip is gone (D-60, D-62): its sections and their order now live
   in src/lib/nav.ts, which every console reads, so a role's navigation has one
   definition rather than one per view. The tab ids are unchanged, so showTab(),
   refreshTabData() and the saved-tab restore all still address the same panels. */

const CLASS_OPTIONS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'] as const;

/** The `#res-subject-options` datalist, as served (ict.html lines 1081–1152). */
const SUBJECT_GROUPS = [
  {
    label: 'Core Compulsory Subjects',
    subjects: [
      { value: 'MATHEMATICS', label: 'Mathematics' },
      { value: 'ENGLISH_LANGUAGE', label: 'English Language' },
      { value: 'CITIZENSHIP_HERITAGE', label: 'Citizenship & Heritage Studies' },
      { value: 'DIGITAL_TECHNOLOGY', label: 'Digital Technology (ICT)' },
      { value: 'CIVIC_EDUCATION', label: 'Civic Education' },
      { value: 'CRS', label: 'Christian Religious Studies (CRS)' },
      { value: 'NIGERIAN_LANGUAGE', label: 'Nigerian Language (Yoruba/Igbo/Hausa)' },
    ],
  },
  {
    label: 'Junior Secondary Subjects',
    subjects: [
      { value: 'INTERMEDIATE_SCIENCE', label: 'Intermediate Science (B/ Science)' },
      { value: 'BASIC_TECH', label: 'Basic Tech' },
      { value: 'BUSINESS_STUDIES', label: 'Business Studies' },
      { value: 'NIGERIAN_HISTORY', label: 'Nigerian History' },
      { value: 'HISTORY', label: 'History' },
      { value: 'NATIONAL_VALUES', label: 'National Values (NVE)' },
      { value: 'BASIC_SCIENCE_TECHNOLOGY', label: 'Basic Science and Technology (BST)' },
      { value: 'HOME_ECONOMICS', label: 'Home Economics' },
      { value: 'CIVIC_SECURITY', label: 'Civic & Security Studies' },
      { value: 'AGRIC_SCIENCE_JSS', label: 'Agric' },
      { value: 'SOCIAL_CITIZENSHIP_STUDIES', label: 'Social & Citizenship Studies' },
      { value: 'MUSIC', label: 'Music' },
      { value: 'FINE_ART', label: 'Fine Art' },
      { value: 'CCA', label: 'Cultural & Creative Arts' },
      { value: 'PHE', label: 'Physical & Health Education' },
      { value: 'FRENCH', label: 'French (Optional)' },
    ],
  },
  {
    label: 'Senior Science & Maths',
    subjects: [
      { value: 'BIOLOGY', label: 'Biology' },
      { value: 'CHEMISTRY', label: 'Chemistry' },
      { value: 'PHYSICS', label: 'Physics' },
      { value: 'FURTHER_MATHEMATICS', label: 'Further Mathematics' },
      { value: 'AGRIC_SCIENCE_SSS', label: 'Agricultural Science' },
      { value: 'PHE', label: 'Physical Health Education' },
      { value: 'GEOGRAPHY', label: 'Geography' },
      { value: 'TECHNICAL_DRAWING', label: 'Technical Drawing' },
      { value: 'BASIC_ELECTRICITY', label: 'Basic Electricity' },
      { value: 'FOOD_NUTRITION', label: 'Foods and Nutrition' },
    ],
  },
  {
    label: 'Senior Arts & Humanities',
    subjects: [
      { value: 'LITERATURE_IN_ENGLISH', label: 'Literature in English' },
      { value: 'GOVERNMENT', label: 'Government' },
      { value: 'HISTORY', label: 'History' },
      { value: 'FRENCH', label: 'French' },
      { value: 'YORUBA', label: 'Yoruba' },
      { value: 'VISUAL_ARTS', label: 'Visual Arts' },
      { value: 'MUSIC', label: 'Music' },
      { value: 'HOME_MANAGEMENT', label: 'Home Management' },
      { value: 'CRS', label: 'Christian Religious Studies (CRS)' },
    ],
  },
  {
    label: 'Senior Commercial',
    subjects: [
      { value: 'ECONOMICS', label: 'Economics' },
      { value: 'COMMERCE', label: 'Commerce' },
      { value: 'FINANCIAL_ACCOUNTING', label: 'Accounting' },
      { value: 'MARKETING', label: 'Marketing' },
      { value: 'FURTHER_MATHEMATICS', label: 'Further Mathematics (Business)' },
      { value: 'GOVERNMENT', label: 'Government' },
      { value: 'OFFICE_PRACTICE', label: 'Office Practice' },
    ],
  },
  {
    label: 'New Trade & Entrepreneurship',
    subjects: [
      { value: 'SOLAR_PV_INSTALLATION', label: 'Solar PV Installation & Maintenance' },
      { value: 'FASHION_DESIGN', label: 'Garment Making and Fashion Designing' },
      { value: 'LIVESTOCK_FARMING', label: 'Livestock Farming' },
      { value: 'BEAUTY_COSMETOLOGY', label: 'Beauty & Cosmetology' },
      { value: 'COMPUTER_GSM_REPAIR', label: 'Computer Hardware & GSM Repairs' },
      { value: 'HORTICULTURE_CROP', label: 'Horticulture' },
      { value: 'DATA_PROCESSING', label: 'Data Processing' },
      { value: 'CATERING_CRAFT', label: 'Catering Craft Practice' },
      { value: 'ANIMAL_HUSBANDRY', label: 'Animal Husbandry' },
      { value: 'BOOK_KEEPING', label: 'Book-Keeping' },
      { value: 'PHOTOGRAPHY', label: 'Photography' },
    ],
  },
] as const;

/* ── reactive mirrors of the elements the origin writes to ────────────── */

let ACTIVE_SYNC_TERM = 'TERM1';
let ACTIVE_SYNC_YEAR = '2025/2026';
let ACTIVE_OVERVIEW_YEAR = '2025/2026';

/**
 * `const LOGGED_IN_SCHOOL_ID = localStorage.getItem('SchoolID') || "SFC"`
 * (ict.html line 1467). The school name map on this page uses typographic
 * apostrophes, exactly as served.
 */
const LOGGED_IN_SCHOOL_ID = localStorage.getItem('SchoolID') || 'SFC';
const SCHOOL_NAMES: Record<string, string> = {
  SFC: 'St. Finbarr’s College',
  SGC: 'St. Gregory College',
  HCC: 'Holy Child College',
  MCSS: 'Maryland Comprehensive',
  STAC: 'St. Thomas Aquinas College',
  OLASS: 'Our Lady of Apostles',
  MEC: 'Mater Ecclesia College',
  SKC: 'St. Kizito’s College',
  MGC: 'Marywood Girl’s College',
  SHC: 'Sacred Heart College',
};

/* AppShell wiring (D-62). `currentRole` is read once, like the origin's own
   session reads, and `navFor` turns it into this role's sections. */
const currentRole = localStorage.getItem(STORAGE_KEYS.AdminRole) || 'ICT_ADMIN';
const navMeta = navFor(currentRole);

/* The rail is permission-filtered (D-71): SUPER_ADMIN sees every
   section, every other session only the ones it actually holds. */
const sessionStore = useSessionStore();
const navGroups = computed(
  () => filterNav(navMeta, sessionStore.permissions, currentRole).groups,
);
/* The scope chip reads GLOBAL for a cross-school role and the school's own code
   for a school console, which is the only visible difference between them. */
const SHELL_SCOPE =
  navMeta.scopeKind === 'global' ? 'GLOBAL' : localStorage.getItem(STORAGE_KEYS.SchoolID) || '—';

const activeTab = ref<string>(
  takePendingPanel(navMeta, 'activeLAECSchoolTab') || 'dashboard',
);
const navOpen = ref(false);
const backToTopVisible = ref(false);
const loadingVisible = ref(false);
/* Fed to <AppLoading>; replaces the origin's imperative
   `document.getElementById('loading-overlay-text').innerText = …` (D-74). */
const loadingText = ref('LAEC School Portal Syncing...');
const copyrightYear = ref('');
const schoolIdentity = ref('Loading Identity...');
const schoolLockDisplay = ref('');

const countTotal = ref('0');
const currentSessionDisplay = ref('SYNCING...');
const currentModeDisplay = ref('LOADING...');
/* Short token for the mode card; the long form is the caption beneath it. */
const currentModeShort = ref('LOADING');

/*
 * Latency card caption and colour. `pingWhat` names what the ping measures — the
 * card says "Cloud Sync" but not that this is a round-trip to a public S3 asset
 * rather than to the API — and `pingCheckedAt` makes a stale reading
 * distinguishable from a fresh one on a ten-second poll.
 *
 * Thresholds live in checkHealth below and are shared with the System Health
 * panel's status line, so the two surfaces cannot disagree about what is healthy.
 * `bad` is new: the origin had good/else, so 510ms and 4s were both
 * "LATENCY DETECTED" in the same amber.
 */
type PingTone = 'unknown' | 'good' | 'warn' | 'bad';
const pingTone = ref<PingTone>('unknown');
const pingCheckedAt = ref('checking…');
const pingWhat = 'Round-trip to AWS us-east-1';
const PING_GOOD_MS = 500;
const PING_BAD_MS = 1500;

const globalModeHint = ref('Syncing System Mode...');
const localModeHint = ref('Current: SYNCING MODE...');
const modeAButtonClass = ref('mode-btn');
const modeBButtonClass = ref('mode-btn');
const promotionNoticeVisible = ref(false);
const promotionNoticeMessage = ref('');
const pingMs = ref('-- ms');
const pingLarge = ref('--');
const pingStatus = ref('Monitoring Region us-east-1...');
const subjectPerformanceNote = ref("Percentage representation of students' performance in each of the subjects.");
const classPopulationNote = ref('Showing student registration distribution across JSS1 to SS3.');
/*
 * Longest label drawn on the class histogram's category axis; the axis is
 * truncated to this and the full value is in the tooltip, so a wide class name
 * ("GRADUATED", "UNCLASSIFIED") cannot be drawn over its neighbours.
 */
const CLASS_AXIS_LABEL_MAX = 14;

/** "GRADUATED" fits; wider values are trimmed to fit + ellipsis. */
const truncateChartLabel = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

/* Whether each Overview chart has anything to draw; the template branches on
   these to choose between the canvas and <ChartEmptyState>. */
const subjectPerformanceEmpty = ref(true);
const classPopulationEmpty = ref(true);
/* The pie's empty-state copy, set by the render function that owns the branch so
   the text and the branch cannot disagree. */
const subjectEmptyTitle = ref('No results yet');
const subjectEmptyDesc = ref('');

const pieYearFilter = ref('YEAR#2025');
const subjectStageFilter = ref('ALL');
const extraYears = ref<number[]>([]);
const yearOptions = computed<number[]>(() => [...ACADEMIC_YEARS, ...extraYears.value].sort((a, b) => a - b));

const dirSearch = ref('');
const dirClassFilter = ref('ALL');
const masterStudentList = ref<Student[]>([]);
const visibleStudents = ref<Student[]>([]);
const regNumberOptions = ref<Array<{ value: string; label: string }>>([]);
const studentNameOptions = ref<Array<{ value: string; label: string }>>([]);

const subjectEditorStudent = ref('');
const subjectEditorSummary = ref('No student selected');
const subjectEditorChecks = ref<string[]>([]);
const subjectEditorClass = computed(() =>
  String(masterStudentList.value.find((s) => s.RegNo === subjectEditorStudent.value)?.Class || ''),
);
const subjectEditorStudents = computed(() =>
  masterStudentList.value
    .slice()
    .sort((left, right) => String(left.FullName || '').localeCompare(String(right.FullName || ''))),
);
const subjectEditorOptions = computed<string[]>(() => {
  const options = (LAEC as unknown as { STANDARD_SUBJECT_OPTIONS?: string[] }).STANDARD_SUBJECT_OPTIONS;
  return Array.isArray(options)
    ? options
        .filter((subject) => subject && subject !== 'ARABIC')
        .sort((left, right) => LAEC.humanizeSubject(left).localeCompare(LAEC.humanizeSubject(right)))
    : [];
});

const resYear = ref('2025/2026');
const resTerm = ref('TERM1');
const resCategory = ref('EXAM');
const resMode = ref('MODE_B');
const resClassFilter = ref('ALL');
const resRegFilter = ref('');
const resSubjectInput = ref('');
const masterResultList = ref<ResultRecord[]>([]);
const renderedResultList = ref<ResultRecord[]>([]);

const globalExamType = ref('#');
const timerH = ref<number | string>('');
const timerM = ref<number | string>('');
const timerS = ref<number | string>('');

const blastSession = ref('CA1');
const blastH = ref<number | string>('');
const blastM = ref<number | string>('');
const blastS = ref<number | string>('');
const blastInstruction = ref('');
const generatedUrl = ref('');
const hostingResultVisible = ref(false);

const pqMode = ref('MODE_A');
const pqSubject = ref('#');
const pqTerm = ref('TERM1');
const pqType = ref('CA1');
const pqYear = ref('2025/2026');
const pqClass = ref('SS1');
const pastQuestionRows = ref<Question[]>([]);
const archiveEmptyLabel = ref('');

const invigilatorYearFilter = ref('2025/2026');
const invigilatorTermFilter = ref('TERM1');
const invigMode = ref('MODE_B');
const invigClass = ref('ALL');
const invigSubject = ref('');
const invigilatorRows = ref<ResultRecord[]>([]);
const invigilatorEmptyLabel = ref('Waiting for live activity...');

/* ── custom alert (origin winAlert, with its photoUrl parameter) ──────── */

const alertVisible = ref(false);
const alertTitle = ref('Notice');
const alertMsg = ref('');
const alertPhoto = ref('');
const alertConfirmVisible = ref(false);
let alertConfirmHandler: (() => void) | null = null;

const winAlert = (
  title: string,
  msg: string,
  type: 'info' | 'confirm' = 'info',
  onConfirm: (() => void) | null = null,
  photoUrl: string | null = null,
): void => {
  alertTitle.value = title;
  alertMsg.value = msg;
  alertPhoto.value = photoUrl || '';
  alertConfirmVisible.value = type === 'confirm';
  alertConfirmHandler = type === 'confirm' ? onConfirm : null;
  alertVisible.value = true;
};

const closeAlert = (): void => {
  alertVisible.value = false;
  alertPhoto.value = '';
};

const confirmAlert = (): void => {
  closeAlert();
  alertConfirmHandler?.();
};

/* ── navigation and chrome ────────────────────────────────────────────── */

const toggleNav = (): void => {
  navOpen.value = !navOpen.value;
};

const scrollToTopPage = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const syncHeaderOffset = (): void => {
  const header = document.querySelector('header');
  if (!header) return;
  document.documentElement.style.setProperty('--header-offset', `${header.offsetHeight + 28}px`);
};

const toggleBackToTopButton = (): void => {
  backToTopVisible.value = window.scrollY > 320;
};

/** Empty stub on the origin (ict.html lines 2057–2063) — RF-67 defect (D-10). */
const releaseAdminSession = async (): Promise<void> => undefined;

const handleLogout = (): void => {
  winAlert('SECURE LOGOUT', 'End this admin session?', 'confirm', () => {
    void releaseAdminSession();
    localStorage.clear();
    window.location.href = '/control/';
  });
};

const showTab = (tabId: string, options: { skipRefresh?: boolean } = {}): void => {
  if (!document.getElementById(tabId)) return;
  activeTab.value = tabId;
  localStorage.setItem('activeLAECSchoolTab', tabId);
  if (tabId !== 'register') {
    (window as unknown as { LAECRegistration?: { stopCamera: () => void } }).LAECRegistration?.stopCamera();
  }
  if (window.innerWidth <= 900) navOpen.value = false;
  if (!options.skipRefresh) refreshTabData(tabId);
};

const restoreActiveTab = (): void => {
  const fallbackTab = 'dashboard';
  const savedTab = localStorage.getItem('activeLAECSchoolTab') || fallbackTab;
  showTab(canOpenPanel(navMeta, sessionStore.permissions, currentRole, savedTab) ? savedTab : fallbackTab, { skipRefresh: true });
};

const refreshTabData = (tabId: string): void => {
  if (tabId === 'dashboard' || tabId === 'register') {
    void loadSchoolStats();
    return;
  }
  if (tabId === 'students') {
    void getStudentsFromLambda();
    return;
  }
  if (tabId === 'results') {
    void loadSchoolResults();
    return;
  }
  if (tabId === 'exam-center') {
    void loadSchoolStats();
    examSession()?.refresh('exam-session-root', true);
    return;
  }
  if (tabId === 'past-questions') {
    if (pqSubject.value !== '#') void loadPastQuestions();
    return;
  }
  if (tabId === 'health') {
    checkHealth();
    void refreshInvigilatorFeed();
  }
};

/* ── session, mode and promotion notice ───────────────────────────────── */

const syncAcademicYear = (year: string): void => {
  const start = getAcademicYearStart(year);
  if (!Number.isFinite(start)) return;
  if (!yearOptions.value.includes(start)) extraYears.value = [...extraYears.value, start];
};

const updateLocalModeUI = (mode: string): void => {
  if (mode === 'MODE_A') {
    modeAButtonClass.value = 'mode-btn active-a';
    modeBButtonClass.value = 'mode-btn';
    localModeHint.value = 'Current: LOCAL JOINT MODE ACTIVE';
  } else {
    modeBButtonClass.value = 'mode-btn active-b';
    modeAButtonClass.value = 'mode-btn';
    localModeHint.value = 'Current: LOCAL INTERNAL MODE ACTIVE';
  }
};

/*
 * The mode card shows a short token as its value and the long form as a caption.
 * "INTERNAL (School)" was shrunk to 1.1rem inline to fit beside a "2025/2026"
 * set in the row's display face, which is why one stat read visibly smaller than
 * its neighbours. Both strings derive from the same mode, so value and caption
 * cannot disagree.
 */
const MODE_LABELS: Record<string, { short: string; full: string }> = {
  MODE_A: { short: 'JOINT', full: 'JOINT (Synced)' },
  MODE_B: { short: 'INTERNAL', full: 'INTERNAL (School)' },
};

const setModeDisplay = (mode: string): void => {
  const label = MODE_LABELS[mode] ?? { short: String(mode), full: String(mode) };
  currentModeShort.value = label.short;
  currentModeDisplay.value = label.full;
};

const restoreCachedModeUI = (): void => {
  const cachedMode = localStorage.getItem(`LAEC_LocalMode_${LOGGED_IN_SCHOOL_ID}`);
  if (!cachedMode) return;
  updateLocalModeUI(cachedMode);
  setModeDisplay(cachedMode);
};

const toggleLocalMode = async (mode: 'MODE_A' | 'MODE_B'): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('UPDATE_MODE', { mode, schoolID: LOGGED_IN_SCHOOL_ID });
    if (data.status === 'success') {
      localStorage.setItem(`LAEC_LocalMode_${LOGGED_IN_SCHOOL_ID}`, mode);
      updateLocalModeUI(mode);
      void loadSchoolStats();
      winAlert('Local Override', `ICT System switched to ${mode === 'MODE_A' ? 'JOINT' : 'INTERNAL'} Mode.`);
    }
  } catch {
    winAlert('Error', 'Local mode switch failed.');
  }
  loadingVisible.value = false;
};

const handleCategoryChange = (): void => {
  const cat = globalExamType.value;
  if (cat === '#') {
    timerH.value = 0;
    timerM.value = 0;
    timerS.value = 0;
  }
};

const syncResultFiltersWithConfig = (config: {
  academicYear?: string;
  currentTerm?: string;
  activeExamType?: string;
  currentMode?: string;
  mode?: string;
}): void => {
  const set = (target: { value: string }, value: string | undefined): void => {
    const normalized = String(value || '').toUpperCase();
    if (normalized) target.value = normalized;
  };
  const localMode = localStorage.getItem(`LAEC_LocalMode_${LOGGED_IN_SCHOOL_ID}`);
  set(resYear, config.academicYear);
  set(resTerm, config.currentTerm || ACTIVE_SYNC_TERM);
  set(resCategory, config.activeExamType);
  set(resMode, config.currentMode || config.mode || localMode || undefined);
};

const syncPromotionNotice = (isPromotionActive: boolean): void => {
  if (isPromotionActive) {
    promotionNoticeVisible.value = true;
    promotionNoticeMessage.value = 'New Alert, click to view';
    return;
  }
  promotionNoticeVisible.value = false;
  promotionNoticeMessage.value = '';
};

const showPromotionNoticeDetails = (): void => {
  winAlert(
    'Class Promotion Notice',
    "Fresh class promotion was recently done by the system's General Administrator, kindly remind the College Administrator to perform necessary demotion if need be.",
  );
};

/* ── students (origin lines 1773–1873, 1904–1933, 2349–2514) ─────────── */

const populateDataLists = (students: Student[]): void => {
  const nameOptions = new Map<string, unknown>();
  [...students, ...masterResultList.value]
    .filter((item) => item && ((item as Student).FullName || (item as ResultRecord).RegNo))
    .forEach((item) => {
      const name = String((item as Student).FullName || (item as ResultRecord).RegNo).toUpperCase();
      if (!nameOptions.has(name)) nameOptions.set(name, item);
    });
  const entries = Array.from(nameOptions.values()) as Array<Student & ResultRecord>;
  regNumberOptions.value = entries.map((student) => ({
    value: student.FullName || student.RegNo,
    label: student.RegNo || '',
  }));
  studentNameOptions.value = students.flatMap((student) => [
    { value: student.FullName, label: student.RegNo || '' },
    { value: student.RegNo, label: student.FullName || '' },
  ]);
};

const studentJoined = (s: Student): string => {
  const created = (s as unknown as { CreatedAt?: string }).CreatedAt;
  return created ? new Date(created).toLocaleDateString() : 'N/A';
};

const getSubjectEditorLabel = (subject: string, studentClass = ''): string => {
  const isSeniorClass = /^SS/.test(LAEC.normalizeClassValue(studentClass || ''));
  const normalizedSubject = LAEC.normalizeSubjectValue(subject);
  const labels: Record<string, string> = {
    AGRIC_SCIENCE_JSS: 'Agric',
    AGRIC_SCIENCE_SSS: 'Agricultural Science (SSS)',
    CIVIC_SECURITY: 'Civic & Security Studies',
    CRS: isSeniorClass ? 'Christian Religious Studies (CRS) (SSS)' : 'Christian Religious Studies (CRS)',
  };
  return labels[normalizedSubject] || LAEC.humanizeSubject(normalizedSubject);
};

const clearStudentSubjectEditor = (): void => {
  subjectEditorStudent.value = '';
  subjectEditorSummary.value = 'No student selected';
  subjectEditorChecks.value = [];
};

const loadStudentSubjectEditor = (): void => {
  const student = masterStudentList.value.find((item) => item.RegNo === subjectEditorStudent.value);
  if (!student) {
    clearStudentSubjectEditor();
    return;
  }
  const selectedSubjects = new Set(
    (student.Subjects || []).map((subject) => LAEC.normalizeSubjectValue(subject)),
  );
  subjectEditorSummary.value = selectedSubjects.size
    ? Array.from(selectedSubjects)
        .map((subject) => getSubjectEditorLabel(subject, String(student.Class || '')))
        .join(', ')
    : 'No subjects selected yet';
  subjectEditorChecks.value = Array.from(selectedSubjects);
};

const saveStudentSubjectEditor = async (): Promise<void> => {
  const regNo = subjectEditorStudent.value;
  const student = masterStudentList.value.find((item) => item.RegNo === regNo);
  if (!student) {
    winAlert('Selection Required', 'Load the directory and select a student first.');
    return;
  }
  const selectedSubjects = Array.from(
    new Set(subjectEditorChecks.value.map((value) => LAEC.normalizeSubjectValue(value))),
  );
  if (selectedSubjects.length === 0) {
    winAlert('Selection Required', 'Select at least one subject for this student.');
    return;
  }
  loadingVisible.value = true;
  try {
    const data = await callApi('UPDATE_STUDENT_SUBJECTS', {
      schoolID: LOGGED_IN_SCHOOL_ID,
      regNo,
      subjects: selectedSubjects,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Subject update failed.');
    student.Subjects = selectedSubjects;
    loadStudentSubjectEditor();
    winAlert('Success', `${student.FullName}'s subjects have been updated.`);
  } catch (e) {
    winAlert('Update Failed', msgOf(e) || "Could not update this student's subjects.");
  }
  loadingVisible.value = false;
};

const renderTable = (list: Student[]): void => {
  visibleStudents.value = list;
};

const localSearch = (): void => {
  const query = (dirSearch.value || '').toLowerCase();
  const classFilter = dirClassFilter.value || 'ALL';
  const filtered = masterStudentList.value.filter(
    (s) =>
      (classFilter === 'ALL' || s.Class === classFilter) &&
      (String(s.FullName || '').toLowerCase().includes(query) || String(s.RegNo || '').toLowerCase().includes(query)),
  );
  renderTable(filtered);
};

const getStudentsFromLambda = async (
  options: { returnOnly?: boolean; silent?: boolean } = {},
): Promise<Student[]> => {
  const returnOnly = Boolean(options.returnOnly);
  const silent = Boolean(options.silent);
  if (!silent) loadingVisible.value = true;
  try {
    const data = await callApi('GET_STUDENTS', { schoolID: LOGGED_IN_SCHOOL_ID });
    if (data.status === 'success') {
      masterStudentList.value = data.students as unknown as Student[];
      populateDataLists(masterStudentList.value);
      countTotal.value = String(masterStudentList.value.length);
      const filtered =
        dirClassFilter.value !== 'ALL'
          ? masterStudentList.value.filter((s) => s.Class === dirClassFilter.value)
          : masterStudentList.value;
      if (!returnOnly) renderTable(filtered);
    } else if (!silent) {
      winAlert('Sync Error', 'Query failed.');
    }
  } catch {
    if (!silent) winAlert('Sync Error', 'Query failed.');
  }
  if (!silent) loadingVisible.value = false;
  return masterStudentList.value;
};

const viewStudentProfileByReg = (reg: string): void => {
  const student = masterStudentList.value.find((item) => item.RegNo === reg);
  if (!student) {
    winAlert('Not Found', 'Load the directory and try again.');
    return;
  }
  const details = `NAME: ${student.FullName}\nREG ID: ${student.RegNo}\nACCESS PASS: ${student.Password || 'N/A'}\nCLASS: ${student.Class || 'N/A'}`;
  winAlert('STUDENT PROFILE', details, 'info', null, student.PassportURL || null);
};

const confirmDeleteStudent = (regNo: string): void => {
  winAlert(
    'CONFIRM DELETE',
    `Are you sure you want to permanently delete student ${regNo}? This action cannot be undone.`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('DELETE_STUDENT', { schoolID: LOGGED_IN_SCHOOL_ID, regNo });
          if (data.status === 'success') {
            winAlert('Success', 'Student records removed.');
            void getStudentsFromLambda();
          } else {
            throw new Error();
          }
        } catch {
          winAlert('Error', 'Could not delete student.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/** The origin's per-student print slip (ict.html line 2386). */
const printStudentSlip = (regNo: string): void => {
  const student = masterStudentList.value.find((item) => item.RegNo === regNo);
  if (!student) {
    winAlert('Not Found', 'Load the directory and try again.');
    return;
  }
  const subjects =
    (student.Subjects || []).map((subject) => LAEC.humanizeSubject(subject)).join(', ') ||
    'No subjects assigned';
  const escape = (value: unknown): string =>
    String(value ?? '').replace(/[&<>"']/g, (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
    );
  const printWindow = window.open('', '_blank', 'width=720,height=900');
  if (!printWindow) {
    winAlert('Print Blocked', 'Allow popups for this portal, then try printing again.');
    return;
  }
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${escape(student.FullName)} Slip</title><style>
            body{font-family:Arial,sans-serif;color:#111;padding:24px;} .slip{border:2px solid #111;padding:20px;max-width:680px;margin:0 auto;}
            .head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px;} .body{display:flex;gap:18px;align-items:flex-start;}
            img{width:130px;height:130px;object-fit:cover;border:1px solid #111;} p{margin:0 0 8px;font-size:14px;line-height:1.45;}
            .subjects{border-top:1px dashed #555;margin-top:16px;padding-top:12px;font-size:13px;line-height:1.6;} @media print{body{padding:0}.slip{border:2px solid #111;}}
        </style></head><body><div class="slip">
            <div class="head"><h2 style="margin:0;">LAEC STUDENT EXAMINATION SLIP</h2><p style="margin:6px 0 0;">${escape(SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || LOGGED_IN_SCHOOL_ID)}</p></div>
            <div class="body"><img src="${escape(student.PassportURL || '/nicegene_logo.png')}"><div>
                <p><strong>NAME:</strong> ${escape(student.FullName)}</p><p><strong>REG NO:</strong> ${escape(student.RegNo)}</p>
                <p><strong>CLASS:</strong> ${escape(student.Class || 'N/A')}</p>
                <p><strong>PASSWORD:</strong> ${escape(student.Password || 'PROTECTED')}</p></div></div>
            <div class="subjects"><strong>REGISTERED SUBJECTS:</strong><br>${escape(subjects)}</div>
        </div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

const downloadStudentCredentialPdf = async (): Promise<void> => {
  const classFilter = dirClassFilter.value || 'ALL';
  if (!masterStudentList.value.length) await getStudentsFromLambda({ silent: true });
  const students = masterStudentList.value
    .filter((student) => classFilter === 'ALL' || student.Class === classFilter)
    .sort((a, b) => String(a.FullName || '').localeCompare(String(b.FullName || '')));
  if (!students.length) {
    winAlert('No Data', 'No students found for the selected class.');
    return;
  }
  const classLabel = classFilter === 'ALL' ? 'All Classes' : classFilter;
  const schoolName = SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || LOGGED_IN_SCHOOL_ID;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const slipHeight = 110;
  const gap = 16;
  let y = margin;

  const drawHeader = (): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('LAEC STUDENT LOGIN CREDENTIALS', pageWidth / 2, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(String(schoolName), pageWidth / 2, y + 16, { align: 'center' });
    doc.text(`${classLabel} - ${students.length} student(s)`, pageWidth / 2, y + 30, { align: 'center' });
    y += 52;
  };

  drawHeader();
  students.forEach((student, index) => {
    if (y + slipHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    if (doc.setLineDashPattern) doc.setLineDashPattern([4, 3], 0);
    doc.rect(margin, y, pageWidth - margin * 2, slipHeight);
    if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(String(index + 1), pageWidth - margin - 18, y + 20);
    doc.text(String(student.FullName || 'N/A').toUpperCase(), margin + 16, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`User ID: ${student.RegNo || 'N/A'}`, margin + 16, y + 58);
    doc.text(`Password: ${student.Password || 'PROTECTED'}`, margin + 16, y + 80);
    y += slipHeight + gap;
  });

  doc.save(`Student_Credentials_${LOGGED_IN_SCHOOL_ID}_${classFilter}.pdf`);
};

/** `exportStudentData` — a hand-built sheet, not a table export (ict.html 2499). */
const exportStudentData = (): void => {
  if (!masterStudentList.value.length) {
    winAlert('No Data', 'Load the directory first.');
    return;
  }
  const exportData = masterStudentList.value.map((s) => ({
    'Full Name': s.FullName,
    'Registration ID': s.RegNo,
    Password: s.Password || 'N/A',
    'Passport URL': s.PassportURL || '',
    Class: s.Class,
    School: LOGGED_IN_SCHOOL_ID,
    'Joined Date': studentJoined(s),
  }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Portal_Population');
  XLSX.writeFile(wb, `Student_Portal_Data_${LOGGED_IN_SCHOOL_ID}.xlsx`);
};

/* ── results (origin lines 2516–2536, 2619–2753) ──────────────────────── */

const applyCurrentResultFilters = (results: ResultRecord[] = masterResultList.value): ResultRecord[] =>
  results.filter((result) =>
    resultMatchesFilters(result, {
      query: (resRegFilter.value || '').toLowerCase(),
      classFilter: resClassFilter.value,
      armFilter: 'ALL',
      armOf: () => '',
    }),
  );

const localResultSearch = (): void => {
  renderedResultList.value = applyCurrentResultFilters();
};

const scrollResultsTable = (direction: number): void => {
  const table = document.getElementById('resultsTable');
  const container = table?.closest('.table-responsive') as HTMLElement | null;
  if (!container) return;
  container.scrollBy({
    left: direction * Math.max(260, container.clientWidth * 0.75),
    behavior: 'smooth',
  });
};

const loadSchoolResults = async (): Promise<void> => {
  loadingVisible.value = true;
  const year = resYear.value;
  const term = resTerm.value;
  const category = resCategory.value;
  const mode = resMode.value;
  const subject = normalizeSubjectInput(resSubjectInput.value);
  try {
    const data = await callApi('GET_RESULTS', {
      schoolID: LOGGED_IN_SCHOOL_ID,
      year,
      term: term as ExamTerm,
      category: category as ExamCategory,
      mode: mode as 'MODE_A',
      subject,
    });
    if (data.status === 'success') {
      masterResultList.value = data.results as ResultRecord[];
      populateDataLists(masterStudentList.value);
      localResultSearch();
    }
  } catch {
    winAlert('Sync Error', 'Fetch failed.');
  }
  loadingVisible.value = false;
};

/*
 * The answer-script viewer and its modal (RF-73, RF-109). The origin keeps this
 * block in each console's inline script and wires no control to it, so it is dead
 * code there and here (DEV-3); it is installed so the modal's own inline
 * `onclick="closeResultScriptModal()"` resolves, exactly as the page globals did
 * on the origin. The cloud re-fetch rides the mock transport, never the live
 * address the URL is built from (D-04, D-39).
 */
installResultScriptViewer({
  getMasterResults: () => masterResultList.value,
  getRenderedResults: () => renderedResultList.value,
  winAlert,
  getSchoolId: () => LOGGED_IN_SCHOOL_ID,
  readFilter: (id) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '',
  fetchImpl: createMockGetFetch(),
});

const remarkLoadedResults = (): void => {
  const list = applyCurrentResultFilters();
  const records = list
    .filter((item) => item.PK && item.SK)
    .map((item) => ({ pk: item.PK as string, sk: item.SK as string }));
  if (records.length === 0) {
    winAlert('No Results', 'Load results with database keys before remarking.');
    return;
  }
  winAlert('REMARK RESULTS', `Remark ${records.length} loaded result(s) from the stored student scripts?`, 'confirm', () => {
    void (async () => {
      loadingVisible.value = true;
      try {
        const data = await callApi('REMARK_STUDENT_RESULTS', { records });
        if (data.status !== 'success') throw new Error(data.message || 'Remark failed.');
        winAlert('Remark Complete', data.message || 'Results remarked successfully.');
        void loadSchoolResults();
      } catch (e) {
        winAlert('Remark Error', msgOf(e) || 'Could not remark results.');
      }
      loadingVisible.value = false;
    })();
  });
};

const deleteSelectedSubjectResults = (): void => {
  const subject = normalizeSubjectInput(resSubjectInput.value);
  if (!subject || subject === 'ALL') {
    winAlert('Select Subject', 'Choose one subject before deleting subject results.');
    return;
  }
  const list = applyCurrentResultFilters().filter(
    (item) => String(item.Subject || '').toUpperCase() === subject,
  );
  const records = list
    .filter((item) => item.PK && item.SK)
    .map((item) => ({ pk: item.PK as string, sk: item.SK as string, subject: item.Subject as string }));
  if (records.length === 0) {
    winAlert('No Results', 'No loaded result records match the selected subject.');
    return;
  }
  winAlert(
    'DELETE SUBJECT RESULTS',
    `Delete ${records.length} loaded ${subject} result record(s)? This cannot be undone.`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('DELETE_SUBJECT_RESULTS', { subject, records });
          if (data.status !== 'success') throw new Error(data.message || 'Delete failed.');
          winAlert('Deleted', data.message || 'Subject results deleted.');
          void loadSchoolResults();
        } catch (e) {
          winAlert('Delete Error', msgOf(e) || 'Could not delete subject results.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

const confirmDeleteResult = (pk: string, sk: string): void => {
  if (!pk || !sk) {
    winAlert('Missing Record', 'This result record cannot be deleted because its database key is missing.');
    return;
  }
  winAlert('CONFIRM DELETION', 'Are you sure? This will remove the result and allow the student to re-sit the exam.', 'confirm', () => {
    void (async () => {
      loadingVisible.value = true;
      try {
        const data = await callApi('DELETE_STUDENT_RESULT', { pk, sk });
        if (data.status === 'success') {
          winAlert('Success', 'Result deleted. Student can now re-write.');
          void loadSchoolResults();
        } else {
          throw new Error();
        }
      } catch {
        winAlert('Error', 'Could not delete result.');
      }
      loadingVisible.value = false;
    })();
  });
};

/* ── examination center (origin lines 2275–2350, 2931–2963) ───────────── */

const examSession = ():
  | {
      init: (config: Record<string, unknown>) => void;
      refresh: (rootId: string, force?: boolean) => void;
      syncConfig: (rootId: string, config: unknown) => void;
      getSelectedPapers: (rootId: string) => string[];
      getWindowPayload: (rootId: string) => { startTime: string; endTime: string };
    }
  | undefined =>
  (window as unknown as { LAECExamSession?: ReturnType<typeof examSession> }).LAECExamSession;

const updateExamGlobal = (): void => {
  const cat = globalExamType.value;
  const h = parseInt(String(timerH.value), 10) || 0;
  const m = parseInt(String(timerM.value), 10) || 0;
  const s = parseInt(String(timerS.value), 10) || 0;
  const totalMinutes = h * 60 + m + s / 60;
  const selectedPapers = examSession()?.getSelectedPapers('exam-session-root') ?? [];
  const liveWindow = examSession()?.getWindowPayload('exam-session-root') ?? { startTime: '', endTime: '' };

  if (cat === '#') {
    winAlert('Required', 'Please select the active category.');
    return;
  }
  if ((liveWindow.startTime && !liveWindow.endTime) || (!liveWindow.startTime && liveWindow.endTime)) {
    winAlert('Required', 'Set both live window values or leave both blank.');
    return;
  }
  if (liveWindow.startTime && liveWindow.endTime && new Date(liveWindow.endTime) <= new Date(liveWindow.startTime)) {
    winAlert('Required', 'Live end time must be later than live start time.');
    return;
  }
  void (async () => {
    loadingVisible.value = true;
    try {
      const data = await callApi('UPDATE_EXAM_SETTINGS', {
        schoolID: LOGGED_IN_SCHOOL_ID,
        type: cat as ExamCategory,
        duration: totalMinutes,
        activePapers: selectedPapers,
        livePapers: selectedPapers,
        startTime: liveWindow.startTime || '',
        endTime: liveWindow.endTime || '',
      });
      if (data.status === 'success') {
        winAlert('Success', `ICT synchronization complete. ${selectedPapers.length} paper slot(s) prepared for live access.`);
      }
    } catch {
      winAlert('Error', 'Sync failed.');
    }
    loadingVisible.value = false;
  })();
};

const handleBulkBlast = (): void => {
  const fileInput = document.getElementById('excel-blast') as HTMLInputElement | null;
  const sessionType = blastSession.value;
  if (!blastH.value && !blastM.value && !blastS.value) {
    winAlert('Validation Error', 'Set the Exam Duration.');
    return;
  }
  if (!fileInput?.files?.[0]) {
    winAlert('File Missing', 'Select your Excel file.');
    return;
  }
  const totalMinutes =
    (parseInt(String(blastH.value), 10) || 0) * 60 +
    (parseInt(String(blastM.value), 10) || 0) +
    (parseInt(String(blastS.value), 10) || 0) / 60;
  if (totalMinutes <= 0) {
    winAlert('Validation Error', 'Exam duration must be greater than 0.');
    return;
  }
  loadingVisible.value = true;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellHTML: true, cellStyles: true, bookFiles: true });
      const json = LAEC.extractFormattedQuestionRows(workbook);
      const normalizedQuestions = LAEC.normalizeQuestionRows(json);
      const synchronizedQuestions = normalizedQuestions.map((q) => ({ ...q, Term: ACTIVE_SYNC_TERM }));
      if (json.length > 0 && !Object.prototype.hasOwnProperty.call(json[0], 'Class')) {
        throw new Error("Column 'Class' missing.");
      }
      if (normalizedQuestions.length === 0) {
        throw new Error('No valid question rows were found after normalization.');
      }
      const result = await callApi('BULK_UPLOAD_QUESTIONS', {
        schoolID: LOGGED_IN_SCHOOL_ID,
        testType: sessionType,
        questions: synchronizedQuestions as never,
        durationMinutes: totalMinutes,
        assessmentInstruction: blastInstruction.value.trim(),
        shuffleQuestions: true,
      });
      if (result.status === 'success') {
        winAlert(
          'Blast Complete',
          `Successfully deployed ${(result as unknown as { count?: number }).count} normalized internal questions. Use the session settings card to choose which papers go live.`,
        );
        if (fileInput) fileInput.value = '';
        blastH.value = '';
        blastM.value = '';
        blastS.value = '';
        blastInstruction.value = '';
        examSession()?.refresh('exam-session-root', true);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      winAlert('Import Failure', msgOf(err));
    }
    loadingVisible.value = false;
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
};

const uploadQuestionImage = (): void => {
  const file = (document.getElementById('img-hosting') as HTMLInputElement | null)?.files?.[0];
  if (!file) {
    winAlert('No File', 'Select an image.');
    return;
  }
  loadingVisible.value = true;
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    void (async () => {
      try {
        const data = await callApi('UPLOAD_QUESTION_IMAGE', {
          fileName: file.name,
          fileType: file.type,
          imageBase64: String(reader.result ?? '').split(',')[1] ?? '',
        });
        if (data.status === 'success') {
          hostingResultVisible.value = true;
          generatedUrl.value = data.imageUrl ?? '';
        }
      } catch {
        winAlert('Cloud Error', 'Failed.');
      }
      loadingVisible.value = false;
    })();
  };
};

const copyDiagramURL = (): void => {
  const urlInput = document.getElementById('generated-url-field') as HTMLInputElement | null;
  if (!urlInput) return;
  urlInput.select();
  void navigator.clipboard?.writeText(urlInput.value);
  winAlert('Copied', 'Link ready to paste into Excel.');
};

/* ── past questions (origin lines 2755–2787) ──────────────────────────── */

const loadPastQuestions = async (): Promise<void> => {
  const mode = pqMode.value;
  const subject = pqSubject.value;
  const term = pqTerm.value;
  const type = pqType.value;
  const rawYear = pqYear.value;
  const studentClass = pqClass.value;
  if (subject === '#') {
    winAlert('Selection Required', 'Please select a Subject.');
    return;
  }
  loadingVisible.value = true;
  try {
    const targetSchool = mode === 'MODE_A' ? 'GLOBAL' : LOGGED_IN_SCHOOL_ID;
    const utils = buildLibraryUtils();
    const { data } = await utils.fetchQuestionSet({
      baseUrl: 'http://mock.local/students',
      params: {
        action: 'GET_SECURE_QUESTIONS',
        schoolID: targetSchool,
        year: rawYear.replace('/', '-'),
        term,
        class: LAEC.normalizeClassValue(studentClass),
        subject,
        type,
        mode,
        pastOnly: '1',
      },
    });
    const questions = (data.questions || []) as Question[];
    if (data.status === 'success' && questions.length > 0) {
      pastQuestionRows.value = questions;
      archiveEmptyLabel.value = 'No questions found.';
      winAlert('Sync Success', `Retrieved ${questions.length} questions.`);
    } else {
      pastQuestionRows.value = [];
      archiveEmptyLabel.value = 'No questions found.';
    }
  } catch {
    winAlert('Sync Error', 'Failed.');
  }
  loadingVisible.value = false;
};

/* ── system health (origin lines 2789–2926) ──────────────────────────── */

/**
 * The origin pings its own students endpoint and prints the round trip; this
 * build measures the same public asset request the other consoles use, so no
 * backend is contacted (DEV-8). The origin's `checkHealth` on this page writes
 * only the two latency fields and never the status line.
 */
const checkHealth = (): void => {
  const start = Date.now();
  const img = new Image();
  img.onload = img.onerror = () => {
    const ms = Date.now() - start;
    pingMs.value = `${ms} ms`;
    pingLarge.value = `${ms} ms`;
    /*
     * The System Health panel here rendered a static "Monitoring Region" line
     * whatever the reading was, so a healthy link and a 4-second one looked
     * identical on screen. It now reports the same three states the stat card
     * colours by, from the same thresholds.
     */
    if (ms < PING_GOOD_MS) {
      pingStatus.value = 'STABLE CONNECTION';
      pingTone.value = 'good';
    } else if (ms < PING_BAD_MS) {
      pingStatus.value = 'LATENCY DETECTED';
      pingTone.value = 'warn';
    } else {
      pingStatus.value = 'SEVERE LATENCY';
      pingTone.value = 'bad';
    }
    pingCheckedAt.value = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  img.src = `https://s3.amazonaws.com/favicon.ico?rand=${start}`;
};

const getInvigilatorClassFilter = (): string => (invigClass.value || 'ALL').toUpperCase();

const fetchInvigilatorResultsFor = async (params: {
  category: string;
  mode: string;
  year: string;
  term: string;
  subject: string;
  studentClass: string;
}): Promise<ResultRecord[]> => {
  const data = await callApi('GET_RESULTS', {
    schoolID: LOGGED_IN_SCHOOL_ID,
    category: params.category as ExamCategory,
    mode: params.mode as 'MODE_A',
    year: params.year,
    term: params.term as ExamTerm,
    subject: params.subject || 'ALL',
    class: params.studentClass || 'ALL',
  });
  return data.status === 'success' ? (data.results as ResultRecord[]) : [];
};

const refreshInvigilatorFeed = async (): Promise<void> => {
  const modeFilter = invigMode.value;
  const yearFilter = invigilatorYearFilter.value || ACTIVE_SYNC_YEAR;
  const termFilter = invigilatorTermFilter.value || ACTIVE_SYNC_TERM;
  const classFilter = getInvigilatorClassFilter();
  const subjectFilter = normalizeSubjectInput(invigSubject.value);
  const modes = modeFilter === 'ALL' ? ['MODE_A', 'MODE_B'] : [modeFilter];

  loadingVisible.value = true;
  try {
    const batches = await Promise.all(
      modes.flatMap((mode) =>
        INVIGILATOR_CATEGORIES.map((category) =>
          fetchInvigilatorResultsFor({
            category,
            mode,
            year: yearFilter,
            term: termFilter,
            subject: subjectFilter,
            studentClass: classFilter,
          }),
        ),
      ),
    );
    invigilatorRows.value = dedupeInvigilatorResults(batches.flat())
      .filter((result) => String(result.Status || '').toUpperCase() === 'FLAGGED')
      .filter((result) => classFilter === 'ALL' || getResultClassValue(result) === classFilter)
      .filter((result) => subjectFilter === 'ALL' || String(result.Subject || '').toUpperCase() === subjectFilter)
      .sort((a, b) => new Date(b.Timestamp || 0).getTime() - new Date(a.Timestamp || 0).getTime());
    invigilatorEmptyLabel.value = 'No security violations detected for the selected filters.';
  } catch {
    invigilatorRows.value = [];
    invigilatorEmptyLabel.value = 'Monitor Sync Failed.';
  }
  loadingVisible.value = false;
};

const deleteFilteredFlaggedResults = (): void => {
  void (async () => {
    await refreshInvigilatorFeed();
    const records = invigilatorRows.value
      .filter((result) => result.PK && result.SK && String(result.Status || '').toUpperCase() === 'FLAGGED')
      .filter((result) => !isTimeExpiryViolation(result.Violation))
      .map((result) => ({
        pk: result.PK as string,
        sk: result.SK as string,
        status: result.Status as string,
        violation: result.Violation || '',
      }));
    if (records.length === 0) {
      winAlert('No Flagged Results', 'Load flagged students for a class and subject before deleting.');
      return;
    }
    const classFilter = getInvigilatorClassFilter();
    const subjectFilter = normalizeSubjectInput(invigSubject.value);
    winAlert(
      'CONFIRM DELETION',
      `Delete ${records.length} flagged result(s) for ${classFilter} / ${subjectFilter}? Students will be able to re-write.`,
      'confirm',
      () => {
        void (async () => {
          loadingVisible.value = true;
          try {
            const data = await callApi('DELETE_FLAGGED_RESULTS', { records });
            if (data.status !== 'success') throw new Error(data.message || 'Could not delete flagged results.');
            winAlert('Success', data.message || 'Flagged results deleted.');
            await refreshInvigilatorFeed();
          } catch (e) {
            winAlert('Delete Error', msgOf(e) || 'Could not delete flagged results.');
          }
          loadingVisible.value = false;
        })();
      },
    );
  })();
};

/* ── charts and dashboard (origin lines 1649–1760, 1904–1992) ─────────── */

let subjectPerformanceChart: Chart | null = null;
let classPopulationChart: Chart | null = null;

/** `const DashboardAnalytics = window.LAECDashboardAnalytics;` (ict.html 1484). */
const DashboardAnalytics = (
  window as unknown as {
    LAECDashboardAnalytics?: {
      buildClassPopulationMetrics: (list: unknown[], config: unknown) => Array<{ label: string; count: number }>;
      buildSubjectPassMetrics: (
        list: unknown[],
        config: unknown,
      ) => Array<{ label: string; passRate: number; attempts: number }>;
      getColors: (count: number) => string[];
    };
  }
).LAECDashboardAnalytics;

const renderClassPopulationChart = (students: Student[]): void => {
  const metrics = DashboardAnalytics
    ? DashboardAnalytics.buildClassPopulationMetrics(students, { utils: LAEC })
    : [];

  /* The caption's "Total" is the sum of these bars, not `students.length` — the
     two were only equal while the aggregation kept every student, and when it
     did not the caption asserted a total the chart could not account for. */
  const total = metrics.reduce((sum, metric) => sum + metric.count, 0);

  const canvas = document.getElementById('classPopulationChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  classPopulationChart?.destroy();
  classPopulationChart = null;

  /* A zero roster is a genuinely empty chart. Drawn anyway it produced zero
     bars against Chart.js's default 0-to-1 axis — a labelled scale for a
     population of nothing. */
  classPopulationEmpty.value = total === 0;
  if (classPopulationEmpty.value) {
    classPopulationNote.value =
      'No students are registered for this college, so there is no class distribution to show.';
    return;
  }

  const maxCount = Math.max(...metrics.map((metric) => metric.count));
  const yStep = Math.max(1, Math.ceil(maxCount / 4));

  classPopulationChart = new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'bar',
    data: {
      labels: metrics.map((metric) => metric.label),
      datasets: [
        {
          label: 'Students',
          data: metrics.map((metric) => metric.count),
          backgroundColor: '#123a63',
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const metric = metrics[item.dataIndex];
              return metric ? `${metric.count} student(s) in ${metric.label}` : '';
            },
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, stepSize: yStep, maxTicksLimit: 6 } },
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45,
            /* Off-list levels ("GRADUATED", "SSS1") widen the axis past the six
               standard levels, so labels are truncated and rotated rather than
               allowed to collide. The full value stays in the tooltip. */
            callback(_value: string | number, index: number): string {
              const metric = metrics[index];
              return metric ? truncateChartLabel(String(metric.label), CLASS_AXIS_LABEL_MAX) : '';
            },
          },
        },
      },
    },
  });
  classPopulationNote.value = `Showing student registration across <strong>${metrics.length}</strong> class levels. Total: <strong>${total}</strong>.`;
};

const renderSubjectPerformanceChart = (): void => {
  const canvas = document.getElementById('subjectStatsChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const stage = subjectStageFilter.value;
  const metrics = DashboardAnalytics
    ? DashboardAnalytics.buildSubjectPassMetrics(masterResultList.value, { stage, utils: LAEC })
    : [];
  subjectPerformanceChart?.destroy();
  subjectPerformanceChart = null;

  /*
   * A pie needs a positive total, and there are two distinct ways that fails:
   * nothing scored at all, or everything scored and nothing passed. The second
   * is a real (and bad) result rather than an absence of one, so the copy
   * distinguishes them rather than reporting a failed cohort as a missing one.
   * (An all-zero pie also has a 0 total, which chart.js divides by: the arcs
   * came out NaN and the canvas went blank behind the legend.)
   *
   * The old placeholder handled only the first case, and did it by drawing one
   * pale slice with `data: [1]` — a full disc with a white seam down the middle,
   * which reads as a chart rather than as the absence of one.
   */
  const positiveRates = metrics.filter(
    (metric) => Number.isFinite(metric.passRate) && metric.passRate > 0,
  );
  const hasNoResults = metrics.length === 0;
  const hasNoPasses = !hasNoResults && positiveRates.length === 0;

  subjectPerformanceEmpty.value = hasNoResults || hasNoPasses;
  subjectEmptyTitle.value = hasNoPasses ? 'No passes recorded' : 'No results yet';
  subjectEmptyDesc.value = hasNoPasses
    ? 'Every candidate who sat this session fell below the pass mark, so there is no pass rate to chart. Results are still listed in the table below.'
    : `No scored results were found for ${ACTIVE_OVERVIEW_YEAR} in ${formatTermLabel(
        ACTIVE_SYNC_TERM,
      )}. The pie appears here once at least one subject has a pass rate above zero.`;

  if (subjectPerformanceEmpty.value) {
    subjectPerformanceNote.value = hasNoResults
      ? `No scored results were found for <strong>${ACTIVE_OVERVIEW_YEAR}</strong> in ${formatTermLabel(ACTIVE_SYNC_TERM)}.`
      : `Every scored candidate fell below the pass mark in <strong>${ACTIVE_OVERVIEW_YEAR}</strong> for ${formatTermLabel(ACTIVE_SYNC_TERM)}, so there is no pass rate to chart.`;
    return;
  }

  /* Only positive, finite rates are charted: a 0 slice draws nothing yet still
     takes a legend entry, so the legend and the arcs would disagree. */
  const chartMetrics = positiveRates.slice(0, 10);
  subjectPerformanceChart = new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'pie',
    data: {
      labels: chartMetrics.map((metric) => metric.label),
      datasets: [
        {
          data: chartMetrics.map((metric) => metric.passRate),
          backgroundColor: DashboardAnalytics ? DashboardAnalytics.getColors(chartMetrics.length) : [],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } },
        tooltip: {
          callbacks: {
            label: (item) => {
              const metric = chartMetrics[item.dataIndex];
              return metric ? `${metric.passRate}% pass rate from ${metric.attempts} result(s)` : '';
            },
          },
        },
      },
    },
  });
  const leader = chartMetrics[0];
  subjectPerformanceNote.value = `<strong>${leader.label}</strong> leads with <strong>${leader.passRate}%</strong> pass rate in <strong>${ACTIVE_OVERVIEW_YEAR}</strong> for ${formatTermLabel(ACTIVE_SYNC_TERM)}.`;
};

const fetchSchoolResults = async (year: string): Promise<ResultRecord[]> => {
  const selectedYear = year || ACTIVE_SYNC_YEAR;
  ACTIVE_OVERVIEW_YEAR = selectedYear;
  try {
    const data = await callApi('GET_RESULTS', {
      schoolID: LOGGED_IN_SCHOOL_ID,
      year: selectedYear,
      term: ACTIVE_SYNC_TERM as ExamTerm,
      mode: 'MODE_B',
    });
    return data.status === 'success' ? (data.results as ResultRecord[]) : [];
  } catch {
    return [];
  }
};

const loadSchoolStats = async (): Promise<void> => {
  loadingVisible.value = true;
  try {
    const configData = (await callApi('GET_CONFIG', { schoolID: LOGGED_IN_SCHOOL_ID })) as unknown as {
      academicYear?: string;
      currentTerm?: string;
      activeExamType?: string;
      examDuration?: number;
      mode?: string;
      promotionActive?: boolean;
    };
    syncPromotionNotice(configData.promotionActive || false);

    if (configData.academicYear) {
      ACTIVE_SYNC_YEAR = configData.academicYear;
      ACTIVE_OVERVIEW_YEAR = configData.academicYear;
      currentSessionDisplay.value = configData.academicYear;
      syncAcademicYear(configData.academicYear);
      pieYearFilter.value = `YEAR#${getAcademicYearStart(configData.academicYear)}`;
    }
    ACTIVE_SYNC_TERM = (configData.currentTerm || 'TERM1').toUpperCase();
    invigilatorTermFilter.value = ACTIVE_SYNC_TERM;

    const selectedYear = pieYearFilter.value
      ? `${pieYearFilter.value.split('#')[1]}/${Number(pieYearFilter.value.split('#')[1]) + 1}`
      : ACTIVE_SYNC_YEAR;
    ACTIVE_OVERVIEW_YEAR = selectedYear;

    const [students, results] = await Promise.all([
      getStudentsFromLambda({ returnOnly: true, silent: true }),
      fetchSchoolResults(selectedYear),
    ]);

    masterResultList.value = results;
    renderTable(students);
    renderClassPopulationChart(students);
    renderSubjectPerformanceChart();
    populateDataLists(students);

    const localMode =
      localStorage.getItem(`LAEC_LocalMode_${LOGGED_IN_SCHOOL_ID}`) || configData.mode || 'MODE_B';
    updateLocalModeUI(localMode);
    setModeDisplay(localMode);
    globalModeHint.value =
      localMode === 'MODE_A' ? `Current Admin Category: ${configData.activeExamType || 'Not Set'}` : 'Internal School Control active.';
    globalExamType.value = configData.activeExamType || '#';
    syncResultFiltersWithConfig(configData);
    handleCategoryChange();

    if (configData.examDuration) {
      const totalMinutes = parseInt(String(configData.examDuration), 10) || 0;
      timerH.value = Math.floor(totalMinutes / 60);
      timerM.value = totalMinutes % 60;
      timerS.value = 0;
    }

    examSession()?.syncConfig('exam-session-root', configData);
  } catch (e) {
    console.error('Stats load failed', e);
    renderClassPopulationChart([]);
    renderSubjectPerformanceChart();
  }
  loadingVisible.value = false;
};

/* ── mount ────────────────────────────────────────────────────────────── */

/*
 * RF-5: the console idle timeout this page inherits from the shared admin
 * surfaces. `useIdleTimeout` registers lifecycle hooks, so it runs during
 * setup rather than inside the async onMounted below.
 */
useIdleTimeout({ mode: 'admin' });

onMounted(async () => {
  /* The operator's name, not "ICT ADMIN: <name>" — the prefix restated the role
     badge beside it and was the part that got ellipsised. */
  const adminName = localStorage.getItem('AdminName');
  schoolIdentity.value = adminName || SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || 'ICT Center Admin';
  schoolLockDisplay.value = SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || 'Locked';
  copyrightYear.value = String(new Date().getFullYear());

  await nextTick();
  syncHeaderOffset();
  toggleBackToTopButton();
  window.addEventListener('resize', syncHeaderOffset);
  window.addEventListener('scroll', toggleBackToTopButton, { passive: true });

  restoreCachedModeUI();
  restoreActiveTab();

  const hooks = ((window as unknown as Record<string, unknown>).__LAEC_ADMIN_HOOKS__ ??=
    {}) as Record<string, unknown>;
  Object.assign(hooks, {
    winAlert,
    closeAlert,
    toggleNav,
    showTab,
    scrollToTopPage,
    handleLogout,
  });

  // The paper queue, on the mock transport (D-39).
  /*
   * The question manager (RF-79). The library is loaded first-party and hard-codes
   * the live endpoints from /config.js, so the bridge answers its five actions
   * from the typed mock; `init()` is called here because the library's own
   * DOMContentLoaded listener fires before this view mounts (D-46).
   */
  installLibraryFetchBridge();
  window.LAECQuestionManager?.init();

  examSession()?.init({
    rootId: 'exam-session-root',
    categorySelectId: 'global-exam-type',
    schoolID: LOGGED_IN_SCHOOL_ID,
    mode: 'MODE_B',
    baseUrl: 'http://mock.local/students',
    getCategory: () => globalExamType.value,
    getYear: () => ACTIVE_SYNC_YEAR,
    getTerm: () => ACTIVE_SYNC_TERM,
    utils: buildLibraryUtils(),
  });

  // The origin serves this library as a classic <script> in <head> (line 15);
  // here the template only exists after mount, so it is fetched then initialised
  // with the query string the origin serves.
  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = '/dashboard-registration.js?v=20260608-photo-upload';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  (window as unknown as {
    LAECRegistration?: { init: (config: Record<string, unknown>) => void };
  }).LAECRegistration?.init({
    rootId: 'register-portal-root',
    schoolId: LOGGED_IN_SCHOOL_ID,
    schoolName: SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || 'Locked School',
    title: 'Student Registration Portal',
    subtitle:
      'Complete student onboarding directly from the ICT dashboard. The assigned school is automatically pulled from the logged-in ICT admin session and can no longer be changed manually.',
    registerEndpoint: 'http://mock.local/register',
    utils: LAEC,
    onAlert: winAlert,
    onShowLoading: (message: string) => {
      loadingVisible.value = true;
      loadingText.value = message || 'LAEC School Portal Syncing...';
    },
    onHideLoading: () => {
      loadingVisible.value = false;
      loadingText.value = 'LAEC School Portal Syncing...';
    },
    onRefresh: () => void loadSchoolStats(),
  });

  const sidebarScript = document.createElement('script');
  sidebarScript.src = '/admin-sidebar.js';
  document.head.appendChild(sidebarScript);

  void loadSchoolStats();
  setInterval(checkHealth, 10000);
  checkHealth();
});

/*
 * The AWS SDK v2 is the one console that loads it instead of Cognito Identity JS
 * (D-15, PRD §4.7). The origin never instantiates a client on this page - it
 * calls fetch() directly - so the import is kept only to preserve the served
 * dependency surface; nothing here talks to AWS.
 */
void AWS;
</script>
