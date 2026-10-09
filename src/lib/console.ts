/**
 * Shared helpers for the four admin consoles (`/admin/`, `/ca/`, `/ict/`,
 * `/comm/`).
 *
 * The origin's four console pages ship near-identical inline scripts, so these
 * are the functions they all declare. They live here rather than being copied
 * into each view; every function is the origin's own code, transcribed.
 *
 * Two things are deliberately NOT here:
 * - anything that touches a Vue `ref` (the views own their state), and
 * - the async API calls, which go through `src/api` (D-05).
 */
import * as XLSX from 'xlsx';
import { ApiHttpError, callApi } from '../api';
import type { ExamCategory, ExamTerm, LaecUtils, ResultRecord, Student } from '../types';

/** `window.LAEC_UTILS`, served first-party as `/config.js` (D-03). */
export const LAEC = window.LAEC_UTILS as LaecUtils;

/* ── school map (PRD D23 — hardcoded on the origin) ─────────────────────── */

export const SCHOOL_ORDER = [
  'SFC',
  'SGC',
  'HCC',
  'MCSS',
  'STAC',
  'OLASS',
  'MEC',
  'SKC',
  'MGC',
  'SHC',
] as const;

/** Hardcoded school-name map, as served (see D23). */
export const SCHOOL_NAMES: Record<string, string> = {
  SFC: "St. Finbarr's College",
  SGC: 'St. Gregory College',
  HCC: 'Holy Child College',
  MCSS: 'Maryland Comprehensive',
  STAC: 'St. Thomas Aquinas College',
  OLASS: 'Our Lady of Apostles',
  MEC: 'Mater Ecclesia College',
  SKC: "St. Kizito's College",
  MGC: 'Marywood Girls College',
  SHC: 'Sacred Heart College',
};

export const ACADEMIC_YEARS = [
  2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034,
] as const;

/** The origin's `msg()` — reads `.message` off a thrown value. */
export const msgOf = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e ?? '');

/* ── academic session helpers ──────────────────────────────────────────── */

export const formatTermLabel = (term: string): string =>
  term ? term.replace('TERM', 'Term ') : 'current term';

export const sessionFilterToAcademicYear = (value: string, fallback = ''): string => {
  if (!value) return fallback;
  if (value.startsWith('YEAR#')) {
    const startYear = parseInt(value.split('#')[1], 10);
    if (Number.isFinite(startYear)) return `${startYear}/${startYear + 1}`;
  }
  return value;
};

export const academicYearToSessionFilter = (year: string): string => {
  const startYear = parseInt(String(year || '').split('/')[0], 10);
  return Number.isFinite(startYear) ? `YEAR#${startYear}` : '';
};

export const getAcademicYearStart = (value: string): number => {
  if (!value) return NaN;
  if (String(value).startsWith('YEAR#')) return parseInt(String(value).split('#')[1], 10);
  return parseInt(String(value).split('/')[0], 10);
};

/* ── students and arms ─────────────────────────────────────────────────── */

export const getStudentArmValue = (student?: Student | null): string =>
  String(student?.Arm ?? '').toUpperCase();

/**
 * A–Z arm options for `#res-arm` and `#script-arm`. `includeAll` reproduces the
 * origin's two call shapes (ca.html line 2551): the school consoles' filter
 * offers "All Arms" plus a bare "Arm" placeholder, the super-admin filter always
 * leads with "All Arms".
 */
export const getArmOptionsMarkup = (selected = '', includeAll = true): string => {
  const current = String(selected || (includeAll ? 'ALL' : '')).toUpperCase();
  const options = includeAll
    ? [`<option value="ALL"${current === 'ALL' ? ' selected' : ''}>All Arms</option>`]
    : ['<option value="">Arm</option>'];
  for (let code = 65; code <= 90; code += 1) {
    const arm = String.fromCharCode(code);
    options.push(`<option value="${arm}"${current === arm ? ' selected' : ''}>${arm}</option>`);
  }
  return options.join('');
};

/** The origin's `new Date(s.CreatedAt || Date.now()).toLocaleDateString()`. */
export const studentDate = (s: Student): string =>
  new Date((s as unknown as { CreatedAt?: string }).CreatedAt || Date.now()).toLocaleDateString();

