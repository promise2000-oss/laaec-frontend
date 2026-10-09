<template>
  <!--
    PRD §4.6 `/ca/` — School Admin Portal (College Administrator).

    Origin: origin-pages/ca.html. DOM 911–1664, script 1665–3706, style 25–908
    (generated into src/styles/ca-page.css). The eight tab panels keep the
    origin's ids; the two first-party surfaces (`#register-portal-root` and
    `#exam-session-root`) stay empty in the markup because
    `/dashboard-registration.js` and `/exam-session-controls.js` render into
    them, exactly as on the origin.
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
      <div id="alert-photo-area">
        <img
          v-if="alertPhoto"
          id="alert-body-img"
          :src="alertPhoto"
          style="width: 150px; height: 150px; object-fit: cover; border: 5px solid var(--laec-blue); border-radius: 10px; margin-bottom: 15px"
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

  <button
    class="back-to-top"
    id="backToTopBtn"
    aria-label="Back to top"
    :class="{ visible: backToTopVisible }"
    @click="scrollToTopPage()"
  >
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
        <div class="hero-copy">
          <div class="section-kicker">Operations Console</div>
          <h2 style="margin: 0">School Performance Summary</h2>
          <p id="global-mode-hint">{{ globalModeHint }}</p>
          <div class="hero-badges">
            <span class="meta-chip">Live student sync</span>
            <span class="meta-chip">Internal and joint exam control</span>
            <span class="meta-chip">Archive visibility</span>
          </div>
        </div>
        <div class="hero-actions">
          <button class="btn-success" @click="loadSchoolStats()">REFRESH DASHBOARD</button>
          <button class="btn-secondary" @click="showTab('exam-center')">OPEN EXAM CENTER</button>
        </div>
      </div>

      <!--
        All four stat cards share one value treatment (see
        styles/overview-charts.css). Each value used to carry its own inline
        font-size — 2.1rem by default, 1.8rem for the session, 1.1rem for the
        mode — and the second card carried a `border-left-color` that made it
        look selected. Neither was an active state: there is no selection
        concept on this row, so the tint only broke the set.

        The mode card's value is now the short "JOINT" / "INTERNAL" token with
        the long form as `.stat-sub`, which is what lets it keep the row's type
        size instead of being shrunk to fit a 24-character label.
      -->
      <div class="stats-grid">
        <div class="stat-card">
          <h4>My Registered Students</h4>
          <div class="value" id="count-total">{{ countTotal }}</div>
        </div>
        <div class="stat-card">
          <h4>Active Academic Session</h4>
          <div class="value stat-value-accent" id="current-session-display">
            {{ currentSessionDisplay }}
          </div>
        </div>

        <div
          id="promotion-alert-banner"
          class="stat-card"
          :style="{
            display: promotionAlertVisible ? 'flex' : 'none',
            borderLeft: '5px solid var(--danger)',
            background: '#fff5f5',
            textAlign: 'left',
            padding: '1.5rem',
          }"
        >
          <div style="display: flex; align-items: center; gap: 15px">
            <span style="font-size: 0.95rem; font-weight: 800; letter-spacing: 0.12em; color: var(--danger)">ALERT</span>
            <div>
              <h4 style="margin: 0; color: var(--danger); text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem">
                CLASS PROMOTION: A call for action
              </h4>
              <p id="promotion-alert-msg" style="margin: 5px 0 0; color: #4a5568; font-size: 0.9rem; line-height: 1.4">
                {{ promotionAlertMessage }}
              </p>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <h4>System Mode</h4>
          <div class="value stat-value-accent" id="current-mode-display">{{ currentModeShort }}</div>
          <p class="stat-sub">{{ currentModeDisplay }}</p>
        </div>
        <div class="stat-card">
          <h4>AWS Cloud Sync</h4>
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
              <h3>Subject Pass Performance</h3>
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
              <h3>Class Population Histogram</h3>
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

    <!-- ── REGISTRATION PORTAL (rendered by /dashboard-registration.js) ── -->
    <div id="register" class="tab-panel" :class="{ active: activeTab === 'register' }">
      <div id="register-portal-root"></div>
    </div>

    <!-- ── STUDENT DIRECTORY ────────────────────────────────────────── -->
    <div id="students" class="tab-panel" :class="{ active: activeTab === 'students' }">
      <div class="card">
        <div class="grid-2">
          <div>
            <label>Quick Search</label>
            <input type="text" id="dir-search" list="student-names-list" placeholder="Search Student Name or ID..." v-model="dirSearch" @keyup="localSearch()" />
          </div>
          <div>
            <label>Filter By Class</label>
            <select id="dir-class-filter" v-model="dirClassFilter" @change="getStudentsFromLambda()">
              <option value="ALL">All Classes</option>
              <option value="JSS1">JSS 1</option>
              <option value="JSS2">JSS 2</option>
              <option value="JSS3">JSS 3</option>
              <option value="SS1">SS 1</option>
              <option value="SS2">SS 2</option>
              <option value="SS3">SS 3</option>
            </select>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 15px">
          <button class="btn-primary" @click="getStudentsFromLambda()">LOAD MY DIRECTORY</button>
          <button class="btn-success" @click="exportToExcel('studentTable', 'My_School_Students')">DOWNLOAD EXCEL</button>
          <button class="btn-primary" @click="downloadStudentCredentialPdf()">DOWNLOAD PDF</button>
        </div>

        <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5edf6">
          <h3 style="margin: 0 0 10px; font-size: 0.95rem; color: var(--laec-blue)">Student Subject Editor</h3>
          <div class="grid-2">
            <div>
              <label>Select Student</label>
              <select id="subject-editor-student" v-model="subjectEditorStudent" @change="loadStudentSubjectEditor()">
                <option value="">Select student to edit subjects...</option>
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
              <th>Arm</th>
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
              <td>
                <select :id="'student-class-' + index" v-model="rowClassEdits[index]" style="min-width: 82px; padding: 5px; font-size: 11px">
                  <option v-for="c in CLASS_OPTIONS" :key="c" :value="c">{{ c.replace('SS', 'SS ') }}</option>
                </select>
              </td>
              <td>
                <select :id="'student-arm-' + index" v-model="rowArmEdits[index]" style="min-width: 62px; padding: 5px; font-size: 11px">
                  <option v-for="arm in ARM_OPTIONS" :key="arm" :value="arm">{{ arm }}</option>
                </select>
              </td>
              <td>{{ studentDate(s) }}</td>
              <td>
                <button
                  style="background: var(--success); color: white; border: none; font-size: 9px; padding: 4px 8px; border-radius: 4px; cursor: pointer"
                  @click="saveStudentClassArm(s, index)"
                >
                  SAVE
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
              <td><button style="padding: 4px 8px; font-size: 9px" @click="viewStudentProfile(s)">VIEW</button></td>
            </tr>
            <tr v-if="!visibleStudents.length">
              <td colspan="10" style="text-align: center; color: #999">No student records found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── SCHOOL RESULTS ───────────────────────────────────────────── -->
    <div id="results" class="tab-panel" :class="{ active: activeTab === 'results' }">
      <div class="card">
        <h3>School Cumulative Results</h3>
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
              <option value="ALL_CUMULATIVE" style="font-weight: bold; color: var(--laec-blue)">All Results (Cumulative)</option>
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
            <label>Arm</label>
            <select id="res-arm" v-model="resArmFilter" @change="localResultSearch()" v-html="getArmOptionsMarkup('ALL', true)"></select>
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
            <button class="btn-success" @click="exportToExcel('resultsTable', 'School_Results_Export')">DOWNLOAD SPREADSHEET</button>
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
                <th>Arm</th>
                <th>Subject</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="results-table-body">
              <tr v-for="(r, index) in renderedResultList" :key="(r.PK || '') + (r.SK || '') + index">
                <td>{{ index + 1 }}</td>
                <td><b>{{ r.FullName }}</b></td>
                <td>{{ r.RegNo }}</td>
                <td>{{ getResultClassValue(r) || 'N/A' }}</td>
                <td>{{ getResultArmValue(r) || 'N/A' }}</td>
                <td>{{ r.Subject }}</td>
                <td style="font-weight: bold">{{ formatResultScore(r) }}</td>
                <td>
                  <button
                    class="btn-danger"
                    style="padding: 6px 12px; font-size: 10px"
                    @click="confirmDeleteResult(r.PK || '', r.SK || '')"
                  >
                    DELETE
                  </button>
                </td>
              </tr>
              <tr v-if="!renderedResultList.length">
                <td colspan="8" style="text-align: center; color: #999">No data found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── EXAMINATION CENTER ───────────────────────────────────────── -->
    <div id="exam-center" class="tab-panel" :class="{ active: activeTab === 'exam-center' }">
      <div class="control-box">
        <div class="hero-copy">
          <div class="section-kicker">Assessment Operations</div>
          <h2 style="margin: 0">Internal Exam Control</h2>
          <p id="local-mode-hint">{{ localModeHint }}</p>
        </div>
        <div class="mode-toggle-group">
          <button id="mode-a-btn" :class="modeAButtonClass" @click="toggleLocalMode('MODE_A')">MODE A (JOINT)</button>
          <button id="mode-b-btn" :class="modeBButtonClass" @click="toggleLocalMode('MODE_B')">MODE B (INTERNAL)</button>
        </div>
      </div>

      <div class="card">
        <h3>College Examination Settings</h3>
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
              <input type="number" id="timer-h" placeholder="HH" min="0" max="23" v-model="timerH" :disabled="timerDisabled" />
              <input type="number" id="timer-m" placeholder="MM" min="0" max="59" v-model="timerM" :disabled="timerDisabled" />
              <input type="number" id="timer-s" placeholder="SS" min="0" max="59" v-model="timerS" :disabled="timerDisabled" />
            </div>
          </div>
        </div>
        <!-- rendered by the first-party /exam-session-controls.js module -->
        <div id="exam-session-root"></div>
        <button class="btn-primary" style="margin-top: 20px; width: 100%" @click="updateExamGlobal()">SYNC INTERNAL SESSION SETTINGS</button>
      </div>

      <div class="grid-2">
        <div class="card" style="border-top: 5px solid var(--success)">
          <h3 style="color: var(--success)">Internal Question Blaster</h3>
          <label>Target Category</label>
          <select id="blast-session" v-model="blastSession" style="border-left: 4px solid var(--success)">
            <option value="#">...Select Category...</option>
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
          <label style="display: flex; align-items: center; gap: 10px; margin: 0 0 10px; text-transform: none; color: #2d3748">
            <input type="checkbox" id="blast-shuffle" v-model="blastShuffle" style="width: 18px; height: 18px" />
            <span style="font-size: 0.78rem; font-weight: 800">Shuffle questions for students</span>
          </label>
          <p style="margin: 0 0 10px; font-size: 0.78rem; color: #5f7087; line-height: 1.5">
            Go-live subject control now lives in the internal session settings card above. Use this blaster only to upload papers and set the
            compulsory student timer for that paper batch.
          </p>

          <button class="btn-success" style="width: 100%; font-weight: 800; padding: 15px" @click="handleBulkBlast()">
            START SYNCHRONIZED BLAST
          </button>
          <div class="surface-note">
            <div class="section-kicker" style="color: var(--laec-blue)">Upload Guardrails</div>
            <p class="muted-copy" style="margin: 0">
              Question imports now auto-normalize subject aliases, trim class formatting, and keep theory and objective rows in one reliable
              structure before cloud sync.
            </p>
            <ul class="guide-list">
              <li>Use the first worksheet only for live uploads.</li>
              <li>Keep <code>Subject</code>, <code>Class</code>, <code>Question</code>, and <code>QuestionType</code> columns present.</li>
              <li>Aliases like <code>ENGLISH</code> and <code>SS 1</code> are cleaned automatically before upload.</li>
            </ul>
          </div>
        </div>

        <div class="card">
          <h3>Internal Diagram Hosting</h3>
          <label>Upload Image</label>
          <input type="file" id="img-hosting" accept="image/*" />
          <button class="btn-primary" style="width: 100%; margin-top: 10px" @click="uploadQuestionImage()">GET CLOUD LINK</button>

          <div
            id="hosting-result-area"
            :class="{ hidden: !hostingResultVisible }"
            style="margin-top: 15px; padding: 12px; background: #eef5ff; border-radius: 8px; border: 1px solid var(--laec-blue)"
          >
            <label style="color: var(--laec-blue); font-size: 10px">Cloud URL (Paste into your Excel):</label>
            <div style="display: flex; gap: 5px">
              <input type="text" id="generated-url-field" readonly v-model="generatedUrl" style="flex: 1; padding: 8px; font-size: 11px" />
              <button class="btn-success" style="padding: 5px 12px; font-size: 11px" @click="copyDiagramURL()">COPY</button>
            </div>
          </div>
        </div>
      </div>

      <div
        id="demote-manager-card"
        class="card"
        :style="{ borderTop: '5px solid var(--danger)', display: demoteManagerVisible ? 'block' : 'none' }"
      >
        <h3 style="color: var(--danger)">Promotion Exception Manager</h3>
        <p style="font-size: 0.8rem; color: #666; margin-bottom: 20px">
          Search for a student by Registration Number to demote them back to their previous class if they were promoted in error.
        </p>
        <div class="grid-2">
          <div>
            <label>Student Registration ID</label>
            <input type="text" id="demote-search-id" placeholder="e.g. LAEC/SFC/2026/001" v-model="demoteSearchId" style="text-transform: uppercase" />
          </div>
          <div style="display: flex; align-items: flex-end">
            <button class="btn-primary" style="width: 100%" @click="findStudentForDemotion()">VERIFY STUDENT</button>
          </div>
        </div>

        <div class="surface-note" style="margin-top: 20px">
          <div class="section-kicker" style="color: var(--laec-blue)">Class Exception Batch</div>
          <p class="muted-copy" style="margin: 0 0 12px">
            Select a class to load its current students, tick the affected learners, then demote them together.
          </p>
          <div class="grid-2">
            <div>
              <label>Class Filter</label>
              <select id="demote-class-filter" v-model="demoteClassFilter" @change="populateDemotionClassList()">
                <option value="#">...Select Class...</option>
                <option v-for="c in [...CLASS_OPTIONS, 'GRADUATED']" :key="c" :value="c">{{ c.replace('SS', 'SS ') }}</option>
              </select>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 10px">
              <button
                class="btn-secondary"
                style="flex: 1; color: var(--laec-blue-deep); background: white; border: 1px solid var(--border)"
                @click="toggleDemotionClassSelection(true)"
              >
                SELECT ALL
              </button>
              <button class="btn-primary" style="flex: 1" v-if="sessionStore.can('exam.schedule.manage')" @click="executeSelectedDemotions()">DEMOTE SELECTED</button>
            </div>
          </div>
          <div class="table-responsive" style="margin-top: 15px; box-shadow: none">
            <table>
              <thead>
                <tr>
                  <th style="width: 80px">Select</th>
                  <th>Student Name</th>
                  <th>Registration Number</th>
                  <th>Current Class</th>
                  <th>Target Class</th>
                </tr>
              </thead>
              <tbody id="demote-class-list-body">
                <tr v-for="s in demotionClassRows" :key="s.RegNo">
                  <td>
                    <input
                      type="checkbox"
                      class="demote-student-checkbox"
                      :value="s.RegNo"
                      v-model="demotionSelection"
                      :disabled="!getDemotionTargetClass(s.Class)"
                      style="width: auto"
                    />
                  </td>
                  <td><b>{{ s.FullName || 'UNKNOWN' }}</b></td>
                  <td>{{ s.RegNo || 'N/A' }}</td>
                  <td>{{ s.Class || 'N/A' }}</td>
                  <td :style="{ color: getDemotionTargetClass(s.Class) ? 'var(--danger)' : '#999', fontWeight: 'bold' }">
                    {{ getDemotionTargetClass(s.Class) || 'Not eligible' }}
                  </td>
                </tr>
                <tr v-if="!demotionClassRows.length">
                  <td colspan="5" style="text-align: center; color: #7f8c9d">{{ demotionEmptyLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          id="demote-preview"
          :class="{ hidden: !demotionPreviewVisible }"
          style="margin-top: 20px; padding: 20px; background: #fffaf0; border: 1px solid #feebc8; border-radius: 12px"
        >
          <div style="display: flex; gap: 20px; align-items: center">
            <img
              id="demote-photo"
              :src="demotionTarget?.PassportURL || '/nicegene_logo.png'"
              style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--laec-blue)"
            />
            <div>
              <h4 id="demote-name" style="margin: 0">{{ demotionTarget?.FullName || '---' }}</h4>
              <p id="demote-info" style="margin: 5px 0; font-size: 0.9rem">
                Current Class: <span id="current-class-span" style="font-weight: bold; color: var(--laec-blue)">{{
                  demotionTarget?.Class || '---'
                }}</span>
              </p>
              <p id="demote-target" style="margin: 0; font-size: 0.85rem; color: var(--danger); font-weight: bold">
                New Class after Demotion: <span id="target-class-span">{{ demotionTargetClassLabel }}</span>
              </p>
            </div>
          </div>
          <div style="margin-top: 20px; display: flex; gap: 10px">
            <button class="btn-danger" style="flex: 1" @click="executeIndividualDemotion()">CONFIRM &amp; DEMOTE</button>
            <button class="btn-primary" style="background: #ccc; color: #333; flex: 1" @click="cancelDemotion()">CANCEL</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── QUESTION ARCHIVE ─────────────────────────────────────────── -->
    <div id="past-questions" class="tab-panel" :class="{ active: activeTab === 'past-questions' }">
      <div class="card">
        <div class="section-kicker" style="color: var(--laec-blue)">Verification Workspace</div>
        <h3>Question Archive Explorer</h3>
        <p class="muted-copy">
          Use this space to confirm that uploaded papers can be retrieved with the same subject, class, year, and mode logic students use in
          the exam hall.
        </p>
        <div class="grid-2">
          <div>
            <label>Mode</label>
            <select id="pq-mode" v-model="pqMode">
              <option value="MODE_B">School Internal (Mode B)</option>
              <option value="MODE_A">Joint Archive (Mode A)</option>
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
            <label>Target Category</label>
            <select id="pq-type" v-model="pqType">
              <option value="CA1">CA 1</option>
              <option value="CA2">CA 2</option>
              <option value="EXAM">EXAM</option>
            </select>
          </div>
          <div>
            <label>Term</label>
            <select id="pq-term" v-model="pqTerm">
              <option value="TERM1">1st Term</option>
              <option value="TERM2">2nd Term</option>
              <option value="TERM3">3rd Term</option>
            </select>
          </div>
          <div>
            <label>Class</label>
            <select id="pq-class" v-model="pqClass">
              <option v-for="c in CLASS_OPTIONS" :key="c" :value="c">{{ c.replace('SS', 'SS ') }}</option>
            </select>
          </div>
          <div>
            <label>Year</label>
            <select id="pq-year" v-model="pqYear">
              <option v-for="year in yearOptions" :key="year" :value="year + '/' + (year + 1)">{{ year }}/{{ year + 1 }}</option>
            </select>
          </div>
        </div>
        <div class="archive-toolbar">
          <button class="btn-primary" @click="loadPastQuestions()">LOAD QUESTIONS</button>
          <button class="btn-success" @click="exportToExcel('archiveTable', 'Question_Archive_Export')">DOWNLOAD QUESTIONS</button>
        </div>
        <div id="archive-summary" class="archive-summary">
          {{ archiveSummary || 'Choose a mode, subject, class, and category to inspect the normalized question archive.' }}
        </div>
      </div>
      <div class="table-responsive">
        <table id="archiveTable">
          <thead>
            <tr>
              <th>SN</th>
              <th>Subject</th>
              <th>Class</th>
              <th>Mode</th>
              <th>Type</th>
              <th>Question Text</th>
            </tr>
          </thead>
          <tbody id="pq-table-body">
            <tr v-for="(q, index) in pastQuestionRows" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ LAEC.humanizeSubject(q.Subject || '') }}</td>
              <td>{{ q.Class }}</td>
              <td>{{ pqMode === 'MODE_A' ? 'Joint' : 'Internal' }}</td>
              <td>{{ q.QuestionType || pqType }}</td>
              <td style="font-size: 11px">{{ q.Question || q.Text }}</td>
            </tr>
            <tr v-if="!pastQuestionRows.length">
              <td colspan="6" style="text-align: center; color: #7f8c9d">{{ archiveEmptyLabel }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── INTERNAL ADMINS ──────────────────────────────────────────── -->
    <div id="ict-access" class="tab-panel" :class="{ active: activeTab === 'ict-access' }">
      <div class="card">
        <h3>Manage Internal Admins</h3>
        <p style="font-size: 0.8rem; color: #666; margin-bottom: 1.5rem">
          Grant access for additional School Admins or ICT Admins in this college. You can revoke only the internal admins you created here;
          the original School Admin created by the Super Admin remains protected.
        </p>
        <div class="grid-2">
          <div><label>Full Name</label><input type="text" id="ict-name" v-model="ictName" placeholder="Internal Admin Name" /></div>
          <div>
            <label>Username / Admin ID</label>
            <input type="text" id="ict-username" v-model="ictUsername" placeholder="e.g. yourname@schoolname" />
            <p style="font-size: 0.68rem; color: #777; margin: 6px 0 0">
              No spaces or apostrophes. Use letters, numbers, @, underscore, hyphen, or dot. Example: ict@finbarrscollege.
            </p>
          </div>
          <div>
            <label>Email Address</label>
            <input type="email" id="ict-email" v-model="ictEmail" placeholder="ict@school.edu" />
            <p style="font-size: 0.68rem; color: #777; margin: 6px 0 0">
              Use a dedicated email. An email already used by a student cannot be used for admin access.
            </p>
          </div>
          <div>
            <label>Administrative Role</label>
            <select id="internal-admin-role" v-model="ictRole">
              <option value="ICT_ADMIN">ICT_ADMIN (ICT Dashboard)</option>
              <option value="EXAM_COMMITTEE">EXAM_COMMITTEE (Exam Committee Dashboard)</option>
              <option value="SCHOOL_ADMIN">SCHOOL_ADMIN (College Dashboard)</option>
            </select>
          </div>
          <div><label>Set Password</label><input type="text" id="ict-pass" v-model="ictPass" placeholder="Password" /></div>
          <div style="display: flex; align-items: flex-end">
            <button class="btn-primary" style="width: 100%" v-if="sessionStore.can('admins.manage')" @click="grantICTAccess()">GRANT INTERNAL ACCESS</button>
          </div>
        </div>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody id="ict-access-table">
            <tr v-for="adm in ictAdmins" :key="adm.Username">
              <td>{{ adm.FullName }}</td>
              <td style="font-weight: bold; color: var(--laec-blue)">{{ adm.Username || 'N/A' }}</td>
              <td>{{ adm.Email }}</td>
              <td><span style="font-size: 0.7rem; font-weight: bold">{{ adm.Role || 'ADMIN' }}</span></td>
              <td>
                <span :style="{ color: adm.Enabled === false ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }">{{
                  adm.Status || (adm.Enabled === false ? 'DISABLED' : 'ACTIVE')
                }}</span>
              </td>
              <td>
                <button
                  v-if="canRevokeInternalAdmin(adm)"
                  class="btn-danger"
                  style="padding: 4px 8px; font-size: 10px"
                  @click="revokeICTAccess(adm.Username || '', adm.Email || '')"
                >
                  REVOKE
                </button>
                <span v-else style="font-size: 0.7rem; color: #777; font-weight: bold">PROTECTED</span>
              </td>
            </tr>
            <tr v-if="!ictAdmins.length">
              <td colspan="6" style="text-align: center; color: #999">{{ ictEmptyLabel }}</td>
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
        <p id="ping-status" :style="{ fontWeight: 'bold', color: pingStatusColor }">{{ pingStatus }}</p>
      </div>

      <div class="card" style="border-top: 5px solid var(--danger)">
        <h3>Real-Time Proctoring &amp; Invigilation Monitor</h3>
        <p style="font-size: 0.8rem; color: #666; margin-bottom: 1.5rem">
          <b>Internal Oversight:</b> Strictly monitoring flagged violations for this college.
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
            <input
              type="text"
              id="invigilator-subject-filter"
              list="res-subject-options"
              placeholder="Type or choose subject"
              v-model="invigSubject"
              @change="refreshInvigilatorFeed()"
            />
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
                <td colspan="7" style="text-align: center; color: var(--success); font-weight: bold">
                  {{ invigilatorEmptyLabel }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="border-top: 5px solid var(--warning)">
        <h3>Promotion Exception Demotion Register</h3>
        <p class="muted-copy">
          This register keeps a school-level history of students demoted through the Promotion Exception Manager and counts repeated demotions.
        </p>
        <div class="filter-action-buttons" style="margin-bottom: 15px">
          <button class="btn-primary" @click="loadDemotionLog()">REFRESH DEMOTION REGISTER</button>
          <button class="btn-success" @click="exportToExcel('demotionLogTable', 'Promotion_Exception_Demotion_Register')">DOWNLOAD REGISTER</button>
        </div>
        <div class="table-responsive">
          <table id="demotionLogTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student Name</th>
                <th>Reg No</th>
                <th>From</th>
                <th>To</th>
                <th>Total Demotions</th>
              </tr>
            </thead>
            <tbody id="demotion-log-body">
              <tr v-for="(log, index) in demotionLogs" :key="index">
                <td>{{ log.DemotedAt ? new Date(log.DemotedAt).toLocaleString() : 'N/A' }}</td>
                <td><b>{{ log.FullName || 'UNKNOWN' }}</b></td>
                <td>{{ log.RegNo || 'N/A' }}</td>
                <td>{{ log.PreviousClass || 'N/A' }}</td>
                <td style="color: var(--danger); font-weight: bold">{{ log.NewClass || 'N/A' }}</td>
                <td style="font-weight: bold">{{ demotionCounts[log.RegNo] || 1 }}</td>
              </tr>
              <tr v-if="!demotionLogs.length">
                <td colspan="6" style="text-align: center; color: #999">{{ demotionLogEmptyLabel }}</td>
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
 * PRD §4.6 `/ca/` — School Admin Portal.
 *
 * Transcribed from origin-pages/ca.html (DOM 911–1664, script 1665–3706). Notes
 * on the deviations from a literal port:
 *  - No client-side ROLE guard (D-11 / PRD D6). The origin does redirect when
 *    `localStorage.LAEC_Session` is missing (ca.html line 3652), so that check
 *    is reproduced verbatim.
 *  - The paper queue and the registration portal are first-party libraries
 *    pointed at a mock transport through `buildLibraryUtils()`; the origin
 *    passes the live AWS endpoints (D-39).
 *  - `loadICTAdmins` is declared twice in the origin (lines 3549 and 3582); the
 *    second declaration wins at parse time, so only the second body is served
 *    (the `PROTECTED` revoke branch). Logged as an origin quirk, DEV-7.
 *  - The origin's `syncResultFiltersWithConfig` also writes `#script-*` ids that
 *    exist on no page here, so those four lines are kept but inert.
 */
import { Chart } from 'chart.js/auto';
import * as XLSX from 'xlsx';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
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
  SCHOOL_NAMES,
  buildLibraryUtils,
  dedupeInvigilatorResults,
  exportToExcel,
  formatResultScore,
  formatTermLabel,
  getAcademicYearStart,
  getArmOptionsMarkup,
  getResultClassValue,
  installLibraryFetchBridge,
  createMockGetFetch,
  installResultScriptViewer,
  getStudentArmValue,
  isTimeExpiryViolation,
  INVIGILATOR_CATEGORIES,
  msgOf,
  normalizeSubjectInput,
  resultMatchesFilters,
  studentDate,
} from '../lib/console';
import { useIdleTimeout } from '../composables/useIdleTimeout';
import { STORAGE_KEYS } from '../types';
import type {
  AdminAccount,
  AdminRole,
  DemotionLog,
  ExamCategory,
  ExamTerm,
  Question,
  ResultRecord,
  Student,
} from '../types';
import '../styles/ca-page.css';
import '../styles/overview-charts.css';

/* The origin loads SheetJS from a CDN <script> (ca.html line 16, pinned to
   0.18.5 — the same version this project depends on), so `/config.js`'s
   `extractFormattedQuestionRows` can see `window.XLSX`. Same bridge as
   /admin/ (D-32). */
(window as unknown as { XLSX: typeof XLSX }).XLSX = XLSX;

/* The flat tab strip is gone (D-60, D-62): its sections and their order now live
   in src/lib/nav.ts, which every console reads, so a role's navigation has one
   definition rather than one per view. The tab ids are unchanged, so showTab(),
   refreshTabData() and the saved-tab restore all still address the same panels. */

const CLASS_OPTIONS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'] as const;
const ARM_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;

/** The `#res-subject-options` datalist, as served (ca.html lines 1141–1212). */
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

const DEMOTION_CLASS_MAP: Record<string, string> = {
  JSS2: 'JSS1',
  JSS3: 'JSS2',
  SS1: 'JSS3',
  SS2: 'SS1',
  SS3: 'SS2',
  GRADUATED: 'SS3',
};

/* ── reactive mirrors of the elements the origin writes to ────────────── */

let ACTIVE_SYNC_TERM = 'TERM1';
let ACTIVE_SYNC_YEAR = '2025/2026';
let ACTIVE_OVERVIEW_YEAR = ACTIVE_SYNC_YEAR;

const LOGGED_IN_SCHOOL_ID = '001';
const loggedInAdminUsername = () => localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const loggedInAdminRole = () =>
  (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SCHOOL_ADMIN') as AdminRole;

/* AppShell wiring (D-62). `currentRole` is read once, like the origin's own
   session reads, and `navFor` turns it into this role's sections. */
const currentRole = localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SCHOOL_ADMIN';
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
  takePendingPanel(navMeta, 'activeCA_Tab') || 'dashboard',
);
const navOpen = ref(false);
const backToTopVisible = ref(false);
const loadingVisible = ref(false);
/* Fed to <AppLoading>. Replaces the origin's
   `document.getElementById('loading-overlay-text').innerText = …`, which wrote
   straight into the DOM and was therefore lost on the next re-render (D-74). */
const loadingText = ref('LAEC School Portal Syncing...');
const copyrightYear = ref('');
const schoolIdentity = ref('Loading Identity...');

const countTotal = ref('0');
const currentSessionDisplay = ref('SYNCING...');
const currentModeDisplay = ref('LOADING...');
/** Short token for the mode card; the long form is the caption beneath it. */
const currentModeShort = ref('LOADING');

/*
 * Latency card caption and colour. `pingWhat` names what the ping measures — the
 * card says "AWS Cloud Sync" but not that this is a round-trip to a public S3
 * asset rather than to the API, which is the more surprising thing to learn —
 * and `pingCheckedAt` makes a stale reading distinguishable from a fresh one.
 *
 * The thresholds are shared with the System Health panel's status line, in
 * checkHealth below, so the two surfaces cannot disagree about what is healthy.
 */
type PingTone = 'unknown' | 'good' | 'warn' | 'bad';
const pingTone = ref<PingTone>('unknown');
const pingCheckedAt = ref('checking…');
const pingWhat = 'Round-trip to AWS us-east-1';
const globalModeHint = ref('Syncing global system mode...');
const localModeHint = ref('Current: syncing with super admin...');
const modeAButtonClass = ref('mode-btn');
const modeBButtonClass = ref('mode-btn');
const pingMs = ref('-- ms');
const pingLarge = ref('--');
const pingStatus = ref('Monitoring Region us-east-1...');
const pingStatusColor = ref('');
const promotionAlertVisible = ref(false);
const promotionAlertMessage = ref('');
const demoteManagerVisible = ref(false);
const subjectPerformanceNote = ref('Comparing subject pass rates across the current active school session.');
const classPopulationNote = ref('Showing how the current student directory is distributed from JSS1 to SS3.');
/*
 * Longest label drawn on the class histogram's category axis; the axis is
 * truncated to this and the full value is in the tooltip, so a wide class name
 * ("GRADUATED", "UNCLASSIFIED") cannot be drawn over its neighbours.
 */
const CLASS_AXIS_LABEL_MAX = 14;

/** "GRADUATED" fits; "UNCLASSIFIED"-style values are trimmed to fit + ellipsis. */
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
const yearOptions = computed<number[]>(() =>
  [...ACADEMIC_YEARS, ...extraYears.value].sort((a, b) => a - b),
);

const dirSearch = ref('');
const dirClassFilter = ref('ALL');
const masterStudentList = ref<Student[]>([]);
const visibleStudents = ref<Student[]>([]);
const rowClassEdits = ref<Record<number, string>>({});
const rowArmEdits = ref<Record<number, string>>({});
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
const resArmFilter = ref('ALL');
const resRegFilter = ref('');
const resSubjectInput = ref('');
const masterResultList = ref<ResultRecord[]>([]);
const renderedResultList = ref<ResultRecord[]>([]);

const globalExamType = ref('#');
const timerH = ref<number | string>('');
const timerM = ref<number | string>('');
const timerS = ref<number | string>('');
const timerDisabled = ref(true);

const blastSession = ref('#');
const blastH = ref<number | string>('');
const blastM = ref<number | string>('');
const blastS = ref<number | string>('');
const blastInstruction = ref('');
const blastShuffle = ref(true);
const generatedUrl = ref('');
const hostingResultVisible = ref(false);

const demoteSearchId = ref('');
const demoteClassFilter = ref('#');
const demotionTarget = ref<Student | null>(null);
const demotionPreviewVisible = ref(false);
const demotionClassRows = ref<Student[]>([]);
const demotionSelection = ref<string[]>([]);
const demotionEmptyLabel = ref('Select a class to load students.');
const demotionTargetClassLabel = ref('---');
const demotionLogs = ref<DemotionLog[]>([]);
const demotionCounts = ref<Record<string, number>>({});
const demotionLogEmptyLabel = ref('No demotion history loaded yet.');

const pqMode = ref('MODE_B');
const pqSubject = ref('#');
const pqType = ref('CA1');
const pqTerm = ref('TERM1');
const pqClass = ref('JSS1');
const pqYear = ref('2025/2026');
const pastQuestionRows = ref<Question[]>([]);
const archiveSummary = ref('');
const archiveEmptyLabel = ref('Archive results will appear here.');

const ictName = ref('');
const ictUsername = ref('');
const ictEmail = ref('');
const ictRole = ref('ICT_ADMIN');
const ictPass = ref('');
const ictAdmins = ref<AdminAccount[]>([]);
const ictEmptyLabel = ref('Loading internal admin records...');

const invigilatorYearFilter = ref('2025/2026');
const invigilatorTermFilter = ref('TERM1');
const invigMode = ref('MODE_B');
const invigClass = ref('ALL');
const invigSubject = ref('');
const invigilatorRows = ref<ResultRecord[]>([]);
const invigilatorEmptyLabel = ref('Waiting for live activity...');

/* ── custom alert (origin winAlert / closeAlert) ───────────────────────── */

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
): void => {
  alertTitle.value = title;
  alertMsg.value = msg;
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

/**
 * Empty stub on the origin (ca.html lines 2123–2129) — administrator
 * single-session locking is not enforced here, as on the other three consoles
 * (RF-67, D-10). `handleLogout` awaits it before clearing storage; the
 * heartbeat counterpart is only called by the origin's own idle tracker, which
 * `useIdleTimeout` replaces, so it is not reproduced as dead code.
 */
const releaseAdminSession = async (): Promise<void> => undefined;

const handleLogout = (): void => {
  winAlert('LOGOUT', 'End this session?', 'confirm', () => {
    void releaseAdminSession();
    localStorage.clear();
    window.location.href = '/control/';
  });
};

const showTab = (tabId: string, options: { skipRefresh?: boolean } = {}): void => {
  if (!document.getElementById(tabId)) return;
  activeTab.value = tabId;
  localStorage.setItem('activeCA_Tab', tabId);
  if (tabId !== 'register') {
    (window as unknown as { LAECRegistration?: { stopCamera: () => void } }).LAECRegistration?.stopCamera();
  }
  if (window.innerWidth <= 900) navOpen.value = false;
  if (!options.skipRefresh) void refreshTabData(tabId);
};

const restoreActiveTab = (): void => {
  const fallbackTab = 'dashboard';
  const savedTab = localStorage.getItem('activeCA_Tab') || fallbackTab;
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
    void loadGlobalStats();
    examSession()?.refresh('exam-session-root', true);
    return;
  }
  if (tabId === 'past-questions') {
    if (pqSubject.value !== '#') void loadPastQuestions();
    return;
  }
  if (tabId === 'ict-access') {
    void loadICTAdmins();
    return;
  }
  if (tabId === 'health') {
    checkHealth();
    void refreshInvigilatorFeed();
    void loadDemotionLog();
  }
};

/* ── academic session and mode ────────────────────────────────────────── */

const syncAcademicYear = (year: string): void => {
  const start = getAcademicYearStart(year);
  if (!Number.isFinite(start)) return;
  if (!yearOptions.value.includes(start)) extraYears.value = [...extraYears.value, start];
};

const updateLocalModeUI = (mode: string): void => {
  const joint = mode === 'MODE_A';
  modeAButtonClass.value = joint ? 'mode-btn active-a' : 'mode-btn';
  modeBButtonClass.value = joint ? 'mode-btn' : 'mode-btn active-b';
  localModeHint.value = `Local Status: ${joint ? 'JOINT' : 'INTERNAL'} ACTIVE`;
};

/*
 * The mode card shows a short token as its value and the long form as a caption.
 * "INTERNAL (School Override)" is 24 characters set in the same display face as
 * "2025/2026", so the card was shrunk to 1.1rem inline to fit — which is why one
 * stat read visibly smaller than its three neighbours. Both strings derive from
 * the same mode, so the value and the caption cannot disagree.
 */
const MODE_LABELS: Record<string, { short: string; full: string }> = {
  MODE_A: { short: 'JOINT', full: 'JOINT (Synced with Master)' },
  MODE_B: { short: 'INTERNAL', full: 'INTERNAL (School Override)' },
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
      void loadGlobalStats();
      winAlert('Update Successful', `School switched to ${mode === 'MODE_A' ? 'JOINT' : 'INTERNAL'} mode.`);
    }
  } catch {
    winAlert('Error', 'Update failed.');
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
  timerDisabled.value = cat === '#';
};