/* ── filters and export filenames (origin lines 1773–1835, 2866–2900, 3005) ── */

export const slugifyExportToken = (value: unknown, fallback = 'ALL'): string => {
  const normalized = String(value || '')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  return normalized || fallback;
};

export const getSelectedText = (id: string, fallback = 'ALL'): string => {
  const element = document.getElementById(id) as HTMLSelectElement | HTMLInputElement | null;
  if (!element) return fallback;
  if (!(element as HTMLSelectElement).options) {
    const typedValue = element.value || fallback;
    const option = Array.from(
      document.querySelectorAll<HTMLOptionElement>(`#${id}-options option`),
    ).find((item) => item.value === typedValue || item.textContent === typedValue);
    return option ? option.textContent || option.value : typedValue;
  }
  const select = element as HTMLSelectElement;
  return select.options[select.selectedIndex]?.text || select.value || fallback;
};

/**
 * `normalizeResultSubjectInput` / `normalizeInvigilatorSubjectInput` — both
 * read the filter input and map a typed label back to its stored value, and
 * both resolve against the shared `#res-subject-options` datalist.
 */
export const normalizeSubjectInput = (raw: string): string => {
  const rawValue = String(raw || 'ALL').trim();
  if (!rawValue || rawValue.toUpperCase() === 'ALL' || rawValue.toUpperCase() === 'ALL SUBJECTS') {
    return 'ALL';
  }
  const option = Array.from(
    document.querySelectorAll<HTMLOptionElement>('#res-subject-options option'),
  ).find(
    (item) =>
      item.value.toUpperCase() === rawValue.toUpperCase() ||
      item.textContent?.toUpperCase() === rawValue.toUpperCase(),
  );
  if (option) return option.value.toUpperCase();
  return typeof LAEC?.normalizeSubjectValue === 'function'
    ? LAEC.normalizeSubjectValue(rawValue)
    : rawValue.toUpperCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
};

/**
 * `buildExportFilename` — `resultsTable` and `pqTable` derive their workbook
 * name from the visible filters; every other table uses the caller's fallback.
 */
export const buildExportFilename = (
  tableID: string,
  fallbackName: string,
  subjectFilterOverride = '',
): string => {
  if (tableID === 'resultsTable') {
    const typed = subjectFilterOverride || (document.getElementById('res-subject') as HTMLInputElement | null)?.value || '';
    const subjectToken =
      normalizeSubjectInput(typed) === 'ALL'
        ? 'All_Subjects'
        : slugifyExportToken(getSelectedText('res-subject'));
    const classValue = (document.getElementById('res-class') as HTMLSelectElement | null)?.value;
    const classToken = classValue === 'ALL' ? 'All_Classes' : slugifyExportToken(classValue);
    const armValue = (document.getElementById('res-arm') as HTMLSelectElement | null)?.value || 'ALL';
    const armToken = armValue === 'ALL' ? 'All_Arms' : slugifyExportToken(armValue);
    const schoolValue = (document.getElementById('res-school') as HTMLSelectElement | null)?.value;
    const schoolToken = schoolValue === 'ALL' ? 'All_Schools' : slugifyExportToken(schoolValue);
    return `${subjectToken}_Result_${classToken}_${armToken}_${schoolToken}`;
  }
  // The school consoles name the archive table `archiveTable` (ca.html 2631);
  // the super-admin page calls the same widget `pqTable` (admin.html).
  if (tableID === 'pqTable' || tableID === 'archiveTable') {
    const subjectToken = slugifyExportToken(getSelectedText('pq-subject'), 'Questions');
    const classToken = slugifyExportToken(getSelectedText('pq-class'), 'All_Classes');
    const typeToken = slugifyExportToken(getSelectedText('pq-type'), 'All_Types');
    return `${subjectToken}_Questions_${classToken}_${typeToken}`;
  }
  return fallbackName;
};