const syncResultFiltersWithConfig = (config: {
  academicYear?: string;
  currentTerm?: string;
  activeExamType?: string;
  currentMode?: string;
  mode?: string;
}): void => {
  const setSelectValue = (target: { value: string }, value: string | undefined): void => {
    const normalized = String(value || '').toUpperCase();
    if (normalized) target.value = normalized;
  };
  setSelectValue(resYear, config.academicYear);
  setSelectValue(resTerm, config.currentTerm || ACTIVE_SYNC_TERM);
  setSelectValue(resCategory, config.activeExamType);
  setSelectValue(
    resMode,
    config.currentMode ||
      config.mode ||
      localStorage.getItem(`LAEC_LocalMode_${LOGGED_IN_SCHOOL_ID}`) ||
      undefined,
  );
};

const syncPromotionUI = (isPromotionActive: boolean): void => {
  promotionAlertVisible.value = isPromotionActive;
  demoteManagerVisible.value = isPromotionActive;
  if (isPromotionActive) {
    promotionAlertMessage.value =
      'The Super Admin has opened the promotion window. Use the Promotion Exception Manager below to roll back any student promoted in error.';
  }
};

const loadGlobalStats = async (): Promise<Record<string, unknown> | null> => {
  try {
    const data = (await callApi('GET_CONFIG', { schoolID: LOGGED_IN_SCHOOL_ID })) as unknown as {
      academicYear?: string;
      currentTerm?: string;
      activeExamType?: string;
      examDuration?: number;
      mode?: string;
      promotionActive?: boolean;
    };

    syncPromotionUI(Boolean(data.promotionActive));

    if (data.academicYear) {
      ACTIVE_SYNC_YEAR = data.academicYear;
      ACTIVE_OVERVIEW_YEAR = data.academicYear;
      currentSessionDisplay.value = data.academicYear;
      syncAcademicYear(data.academicYear);
      pieYearFilter.value = `YEAR#${getAcademicYearStart(data.academicYear)}`;
    }
    ACTIVE_SYNC_TERM = (data.currentTerm || 'TERM1').toUpperCase();
    invigilatorTermFilter.value = ACTIVE_SYNC_TERM;

    const localMode =
      (localStorage.getItem(`LAEC_LocalMode_${LOGGED_IN_SCHOOL_ID}`) as string) || data.mode || 'MODE_B';
    updateLocalModeUI(localMode);

    if (localMode === 'MODE_A') {
      setModeDisplay('MODE_A');
      globalModeHint.value = `Global Admin Active Category: ${data.activeExamType}`;
      globalExamType.value = data.activeExamType || '#';
    } else {
      setModeDisplay('MODE_B');
      globalModeHint.value = 'School-specific exam session active.';
      globalExamType.value = data.activeExamType || '#';
    }

    if (data.examDuration) {
      const totalMinutes = parseInt(String(data.examDuration), 10) || 0;
      timerH.value = Math.floor(totalMinutes / 60);
      timerM.value = totalMinutes % 60;
      timerS.value = 0;
    }
    syncResultFiltersWithConfig(data as never);
    handleCategoryChange();
    examSession()?.syncConfig('exam-session-root', data as never);
    return data as unknown as Record<string, unknown>;
  } catch {
    console.warn('Mode sync failed');
    return null;
  }
};

/* ── students (origin lines 1828–1956, 2971–3156) ─────────────────────── */

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
  const classes: Record<number, string> = {};
  const arms: Record<number, string> = {};
  list.forEach((student, index) => {
    classes[index] = String(student.Class || 'JSS1');
    arms[index] = String(getStudentArmValue(student) || 'A');
  });
  rowClassEdits.value = classes;
  rowArmEdits.value = arms;
};

const localSearch = (): void => {
  const query = (dirSearch.value || '').toLowerCase();
  const classFilter = dirClassFilter.value;
  const filtered = masterStudentList.value.filter((student) => {
    const matchesClass = classFilter === 'ALL' || student.Class === classFilter;
    const name = (student.FullName || '').toLowerCase();
    const regNo = (student.RegNo || '').toLowerCase();
    const matchesQuery = !query || name.includes(query) || regNo.includes(query);
    return matchesClass && matchesQuery;
  });
  renderTable(filtered);
};

const getStudentsFromLambda = async (
  options: { returnOnly?: boolean; silent?: boolean; classFilter?: string } = {},
): Promise<Student[]> => {
  const classFilter = options.classFilter || dirClassFilter.value || 'ALL';
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
        classFilter !== 'ALL'
          ? masterStudentList.value.filter((student) => student.Class === classFilter)
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

const viewStudentProfile = (student: Student): void => {
  alertPhoto.value = student.PassportURL || '/nicegene_logo.png';
  const arm = getStudentArmValue(student);
  winAlert(
    'IDENTITY VERIFICATION',
    `NAME: ${student.FullName}\nREG ID: ${student.RegNo}\nPASS: ${student.Password || 'PROTECTED'}\nCLASS: ${student.Class}${arm ? ' ' + arm : ''}`,
  );
};

const saveStudentClassArm = async (student: Student, index: number): Promise<void> => {
  const studentClass = String(rowClassEdits.value[index] || '');
  const studentArm = String(rowArmEdits.value[index] || '');
  const targetSchoolID = String(student.SchoolID || LOGGED_IN_SCHOOL_ID);
  if (!student.RegNo || !studentClass || !studentArm) {
    winAlert('Missing Data', 'Select both class and arm before saving.');
    return;
  }
  loadingVisible.value = true;
  try {
    const data = await callApi('UPDATE_STUDENT_CLASS_ARM', {
      schoolID: targetSchoolID,
      regNo: student.RegNo,
      studentClass,
      studentArm,
    });
    if (data.status === 'error') throw new Error(data.message || 'Could not update student.');
    student.Class = studentClass;
    student.Arm = studentArm;
    student.StudentArm = studentArm;
    winAlert('Saved', 'Student class and arm updated.');
    localSearch();
  } catch (e) {
    winAlert('Update Error', msgOf(e) || 'Could not save class and arm.');
  }
  loadingVisible.value = false;
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
            throw new Error(data.message || 'Could not delete student.');
          }
        } catch (e) {
          winAlert('Error', msgOf(e) || 'Could not delete student.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/** jsPDF credential slips, or the origin's print-window fallback. */
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

/* ── results (origin lines 2607–2933) ─────────────────────────────────── */

const getResultArmValue = (result: ResultRecord): string => {
  const direct = String(result.Arm || result.StudentArm || '').toUpperCase();
  if (direct) return direct;
  const student = masterStudentList.value.find(
    (item) => String(item.RegNo || '').toUpperCase() === String(result.RegNo || '').toUpperCase(),
  );
  return getStudentArmValue(student);
};

const applyCurrentResultFilters = (results: ResultRecord[] = masterResultList.value): ResultRecord[] =>
  results.filter((result) =>
    resultMatchesFilters(result, {
      query: (resRegFilter.value || '').toLowerCase(),
      classFilter: resClassFilter.value,
      armFilter: (resArmFilter.value || 'ALL').toUpperCase(),
      armOf: getResultArmValue,
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
    return (data.status === 'success' ? data.results : []) as ResultRecord[];
  } catch {
    return [];
  }
};

const loadSchoolResults = async (): Promise<void> => {
  loadingVisible.value = true;
  const year = resYear.value;
  const term = resTerm.value;
  const category = resCategory.value;
  const mode = resMode.value;
  const subject = normalizeSubjectInput(resSubjectInput.value);
  const studentClass = resClassFilter.value || 'ALL';
  const studentArm = resArmFilter.value || 'ALL';

  try {
    const data = await callApi('GET_RESULTS', {
      schoolID: LOGGED_IN_SCHOOL_ID,
      year,
      term: term as ExamTerm,
      category: category as ExamCategory,
      mode: mode as 'MODE_A',
      subject,
      class: studentClass,
      studentArm,
    });
    if (data.status === 'success') {
      masterResultList.value = data.results as ResultRecord[];
      if (!masterStudentList.value.length) {
        await getStudentsFromLambda({ silent: true, returnOnly: true });
      }
      populateDataLists(masterStudentList.value);
      localResultSearch();
    }
  } catch {
    console.error('Results Sync Error:');
    winAlert('Sync Error', 'Could not reach results engine.');
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
  winAlert(
    'REMARK RESULTS',
    `Remark ${records.length} loaded result(s) from the stored student scripts?`,
    'confirm',
    () => {
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
    },
  );
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
  winAlert(
    'CONFIRM DELETION',
    'Are you sure? This will remove the result and allow the student to re-sit the exam.',
    'confirm',
    () => {
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
    },
  );
};

/* ── demotion / promotion exception (origin lines 2280–2485) ──────────── */

const getDemotionTargetClass = (studentClass: string): string =>
  DEMOTION_CLASS_MAP[String(studentClass || '').toUpperCase()] || '';

const ensureDemotionStudentsLoaded = async (): Promise<Student[]> => {
  if (masterStudentList.value.length > 0) return masterStudentList.value;
  return getStudentsFromLambda({ returnOnly: true, silent: true, classFilter: 'ALL' });
};

const populateDemotionClassList = async (): Promise<void> => {
  const classFilter = demoteClassFilter.value;
  if (classFilter === '#') {
    demotionClassRows.value = [];
    demotionEmptyLabel.value = 'Select a class to load students.';
    return;
  }
  const students = await ensureDemotionStudentsLoaded();
  const classStudents = students
    .filter((student) => String(student.Class || '').toUpperCase() === classFilter)
    .sort((a, b) => String(a.FullName || '').localeCompare(String(b.FullName || '')));
  if (classStudents.length === 0) {
    demotionClassRows.value = [];
    demotionEmptyLabel.value = `No students found in ${classFilter}.`;
    return;
  }
  demotionClassRows.value = classStudents;
  demotionSelection.value = [];
};

const toggleDemotionClassSelection = (checked: boolean): void => {
  demotionSelection.value = checked
    ? demotionClassRows.value
        .filter((student) => getDemotionTargetClass(String(student.Class || '')))
        .map((student) => String(student.RegNo))
    : [];
};

const findStudentForDemotion = async (): Promise<void> => {
  const regNo = demoteSearchId.value.trim().toUpperCase();
  if (!regNo) {
    winAlert('Required', 'Please enter a Registration Number.');
    return;
  }
  loadingVisible.value = true;
  try {
    const data = await callApi('GET_STUDENTS', { schoolID: LOGGED_IN_SCHOOL_ID });
    const student = (data.students as unknown as Student[]).find((s) => s.RegNo === regNo);
    if (!student) {
      winAlert('Not Found', 'Student not found in your college directory.');
      demotionPreviewVisible.value = false;
    } else {
      demotionTarget.value = student;
      demotionTargetClassLabel.value = getDemotionTargetClass(String(student.Class || '')) || 'Not eligible for demotion';
      demotionPreviewVisible.value = true;
    }
  } catch {
    winAlert('Error', 'Could not connect to database.');
  }
  loadingVisible.value = false;
};

const executeIndividualDemotion = (): void => {
  const target = demotionTarget.value;
  if (!target) return;
  winAlert('CONFIRM ACTION', `Are you sure you want to demote ${target.FullName}?`, 'confirm', () => {
    void (async () => {
      loadingVisible.value = true;
      try {
        const data = await callApi('EXECUTE_PROMOTION', {
          state: 'off',
          specificStudents: [target.RegNo],
          schoolID: LOGGED_IN_SCHOOL_ID,
        });
        if (data.status === 'success') {
          winAlert('Success', 'Student successfully demoted to previous class.');
          cancelDemotion();
          await loadSchoolStats();
          await loadDemotionLog();
          await populateDemotionClassList();
        } else {
          throw new Error(data.message || 'Cloud update failed.');
        }
      } catch (e) {
        winAlert('Error', msgOf(e));
      }
      loadingVisible.value = false;
    })();
  });
};

const executeSelectedDemotions = (): void => {
  const selectedRegNos = demotionSelection.value;
  if (selectedRegNos.length === 0) {
    winAlert('Required', 'Select at least one student to demote.');
    return;
  }
  winAlert(
    'CONFIRM BATCH DEMOTION',
    `Demote ${selectedRegNos.length} selected student(s) to their previous class?`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('EXECUTE_PROMOTION', {
            state: 'off',
            specificStudents: selectedRegNos,
            schoolID: LOGGED_IN_SCHOOL_ID,
          });
          if (data.status !== 'success') throw new Error(data.message || 'Cloud update failed.');
          winAlert(
            'Success',
            `${(data as unknown as { count?: number }).count || selectedRegNos.length} student(s) successfully demoted.`,
          );
          await loadSchoolStats();
          await loadDemotionLog();
          await populateDemotionClassList();
        } catch (e) {
          winAlert('Error', msgOf(e) || 'Could not complete batch demotion.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

const cancelDemotion = (): void => {
  demotionPreviewVisible.value = false;
  demoteSearchId.value = '';
  demotionTarget.value = null;
};

const loadDemotionLog = async (): Promise<void> => {
  try {
    const data = await callApi('GET_DEMOTION_LOGS', { schoolID: LOGGED_IN_SCHOOL_ID });
    if (data.status !== 'success') throw new Error('log read failed');
    const logs = (data.logs || []) as DemotionLog[];
    demotionCounts.value = data.counts || {};
    if (logs.length === 0) {
      demotionLogs.value = [];
      demotionLogEmptyLabel.value = 'No demotion history found for this college.';
      return;
    }
    demotionLogs.value = logs;
    demotionLogEmptyLabel.value = 'No demotion history loaded yet.';
  } catch {
    demotionLogs.value = [];
    demotionLogEmptyLabel.value = 'Could not load demotion register.';
  }
};

/* ── exam centre (origin lines 2487–2969, 3158–3307) ──────────────────── */

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
  const type = globalExamType.value;
  const h = parseInt(String(timerH.value), 10) || 0;
  const m = parseInt(String(timerM.value), 10) || 0;
  const s = parseInt(String(timerS.value), 10) || 0;
  const totalMinutes = h * 60 + m + s / 60;
  const selectedPapers = examSession()?.getSelectedPapers('exam-session-root') ?? [];
  const liveWindow = examSession()?.getWindowPayload('exam-session-root') ?? { startTime: '', endTime: '' };

  if (type === '#') {
    winAlert('Validation Error', 'Select the active category first.');
    return;
  }
  if ((liveWindow.startTime && !liveWindow.endTime) || (!liveWindow.startTime && liveWindow.endTime)) {
    winAlert('Validation Error', 'Set both live window values or leave both blank.');
    return;
  }
  if (
    liveWindow.startTime &&
    liveWindow.endTime &&
    new Date(liveWindow.endTime) <= new Date(liveWindow.startTime)
  ) {
    winAlert('Validation Error', 'Live end time must be later than live start time.');
    return;
  }
  void (async () => {
    loadingVisible.value = true;
    try {
      const data = await callApi('UPDATE_EXAM_SETTINGS', {
        schoolID: LOGGED_IN_SCHOOL_ID,
        type: type as ExamCategory,
        duration: totalMinutes,
        activePapers: selectedPapers,
        livePapers: selectedPapers,
        startTime: liveWindow.startTime || '',
        endTime: liveWindow.endTime || '',
      });
      if (data.status === 'success') {
        winAlert(
          'Success',
          `Internal session settings updated. ${selectedPapers.length} paper slot(s) prepared for live access.`,
        );
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
  const hVal = timerH.value;
  const mVal = timerM.value;
  const sVal = timerS.value;
  const assessmentInstruction = blastInstruction.value.trim();
  const shuffleQuestions = blastShuffle.value;

  if (sessionType === '#') {
    winAlert('Validation Error', 'Select a Target Category.');
    return;
  }
  if (!blastH.value && !blastM.value && !blastS.value) {
    winAlert('Validation Error', 'Set the Exam Duration.');
    return;
  }
  if (!fileInput?.files?.[0]) {
    winAlert('File Missing', 'Select your Excel file.');
    return;
  }

  const bh = parseInt(String(hVal), 10) || 0;
  const bm = parseInt(String(mVal), 10) || 0;
  const bs = parseInt(String(sVal), 10) || 0;
  const totalMinutes = bh * 60 + bm + bs / 60;
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
      const synchronizedQuestions = normalizedQuestions.map((q) => ({
        ...q,
        Term: ACTIVE_SYNC_TERM,
        ShuffleQuestions: shuffleQuestions,
      }));
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
        assessmentInstruction,
        shuffleQuestions,
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

/* ── question archive (origin lines 3225–3278) ────────────────────────── */

const loadPastQuestions = async (): Promise<void> => {
  const mode = pqMode.value;
  const subject = pqSubject.value;
  const term = pqTerm.value;
  const type = pqType.value;
  const rawYear = pqYear.value;
  const studentClass = pqClass.value;

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
    pastQuestionRows.value = questions;
    const modeLabel = mode === 'MODE_A' ? 'Joint' : 'Internal';
    if (data.status === 'success' && questions.length > 0) {
      archiveEmptyLabel.value = 'No questions found for the selected archive filter.';
      archiveSummary.value = `Loaded ${questions.length} question(s) for ${LAEC.humanizeSubject(subject)} in ${LAEC.normalizeClassValue(studentClass)} under ${modeLabel} mode.`;
    } else {
      archiveEmptyLabel.value = 'No questions found for the selected archive filter.';
      archiveSummary.value = `No archived questions matched ${LAEC.humanizeSubject(subject)} for ${LAEC.normalizeClassValue(studentClass)} in ${modeLabel} mode.`;
    }
  } catch {
    pastQuestionRows.value = [];
    archiveEmptyLabel.value = 'Archive lookup failed.';
    archiveSummary.value = 'Archive lookup failed. Please retry after checking your cloud connection.';
    winAlert('Archive Error', 'Unable to retrieve question archive right now.');
  }
  loadingVisible.value = false;
};

/* ── internal admins (origin lines 3502–3649) ─────────────────────────── */

const canRevokeInternalAdmin = (admin: AdminAccount): boolean =>
  Boolean(
    loggedInAdminUsername() &&
      admin &&
      admin.Username !== loggedInAdminUsername() &&
      admin.SchoolID === LOGGED_IN_SCHOOL_ID &&
      (admin as unknown as { CreatedByUsername?: string }).CreatedByUsername ===
        loggedInAdminUsername() &&
      ['SCHOOL_ADMIN', 'ICT_ADMIN', 'EXAM_COMMITTEE'].includes(admin.Role as string),
  );

const loadICTAdmins = async (): Promise<void> => {
  try {
    const data = await callApi('GET_COGNITO_ADMINS', {
      schoolID: LOGGED_IN_SCHOOL_ID,
      roles: 'ICT_ADMIN,SCHOOL_ADMIN,EXAM_COMMITTEE',
    });
    if (data.status === 'success' && Array.isArray(data.admins) && data.admins.length > 0) {
      ictAdmins.value = data.admins as unknown as AdminAccount[];
      ictEmptyLabel.value = 'No school-linked administrators were found in Cognito for this college.';
    } else {
      ictAdmins.value = [];
      ictEmptyLabel.value = 'No school-linked administrators were found in Cognito for this college.';
    }
  } catch {
    ictAdmins.value = [];
    ictEmptyLabel.value = 'Failed to sync ICT directory.';
  }
};

const grantICTAccess = async (): Promise<void> => {
  const name = ictName.value.trim();
  const username = ictUsername.value.trim();
  const email = ictEmail.value.trim();
  const targetRole = ictRole.value;
  const password = ictPass.value.trim();

  if (!name || !username || !email || !targetRole || !password) {
    winAlert('Required', 'Please fill all fields.');
    return;
  }
  if (!/^[A-Za-z0-9._@-]+$/.test(username)) {
    winAlert(
      'Invalid Username',
      'Admin username cannot contain spaces or apostrophes. Use only letters, numbers, @, underscore, hyphen, or dot.',
    );
    return;
  }

  loadingVisible.value = true;
  try {
    const data = await callApi('CREATE_ADMIN_ACCESS', {
      schoolID: LOGGED_IN_SCHOOL_ID,
      fullName: name,
      username,
      email,
      password,
      targetRole: targetRole as AdminRole,
      creatorUsername: loggedInAdminUsername(),
      creatorRole: loggedInAdminRole(),
      creatorSchoolID: LOGGED_IN_SCHOOL_ID,
    });
    if (data.status === 'success') {
      const extra = data as unknown as { emailStatus?: string; status?: string };
      const title =
        extra.emailStatus === 'failed' || extra.status === 'warning' ? 'Email Warning' : 'Access Granted';
      winAlert(
        title,
        data.message || 'Internal admin account created successfully. Temporary login details have been emailed automatically.',
      );
      ictName.value = '';
      ictUsername.value = '';
      ictEmail.value = '';
      ictPass.value = '';
      void loadICTAdmins();
    } else {
      throw new Error(data.message || 'Could not create ICT account.');
    }
  } catch (e) {
    winAlert('Error', msgOf(e) || 'Could not create ICT account. Check cloud connection.');
  }
  loadingVisible.value = false;
};

const revokeICTAccess = (username: string, email = ''): void => {
  winAlert(
    'REVOKE ACCESS',
    `Are you sure you want to permanently delete the admin account for ${username}?`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('DELETE_ADMIN_ACCESS', {
            username,
            email,
            schoolID: LOGGED_IN_SCHOOL_ID,
            requestorUsername: loggedInAdminUsername(),
            requestorRole: loggedInAdminRole(),
            requestorSchoolID: LOGGED_IN_SCHOOL_ID,
          });
          if (data.status !== 'success') throw new Error(data.message || 'Action failed.');
          winAlert('Success', data.message || 'Access revoked.');
          void loadICTAdmins();
        } catch (e) {
          winAlert('Error', msgOf(e) || 'Action failed.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/* ── system health (origin lines 3315–3458) ───────────────────────────── */

/**
 * The origin pings its own students endpoint and reports the round trip
 * (`ca.html` line 3315). This build has no backend to ping, so the same public
 * asset request /admin/ uses stands in: an `Image` load keeps the measurement
 * out of CORS (the origin's `fetch(..., { mode: 'cors' })` would log a blocked
 * request here), and the origin's own 500 ms threshold is kept — note /admin/
 * thresholds at 400 ms. Deviation DEV-8.
 */
/* Thresholds the health panel and the latency card share, so the status line and
   the card's colour cannot disagree. `bad` is new: the origin had good/else, so
   510ms and 4s were both "LATENCY DETECTED" in the same amber. */
const PING_GOOD_MS = 500;
const PING_BAD_MS = 1500;

const checkHealth = (): void => {
  const start = Date.now();
  const img = new Image();
  img.onload = img.onerror = () => {
    const ms = Date.now() - start;
    pingMs.value = `${ms} ms`;
    pingLarge.value = `${ms} ms`;
    if (ms < PING_GOOD_MS) {
      pingStatus.value = 'STABLE CONNECTION';
      pingStatusColor.value = 'var(--success)';
      pingTone.value = 'good';
    } else if (ms < PING_BAD_MS) {
      pingStatus.value = 'LATENCY DETECTED';
      pingStatusColor.value = 'var(--warning)';
      pingTone.value = 'warn';
    } else {
      pingStatus.value = 'SEVERE LATENCY';
      pingStatusColor.value = 'var(--danger)';
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
      .filter(
        (result) => subjectFilter === 'ALL' || String(result.Subject || '').toUpperCase() === subjectFilter,
      )
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
            if (data.status !== 'success') {
              throw new Error(data.message || 'Could not delete flagged results.');
            }
            winAlert('Success', data.message || 'Flagged results deleted.');
            await refreshInvigilatorFeed();
            void loadSchoolResults();
          } catch (e) {
            winAlert('Delete Error', msgOf(e) || 'Could not delete flagged results.');
          }
          loadingVisible.value = false;
        })();
      },
    );
  })();
};

/* ── charts (origin lines 1980–2080) ──────────────────────────────────── */

let subjectPerformanceChart: Chart | null = null;
let classPopulationChart: Chart | null = null;

/** `const DashboardAnalytics = window.LAECDashboardAnalytics;` (ca.html 1686). */
const DashboardAnalytics = (
  window as unknown as {
    LAECDashboardAnalytics?: {
      buildClassPopulationMetrics: (
        list: unknown[],
        config: unknown,
      ) => Array<{ label: string; count: number }>;
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

  /* A zero roster is a genuinely empty chart. Drawn anyway, it produced six
     zero-height bars against Chart.js's default 0-to-1 axis — a labelled scale
     for a population of nothing, indistinguishable from a small cohort. */
  classPopulationEmpty.value = total === 0;
  if (classPopulationEmpty.value) {
    classPopulationNote.value =
      'No students are registered for this college, so there is no class distribution to show.';
    return;
  }

  const maxCount = Math.max(...metrics.map((metric) => metric.count));
  /* Integer-only Y scale: `precision: 0` alone still let Chart.js choose a 0.5
     step, putting half-students on a head count. */
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
          borderColor: '#ffffff',
          borderWidth: 2,
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

/* ── dashboard (origin lines 3460–3492) ───────────────────────────────── */

const loadSchoolStats = async (): Promise<void> => {
  loadingVisible.value = true;
  try {
    const configData = await loadGlobalStats();
    const selectedYear =
      (pieYearFilter.value ? `${pieYearFilter.value.split('#')[1]}/${Number(pieYearFilter.value.split('#')[1]) + 1}` : '') ||
      ACTIVE_SYNC_YEAR;
    ACTIVE_OVERVIEW_YEAR = selectedYear;

    const [students, results] = await Promise.all([
      getStudentsFromLambda({ returnOnly: true, silent: true, classFilter: 'ALL' }),
      fetchSchoolResults(selectedYear),
    ]);

    masterResultList.value = results;
    const classFilter = dirClassFilter.value;
    const filteredStudents =
      classFilter === 'ALL' ? students : students.filter((student) => student.Class === classFilter);

    renderTable(filteredStudents);
    renderClassPopulationChart(students);
    renderSubjectPerformanceChart();
    populateDataLists(students);

    if (configData && configData.academicYear) {
      syncAcademicYear(String(configData.academicYear));
    }
  } catch (e) {
    console.error('Overview sync failed.', e);
    renderClassPopulationChart([]);
    renderSubjectPerformanceChart();
  }
  loadingVisible.value = false;
};

/* ── mount ────────────────────────────────────────────────────────────── */

/*
 * RF-5: this console inherits the shared five-minute idle timeout, reset on
 * mousemove, keypress, click and scroll. `useIdleTimeout` registers lifecycle
 * hooks, so it runs during setup rather than inside the async onMounted below.
 */
useIdleTimeout({ mode: 'admin' });

onMounted(async () => {
  // The origin's `window.onload` (ca.html line 3652) redirects to /control/ when
  // no administrator session is present. There is no role check (D-11 / D6).
  if (!localStorage.getItem(STORAGE_KEYS.LAEC_Session)) {
    window.location.href = '/control/';
    return;
  }

  /* The operator's name, not "SCHOOL ADMIN: <name>". The prefix restated the
     role badge already sitting beside it, and at the pill's width it meant the
     name was the part that got ellipsised ("SCHOOL ADMIN: MOCK SCHOO…"). The
     role is carried by `.topbar-role` and the breadcrumb. */
  const adminName = localStorage.getItem(STORAGE_KEYS.AdminName);
  schoolIdentity.value = adminName || SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || 'Unknown College';
  copyrightYear.value = String(new Date().getFullYear());

  await nextTick();
  syncHeaderOffset();
  toggleBackToTopButton();
  window.addEventListener('resize', syncHeaderOffset);
  window.addEventListener('scroll', toggleBackToTopButton, { passive: true });

  restoreCachedModeUI();
  restoreActiveTab();

  // The first-party modules reach for these page globals, exactly as the
  // origin's top-level function declarations provided them. They are fulfilled
  // through the entry's dispatcher so `admin-sidebar.js` keeps the
  // `window.toggleNav` wrapper it installed before this bundle ran.
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

  // `LAECExamSession` — the paper queue in #exam-session-root, driven by the
  // mock through the `fetchImpl` seam in config.js (D-39).
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

  /*
   * The origin serves `/dashboard-registration.js?v=20260608-photo-upload` as a
   * classic <script> in <head>, so the library already exists when the page's
   * inline script calls `LAECRegistration.init` at the end of the body. Here the
   * template only exists after mount, so the library is fetched first and then
   * initialised — the query string the origin serves is kept so the asset
   * resolves identically.
   */
  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = '/dashboard-registration.js?v=20260608-photo-upload';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  // `LAECRegistration` — the admissions portal in #register-portal-root. Its one
  // network call is a direct `fetch(registerEndpoint)`, which has no seam, so
  // the endpoint points at a non-routable mock host: the whole portal renders
  // and submits, and the origin's own error path handles the response
  // (deviation DEV-9).
  (window as unknown as {
    LAECRegistration?: { init: (config: Record<string, unknown>) => void };
  }).LAECRegistration?.init({
    rootId: 'register-portal-root',
    schoolId: LOGGED_IN_SCHOOL_ID,
    schoolName: SCHOOL_NAMES[LOGGED_IN_SCHOOL_ID] || 'Unknown College',
    title: 'Student Registration Portal',
    subtitle:
      'Complete admissions onboarding directly from this school dashboard. The assigned school is now locked to the active administrator session for safer registration records.',
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

  // The origin's sidebar enhancement runs against a parsed document; here the
  // DOM only exists after mount, so the module is loaded now (single run).
  const sidebarScript = document.createElement('script');
  sidebarScript.src = '/admin-sidebar.js';
  document.head.appendChild(sidebarScript);

  void loadSchoolStats();
  void loadICTAdmins();
  void loadDemotionLog();
  checkHealth();
  setInterval(checkHealth, 10000);
});

/* The origin rebuilds these selects whenever the config changes. */
watch([resYear, resTerm, resCategory, resMode], () => {
  /* the v-model writes already keep the filters in step with the markup */
});
</script>