/** SheetJS export, as the origin performs it (admin.html line 3005). */
export const exportToExcel = (tableID: string, fallbackName: string): void => {
  const table = document.getElementById(tableID) as HTMLTableElement | null;
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Export' });
  XLSX.writeFile(wb, `${buildExportFilename(tableID, fallbackName)}.xlsx`);
};

/* ── result-row formatting (origin lines 1742–1835, 1882–1959) ─────────── */

export const getResultClassValue = (result: ResultRecord): string =>
  String(result.StudentClass || result.Class || '').toUpperCase();

export const parseResultScriptForScore = (result: ResultRecord): Record<string, unknown>[] => {
  if (Array.isArray(result.AnswerScript)) return result.AnswerScript as Record<string, unknown>[];
  if (Array.isArray(result.answerScript)) return result.answerScript as Record<string, unknown>[];
  if (Array.isArray(result.Script)) return result.Script as Record<string, unknown>[];
  if (typeof result.AnswerScript === 'string' && result.AnswerScript.trim()) {
    try {
      const parsed: unknown = JSON.parse(result.AnswerScript);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const getResultPercentage = (result: ResultRecord): number => {
  const explicit = Number(result.Percentage);
  if (Number.isFinite(explicit)) return explicit;
  const score = Number(result.Score);
  const total = Number(result.Total);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) {
    return Math.round((score / total) * 100);
  }
  return 0;
};

export const getCorrectQuestionCount = (
  result: ResultRecord,
  script: Record<string, unknown>[],
  totalUploaded: number,
  percentage: number,
): number => {
  if (script.length > 0) return script.filter((item) => item.IsCorrect).length;
  const score = Number(result.Score);
  if (Number.isFinite(score)) return score;
  if (Number.isFinite(percentage) && totalUploaded > 0) {
    return Math.round((percentage / 100) * totalUploaded);
  }
  return NaN;
};

export const getAttemptedQuestionCount = (
  _result: ResultRecord,
  script: Record<string, unknown>[],
  fallbackTotal: number,
): number => {
  if (script.length > 0) {
    return script.filter((item) => {
      if (String(item.QuestionType || '').toUpperCase() === 'THEORY') return false;
      const answer = String(item.StudentAnswer ?? '').trim();
      return answer !== '' && answer.toUpperCase() !== 'BLANK';
    }).length;
  }
  return Number.isFinite(fallbackTotal) ? fallbackTotal : 0;
};

/** `correct / attempted / uploaded (percentage%)`, as the origin formats it. */
export const formatResultScore = (result: ResultRecord): string => {
  const total = Number(result.Total);
  const percentage = getResultPercentage(result);
  const script = parseResultScriptForScore(result);
  const totalUploaded = Number.isFinite(total) && total > 0 ? total : script.length;
  const attempted = getAttemptedQuestionCount(result, script, totalUploaded);
  const correct = getCorrectQuestionCount(result, script, totalUploaded, percentage);

  if (
    Number.isFinite(correct) &&
    Number.isFinite(attempted) &&
    Number.isFinite(totalUploaded) &&
    totalUploaded > 0
  ) {
    return `${correct} / ${attempted} / ${totalUploaded} (${percentage}%)`;
  }
  return Number.isFinite(percentage) ? `${percentage}%` : String(result.Score || 'N/A');
};

export const formatResultStatus = (result: ResultRecord): string => {
  const status = String(result.Status || '').toUpperCase();
  if (status === 'FLAGGED') {
    return '<span style="color:var(--warning); font-weight:bold">FLAGGED</span>';
  }
  const percentage = getResultPercentage(result);
  const isPass = percentage >= 50;
  return `<span style="color:${isPass ? 'green' : 'red'}">${isPass ? 'PASS' : 'FAIL'}</span>`;
};

/** The result filter predicates, shared by the load and the keyup handler. */
export const resultMatchesFilters = (
  result: ResultRecord,
  opts: { query: string; classFilter: string; armFilter: string; armOf: (r: ResultRecord) => string },
): boolean => {
  const regNo = String(result.RegNo || '').toLowerCase();
  const name = String(result.FullName || '').toLowerCase();
  const matchesQuery = !opts.query || regNo.includes(opts.query) || name.includes(opts.query);
  const matchesClass =
    opts.classFilter === 'ALL' || getResultClassValue(result) === opts.classFilter;
  const matchesArm = opts.armFilter === 'ALL' || opts.armOf(result) === opts.armFilter;
  return matchesQuery && matchesClass && matchesArm;
};

/* ── invigilation monitor (origin lines 2901–2987) ─────────────────────── */

export const INVIGILATOR_CATEGORIES: ExamCategory[] = ['CA1', 'CA2', 'EXAM'];

export const dedupeInvigilatorResults = (results: ResultRecord[]): ResultRecord[] => {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = [item.PK, item.SK, item.RegNo, item.Subject, item.Timestamp]
      .filter(Boolean)
      .join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const isTimeExpiryViolation = (value: unknown): boolean => {
  const text = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return text === 'TIME EXPIRED' || text === 'EXPIRED TIME';
};

/* ── the mock transport the first-party libraries ride on ──────────────── */

/**
 * The origin points the first-party libraries at the live AWS endpoints
 * (`AWS_CONFIG.getStudentsEndpoint` / `registerEndpoint`). This audit build must
 * not call the real backend (D-04), and both `config.js` helpers the libraries
 * use — `fetchQuestionInventory` and `fetchQuestionSet` — accept a `fetchImpl`,
 * so the same code paths run against the typed mock instead.
 */
export const createMockGetFetch = (): ((url: string) => Promise<Response>) => {
  return async (url: string): Promise<Response> => {
    const query = new URL(url).searchParams;
    const action = query.get('action') || 'GET_SECURE_QUESTIONS';
    const wrap = (data: unknown, ok: boolean): Response =>
      new Response(JSON.stringify(data), {
        status: ok ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    try {
      if (action === 'GET_QUESTION_INVENTORY') {
        return wrap(
          await callApi('GET_QUESTION_INVENTORY', {
            schoolID: query.get('schoolID') ?? '',
            year: query.get('year') ?? '',
            term: (query.get('term') || 'TERM1') as ExamTerm,
            type: (query.get('type') || 'EXAM') as ExamCategory,
            mode: (query.get('mode') || 'MODE_B') as 'MODE_A',
          }),
          true,
        );
      }
      if (action === 'GET_RESULTS') {
        return wrap(
          await callApi('GET_RESULTS', {
            schoolID: query.get('schoolID') ?? '',
            targetSchool: query.get('targetSchool') ?? undefined,
            category: (query.get('category') || 'EXAM') as ExamCategory,
            mode: (query.get('mode') || 'MODE_A') as 'MODE_A',
            year: query.get('year') ?? '',
            term: (query.get('term') || 'TERM1') as ExamTerm,
            subject: query.get('subject') ?? undefined,
            regNo: query.get('regNo') ?? undefined,
            class: query.get('class') ?? undefined,
            noCache: query.get('noCache') !== null,
          }),
          true,
        );
      }
      return wrap(
        await callApi('GET_SECURE_QUESTIONS', {
          schoolID: query.get('schoolID') ?? '',
          subject: query.get('subject') ?? '',
          class: query.get('class') ?? '',
          year: query.get('year') ?? '',
          term: (query.get('term') || 'TERM1') as ExamTerm,
          type: (query.get('type') || 'EXAM') as ExamCategory,
          mode: (query.get('mode') || 'MODE_A') as 'MODE_A',
          pastOnly: query.get('pastOnly') !== null,
          regNo: query.get('regNo') ?? undefined,
          noCache: query.get('noCache') !== null,
        }),
        true,
      );
    } catch (e) {
      const status = e instanceof ApiHttpError ? e.status : 500;
      return new Response(JSON.stringify({ status: 'error', message: msgOf(e) }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
};

/**
 * A `window.LAEC_UTILS` stand-in for the first-party libraries: the origin's
 * own helper set, with the two network helpers re-pointed at the mock. Passing
 * this to `LAECExamSession.init` / `LAECRegistration.init` keeps the libraries'
 * own logic (retry layer, subject normalisation, rendering) byte-authentic while
 * no request leaves the browser (D-28, DEV-5).
 */
export const buildLibraryUtils = (): LaecUtils => {
  const fetchImpl = createMockGetFetch();
  return {
    ...LAEC,
    fetchQuestionSet: (options) => LAEC.fetchQuestionSet({ ...options, fetchImpl }),
    fetchQuestionInventory: (options) =>
      LAEC.fetchQuestionInventory({ ...options, fetchImpl }),
  } as LaecUtils;
};

/* ── the question-manager fetch bridge ────────────────────────────────── */

/**
 * `/question-management.js` is the one first-party library with no seam: it
 * calls `fetch(AWS_CONFIG.getStudentsEndpoint + "?action=GET_SECURE_QUESTIONS")`
 * for the paper read and posts `UPDATE_QUESTION` / `ADD_QUESTION` /
 * `DELETE_QUESTION` / `DELETE_QUESTION_PAPER` to the register endpoint itself,
 * all with hard-coded endpoints from `/config.js`.
 *
 * `config.js` is served first-party and points at the live API, so this build
 * would otherwise reach the real backend the moment an administrator pressed
 * VIEW UPLOADED QUESTIONS. The bridge intercepts exactly those five actions by
 * name - nothing else, on any host - and answers them from the typed mock.
 * Every other request, from this page or any library on it, is passed through
 * to the original `fetch` untouched (D-46).
 *
 * Returns a function that removes the bridge again.
 */
export const installLibraryFetchBridge = (): (() => void) => {
  const originalFetch = window.fetch.bind(window);
  const methodOf = (init?: RequestInit): string => (init?.method ?? 'GET').toUpperCase();
  const BRIDGED_ACTIONS = new Set([
    'UPDATE_QUESTION',
    'ADD_QUESTION',
    'DELETE_QUESTION',
    'DELETE_QUESTION_PAPER',
  ]);

  const toResponse = (payload: unknown): Response =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // GET ...?action=GET_SECURE_QUESTIONS — the paper read.
    if (methodOf(init) === 'GET' && /[?&]action=GET_SECURE_QUESTIONS/.test(url)) {
      const query = new URL(url, window.location.origin).searchParams;
      try {
        return toResponse(
          await callApi('GET_SECURE_QUESTIONS', {
            schoolID: query.get('schoolID') ?? '',
            subject: query.get('subject') ?? '',
            class: query.get('class') ?? '',
            year: query.get('year') ?? '',
            term: (query.get('term') || 'TERM1') as ExamTerm,
            type: (query.get('type') || 'EXAM') as ExamCategory,
            mode: (query.get('mode') || 'MODE_A') as 'MODE_A',
            // `noCache` and the library's `editorMode` are request modifiers
            // with no field in the typed contract; only noCache is modelled.
            noCache: query.get('noCache') !== null,
          }),
        );
      } catch (e) {
        return toResponse({ status: 'error', message: msgOf(e) });
      }
    }

    // POST { action: <one of the four write actions>, ... }
    if (methodOf(init) === 'POST' && typeof init?.body === 'string') {
      let parsed: { action?: string; [key: string]: unknown };
      try {
        parsed = JSON.parse(init.body) as { action?: string };
      } catch {
        parsed = {};
      }
      if (parsed.action && BRIDGED_ACTIONS.has(parsed.action)) {
        const { action, ...request } = parsed;
        try {
          return toResponse(
            await callApi(action as 'UPDATE_QUESTION', request as never),
          );
        } catch (e) {
          return toResponse({ status: 'error', message: msgOf(e) });
        }
      }
    }

    return originalFetch(input, init);
  };

  return () => {
    window.fetch = originalFetch;
  };
};

/* ── the answer-script viewer (RF-73, RF-109) ──────────────────────────── */

/** One row of a result's stored answer script, as the origin's renderers read it. */
export interface ResultScriptRow {
  [key: string]: unknown;
  QuestionNo?: number | string;
  Question?: string;
  QuestionHTML?: string;
  Text?: string;
  TextHTML?: string;
  StudentAnswer?: string;
  CorrectAnswer?: string;
  Correct?: string;
  Awarded?: number | string;
  Mark?: number | string;
  IsCorrect?: boolean;
  QuestionType?: string;
}

/** The page state the viewer reads, injected because the four consoles differ. */
export interface ResultScriptContext {
  /** `masterResultList` — the full loaded result set. */
  getMasterResults: () => ResultRecord[];
  /** `renderedResultList` — the rows currently in the results table. */
  getRenderedResults: () => ResultRecord[];
  /** The page's own `winAlert`; this viewer only ever raises two-argument alerts. */
  winAlert: (title: string, msg: string) => void;
  /** `LOGGED_IN_SCHOOL_ID` — the `schoolID` fallback for the cloud re-fetch. */
  getSchoolId: () => string;
  /** Reads a results filter control by id: `res-year`, `res-term`, `res-category`, `res-mode`. */
  readFilter: (id: string) => string;
  /** The mock transport the page's other first-party calls use (D-39). */
  fetchImpl: (url: string) => Promise<Response>;
}

export interface ResultScriptApi {
  getResultAnswerScript: (result: ResultRecord) => ResultScriptRow[];
  printResultScript: (title: string, rowsHtml: string) => void;
  closeResultScriptModal: () => void;
  showResultScriptModal: (title: string, rowsHtml: string) => void;
  refreshResultScriptFromCloud: (
    result: ResultRecord,
    index: number,
    targetList?: ResultRecord[],
  ) => Promise<ResultRecord>;
  viewResultScript: (
    index: number,
    scope: 'passed' | 'failed',
    source?: 'results' | 'script',
  ) => Promise<void>;
}

/**
 * The answer-script viewer and its modal, transcribed from the origin's inline
 * script (admin.html 2643-2781, byte-identical on all four consoles).
 *
 * Nothing in the origin's UI calls it — `viewResultScript` is the only entry
 * point and no control is wired to it — so the block is dead code there and here
 * (DEV-3). It is reproduced rather than dropped because RF-73 and RF-109
 * describe it, and because the origin is the specification: the modal injects
 * `#0f3766`, `#17233f` and `#d9e2ef` as inline styles instead of the page
 * tokens, and `viewResultScript` reads a `renderedScriptResultList` that the
 * page never declares.
 *
 * The origin declares all of this at the top level of a classic script, so it is
 * page-global there; `<script setup>` would hide it, and the modal's own
 * `onclick="closeResultScriptModal()"` needs the global, so it goes on `window`.
 */
export const installResultScriptViewer = (ctx: ResultScriptContext): ResultScriptApi => {
  const getResultAnswerScript = (result: ResultRecord): ResultScriptRow[] => {
    if (Array.isArray(result.AnswerScript)) return result.AnswerScript as ResultScriptRow[];
    if (Array.isArray(result.answerScript)) return result.answerScript as ResultScriptRow[];
    if (Array.isArray(result.Script)) return result.Script as ResultScriptRow[];
    if (typeof result.AnswerScript === 'string' && result.AnswerScript.trim()) {
      try {
        const parsed: unknown = JSON.parse(result.AnswerScript);
        return Array.isArray(parsed) ? (parsed as ResultScriptRow[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const stripResultHtml = (value: unknown): string =>
    String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const escapeResultScriptHtml = (value: unknown): string =>
    String(value || '').replace(
      /[&<>"']/g,
      (char) =>
        (
          {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          } as Record<string, string>
        )[char] ?? char,
    );

  const formatResultAnswer = (item: ResultScriptRow, value: unknown): string => {
    const raw = String(value || '').trim();
    if (!raw) return 'Blank';
    const letter = raw.toUpperCase();
    if (/^[A-D]$/.test(letter)) {
      const optionText = stripResultHtml(item[`${letter}HTML`] || item[letter] || '');
      return optionText ? `${optionText} (${letter})` : letter;
    }
    return raw;
  };

  const getResultScriptPrintHtml = (title: string, rowsHtml: string): string =>
    `<!DOCTYPE html><html><head><title>${escapeResultScriptHtml(title)}</title><style>
            body{font-family:Arial,sans-serif;color:#17233f;padding:24px;line-height:1.45;}
            h1{font-size:20px;margin:0 0 14px;color:#0f3766;}
            .script-row{border:1px solid #d9e2ef;border-radius:8px;padding:14px;margin-bottom:12px;page-break-inside:avoid;}
            .question{font-weight:700;margin-bottom:8px;}
            .meta{font-size:13px;margin:4px 0;}
            @media print{body{padding:12mm}.script-row{break-inside:avoid;}}
        <\/style><\/head><body><h1>${escapeResultScriptHtml(title)}</h1>${rowsHtml}<\/body><\/html>`;

  const printResultScript = (title: string, rowsHtml: string): void => {
    const printWindow = window.open('', '_blank', 'width=920,height=900');
    if (!printWindow) {
      ctx.winAlert('Print Blocked', 'Allow popups for this portal, then try again.');
      return;
    }
    printWindow.document.write(getResultScriptPrintHtml(title, rowsHtml));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  };

  const closeResultScriptModal = (): void => {
    const modal = document.getElementById('result-script-modal');
    if (modal) modal.remove();
  };

  const showResultScriptModal = (title: string, rowsHtml: string): void => {
    closeResultScriptModal();
    const modal = document.createElement('div');
    modal.id = 'result-script-modal';
    modal.style.cssText =
      'position:fixed; inset:0; background:rgba(5,16,32,.62); z-index:99999; display:flex; align-items:center; justify-content:center; padding:18px;';
    modal.innerHTML = `
            <div style="width:min(920px,96vw); max-height:92vh; background:#fff; border-radius:12px; box-shadow:0 24px 70px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; border-bottom:1px solid #e5edf6;">
                    <h3 style="margin:0; color:#0f3766; font-size:18px;">${escapeResultScriptHtml(title)}</h3>
                    <button type="button" onclick="closeResultScriptModal()" style="border:0; background:#eef3f8; color:#123; width:34px; height:34px; border-radius:50%; font-weight:900; cursor:pointer;">X</button>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; padding:12px 18px; border-bottom:1px solid #edf2f7;">
                    <button type="button" data-role="print-result-script" style="background:#0f3766; color:#fff; border:0; border-radius:8px; padding:10px 14px; font-weight:800; cursor:pointer;">PRINT / SAVE PDF</button>
                </div>
                <div id="result-script-print-body" style="padding:18px; overflow:auto; max-height:68vh;">${rowsHtml}</div>
            </div>`;
    document.body.appendChild(modal);
    const printBtn = modal.querySelector<HTMLButtonElement>('[data-role="print-result-script"]');
    if (printBtn) {
      printBtn.onclick = (): void => {
        const body = document.getElementById('result-script-print-body');
        printResultScript(title, body ? body.innerHTML : '');
      };
    }
  };

  const refreshResultScriptFromCloud = async (
    result: ResultRecord,
    index: number,
    targetList: ResultRecord[] = ctx.getRenderedResults(),
  ): Promise<ResultRecord> => {
    if (getResultAnswerScript(result).length > 0) return result;
    const regNo = result.RegNo || '';
    const subject = result.Subject || '';
    if (!regNo || !subject) return result;
    const endpoint = window.AWS_CONFIG ? window.AWS_CONFIG.getStudentsEndpoint : '';
    const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    const schoolID = result.SchoolID || ctx.getSchoolId() || 'ALL';
    const params = new URLSearchParams({
      action: 'GET_RESULTS',
      schoolID,
      targetSchool: schoolID,
      regNo,
      subject,
      year: String(
        result.Year || ctx.readFilter('res-year') || '2025-2026',
      ).replace('/', '-'),
      term: result.Term || ctx.readFilter('res-term') || 'TERM1',
      category: result.Category || ctx.readFilter('res-category') || 'EXAM',
      mode: result.Mode || ctx.readFilter('res-mode') || 'MODE_A',
      noCache: '1',
    });
    try {
      // The URL keeps the origin's shape, but the request rides the page's mock
      // transport (D-39) so the live address is never dialled (D-04).
      const response = await ctx.fetchImpl(`${baseUrl}?${params.toString()}`);
      const data = (await response.json()) as { status?: string; results?: ResultRecord[] };
      const fresh =
        data.status === 'success' && Array.isArray(data.results) ? data.results[0] : null;
      if (!fresh) return result;
      const merged: ResultRecord = { ...result, ...fresh };
      if (Array.isArray(targetList)) targetList[index] = merged;
      const master = ctx.getMasterResults();
      const masterIndex = master.findIndex(
        (item) =>
          (Boolean(item.PK && item.SK) && item.PK === merged.PK && item.SK === merged.SK) ||
          (item.RegNo === merged.RegNo && item.Subject === merged.Subject),
      );
      if (masterIndex >= 0) master[masterIndex] = { ...master[masterIndex], ...merged };
      return merged;
    } catch {
      return result;
    }
  };

  const viewResultScript = async (
    index: number,
    scope: 'passed' | 'failed',
    source: 'results' | 'script' = 'results',
  ): Promise<void> => {
    // The origin reads `renderedScriptResultList` here and declares it nowhere on
    // the page, so its `source === "script"` path raises a ReferenceError. Left
    // unresolved on purpose - the block is unreachable either way (DEV-3).
    const sourceList: ResultRecord[] =
      // @ts-expect-error 2304 - replicated origin defect, see DEV-3
      source === 'script' ? renderedScriptResultList : ctx.getRenderedResults();
    let result = sourceList[index];
    if (!result) {
      ctx.winAlert('Missing Result', 'Load the result again and retry.');
      return;
    }
    result = await refreshResultScriptFromCloud(result, index, sourceList);
    sourceList[index] = result;
    const script = getResultAnswerScript(result);
    if (script.length === 0) {
      ctx.winAlert(
        'Script Unavailable',
        'This result does not have a stored answer script. Newly submitted results will include script details.',
      );
      return;
    }
    const rows = script.filter((item) =>
      scope === 'passed'
        ? Boolean(item.IsCorrect)
        : !item.IsCorrect && String(item.QuestionType || '').toUpperCase() !== 'THEORY',
    );
    if (rows.length === 0) {
      ctx.winAlert(
        'No Script Rows',
        `No ${scope === 'passed' ? 'passed' : 'failed'} objective questions were found for this result.`,
      );
      return;
    }
    const title = `${scope === 'passed' ? 'Passed' : 'Failed'} Script - ${
      result.FullName || result.RegNo
    }`;
    const rowsHtml = rows
      .map((item, rowIndex) => {
        const question = stripResultHtml(
          item.QuestionHTML || item.Question || item.TextHTML || item.Text,
        );
        const studentAnswer = formatResultAnswer(item, item.StudentAnswer);
        const correctAnswer = formatResultAnswer(item, item.CorrectAnswer || item.Correct);
        return `<div class="script-row" style="border:1px solid #d9e2ef; border-radius:8px; padding:14px; margin-bottom:12px;">
                <div class="question" style="font-weight:800; margin-bottom:8px;">${rowIndex + 1}. Q${escapeResultScriptHtml(item.QuestionNo || rowIndex + 1)}: ${escapeResultScriptHtml(question)}</div>
                <div class="meta" style="margin:4px 0;"><strong>Student Answer:</strong> ${escapeResultScriptHtml(studentAnswer)}</div>
                <div class="meta" style="margin:4px 0;"><strong>Correct Answer:</strong> ${escapeResultScriptHtml(correctAnswer)}</div>
                <div class="meta" style="margin:4px 0;"><strong>Mark:</strong> ${escapeResultScriptHtml(item.Awarded || 0)}/${escapeResultScriptHtml(item.Mark || 0)}</div>
            </div>`;
      })
      .join('');
    showResultScriptModal(title, rowsHtml);
  };

  Object.assign(window, {
    getResultAnswerScript,
    stripResultHtml,
    escapeResultScriptHtml,
    formatResultAnswer,
    getResultScriptPrintHtml,
    printResultScript,
    closeResultScriptModal,
    showResultScriptModal,
    refreshResultScriptFromCloud,
    viewResultScript,
  });

  return {
    getResultAnswerScript,
    printResultScript,
    closeResultScriptModal,
    showResultScriptModal,
    refreshResultScriptFromCloud,
    viewResultScript,
  };
};
