/**
 * cdp-workflows.mjs — the workflow checks, driven over the DevTools Protocol.
 *
 * The assertions are the same ones `tools/audit/verify-workflows.js` makes (that
 * file runs under the Playwright MCP and reads better for the step-by-step
 * version). This exists because the MCP server is unavailable in this session and
 * the checks have to stay re-runnable.
 *
 * Each check states one expectation and reads the DOM before and after one
 * interaction, so a click that silently does nothing fails rather than passing.
 *
 * Run:  node tools/audit/cdp-workflows.mjs
 */

import { launch } from 'file:///C:/Users/USER/AppData/Local/Temp/opencode/cdp/cdp.mjs';

const BASE = 'http://localhost:5173';

/** The project's own published mock fixture. Never the live audit credential. */
const USER = 'mocksuper';
const PASS = 'MockAdminPass1';

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ok = (d) => ['PASS', d];
const bad = (d) => ['FAIL', d];

async function main() {
  const browser = await launch();

  const goto = async (path, settle = 1500) => {
    await browser.goto(BASE + path, settle);
  };

  /**
   * Open a panel and wait for IT, not for the clock.
   *
   * A fixed settle after `Page.navigate` is the race that made this script
   * abort with "Cannot read properties of undefined" on a cold Vite start: the
   * query lands while `[data-admin-panel]` does not exist yet, and the first
   * `.click()` reads nothing. Every probe in this file assumes a mounted
   * panel, so the wait belongs here rather than in twenty probes.
   */
  const open = async (panel) => {
    await goto(`/admin/?panel=${panel}`, 250);
    await browser.waitFor(`
      const el = document.querySelector('[data-admin-panel]');
      return !!el && el.getAttribute('data-admin-panel') === ${JSON.stringify(panel)};
    `, 20000);
    /* Settled, not merely mounted — and "settled" needs two samples, not one.
       The panel element exists before its read is issued, so a single
       "no spinner" sample is taken from the pre-fetch frame and passes
       instantly; the table is then read while it is still empty. That is how
       W2 came to report "rows 0 → 0" for a search box that works, and how W3
       came to abort on `row.querySelectorAll` of a null row. Two consecutive
       quiet samples, with the read's own latency between them, cannot be
       fooled that way. */
    let quiet = 0;
    for (let attempt = 0; attempt < 60 && quiet < 2; attempt += 1) {
      const busy = await browser.evaluate(`
        const el = document.querySelector('[data-admin-panel]');
        return !el || el.getAttribute('data-admin-panel') !== ${JSON.stringify(panel)} || !!el.querySelector('.ap-loading');
      `);
      quiet = busy ? 0 : quiet + 1;
      if (quiet < 2) await sleep(300);
    }
  };

  /** Read a small snapshot of the mounted module. */
  const read = async (probe) => browser.evaluate(probe);

  const pass = (id, name, detail) => results.push({ id, name, verdict: 'PASS', detail });
  const fail = (id, name, detail) => results.push({ id, name, verdict: 'FAIL', detail });

  /**
   * Run one check, and let it fail on its own rather than ending the run.
   *
   * A probe that throws mid-script — a row that was not there, a dialog that
   * did not open — used to abort everything, so one flaky check reported as
   * "ABORTED" with no verdict at all and hid the twenty that had passed. Each
   * check now carries its own identity, and an exception becomes a FAIL for
   * that check alone.
   */
  const step = async (id, name, body) => {
    try {
      await body();
    } catch (e) {
      fail(id, name, `threw: ${String(e).split('\n')[0]}`);
    }
  };

  try {
    // ── sign in ──────────────────────────────────────────────────────────
    /* A fresh browser profile is used for this run, so any session left over
       from a previous one has to be cleared first — otherwise `/login/super/`
       redirects straight to `/admin/`, the form is never rendered, and the
       first `.click()` below fails on nothing. */
    await goto('/login/super/', 600);
    await browser.evaluate(`
      localStorage.clear();
      sessionStorage.clear();
      return true;
    `);
    /* Then wait for the form rather than for a fixed delay: the first paint
       after a cold Vite start compiles several hundred modules, and a timeout
       long enough for a warm server is still a race on a cold one. */
    await browser.waitFor(`
      return !!document.getElementById('username') &&
        Array.from(document.querySelectorAll('button')).some((b) => /AUTHORIZE SESSION/i.test(b.textContent));
    `, 20000);
    await browser.evaluate(`
      const set = (id, v) => {
        const el = document.getElementById(id);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('username', ${JSON.stringify(USER)});
      set('password', ${JSON.stringify(PASS)});
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => /AUTHORIZE SESSION/i.test(b.textContent));
      btn.click();
      return true;
    `);
    await sleep(4000);
    const session = await read(`return { ok: !!localStorage.getItem('LAEC_Session'), role: localStorage.getItem('AdminRole') };`);
    if (!session.ok) {
      console.log('FATAL sign-in failed');
      process.exitCode = 1;
      return;
    }

    // ── W1 · required-field validation on the generic create dialog ───────
    await open('stock');
    const w1 = await read(`
      const before = document.querySelectorAll('[data-admin-panel] tbody tr').length;
      Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /Create Stock Item/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 400));
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return { before, opened: false };
      Array.from(dlg.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Create').click();
      await new Promise((r) => setTimeout(r, 500));
      const err = dlg.querySelector('.ap-form__error');
      return { before, opened: true, err: err ? err.textContent.trim() : '', stillOpen: !!document.querySelector('[role="dialog"]') };
    `);
    if (w1.opened && /required/i.test(w1.err)) {
      pass('W1', 'stock: an empty create is refused with a required-field message',
        `refused with "${w1.err.split('·')[0].trim()}" and the dialog stayed open (${w1.stillOpen})`);
    } else {
      fail('W1', 'stock: an empty create is refused with a required-field message',
        `opened=${w1.opened} error="${w1.err}"`);
    }

    // ── W1b · a valid create persists and banners ────────────────────────
    const w1b = await read(`
      const dlg = document.querySelector('[role="dialog"]');
      const fill = (labelText, value) => {
        for (const label of dlg.querySelectorAll('label')) {
          const span = label.querySelector('span');
          if (!span) continue;
          if (span.textContent.replace(/\\*\\s*$/, '').trim().toLowerCase() !== labelText) continue;
          const control = label.querySelector('input, select, textarea');
          if (!control) return false;
          if (control.tagName.toLowerCase() === 'select') {
            const opt = control.querySelectorAll('option')[1];
            control.value = opt.value;
          } else {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(control, value);
            control.dispatchEvent(new Event('input', { bubbles: true }));
          }
          control.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      };
      fill('name', 'Verification Sash');
      fill('sku', 'VERIFY-SASH-1');
      fill('category');
      fill('unit price', '4500');
      fill('in stock', '12');
      const before = document.querySelectorAll('[data-admin-panel] tbody tr').length;
      Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Create').click();
      await new Promise((r) => setTimeout(r, 1200));
      const banner = document.querySelector('.ap-banner');
      return {
        before,
        after: document.querySelectorAll('[data-admin-panel] tbody tr').length,
        banner: banner ? banner.textContent.replace(/×$/, '').trim() : '',
        closed: !document.querySelector('[role="dialog"]'),
      };
    `);
    if (w1b.closed && w1b.after === w1b.before + 1 && w1b.banner) {
      pass('W1b', 'stock: a valid create closes, adds a row and banners',
        `rows ${w1b.before} → ${w1b.after}, banner "${w1b.banner}"`);
    } else {
      fail('W1b', 'stock: a valid create closes, adds a row and banners',
        `closed=${w1b.closed} rows ${w1b.before} → ${w1b.after} banner="${w1b.banner}"`);
    }

    // ── W2 · search narrows ──────────────────────────────────────────────
    await open('stock');
    const w2 = await read(`
      const before = document.querySelectorAll('[data-admin-panel] tbody tr').length;
      const input = document.querySelector('[data-admin-panel] input[type="search"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Sash');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      return { before, after: document.querySelectorAll('[data-admin-panel] tbody tr').length };
    `);
    if (w2.after < w2.before) {
      pass('W2', 'stock: the search box refetches and narrows the table',
        `rows ${w2.before} → ${w2.after} for "Sash"`);
    } else {
      fail('W2', 'stock: the search box refetches and narrows the table',
        `rows ${w2.before} → ${w2.after}`);
    }

    // ── W3 · the row action menu ─────────────────────────────────────────
    await open('users');
    const w3 = await read(`
      const row = document.querySelector('[data-admin-panel] tbody tr');
      Array.from(row.querySelectorAll('button')).find((b) => /Actions/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 400));
      const menu = document.querySelector('[data-admin-panel] [role="menu"]');
      const items = menu ? Array.from(menu.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent.trim()) : [];
      const title = document.querySelector('.ap-module__title');
      title.click();
      await new Promise((r) => setTimeout(r, 400));
      const dismissed = !document.querySelector('[data-admin-panel] [role="menu"]');
      return { items, dismissed };
    `);
    const declared = ['View details', 'Edit', 'Deactivate', 'Suspend', 'Delete'];
    const missing = declared.filter((d) => !w3.items.includes(d));
    if (!missing.length && w3.dismissed) {
      pass('W3', 'users: the row Actions menu lists the declared row actions and dismisses on an outside click',
        `items [${w3.items.join(', ')}], outside click dismissed it`);
    } else {
      fail('W3', 'users: the row Actions menu lists the declared row actions and dismisses on an outside click',
        `items [${w3.items.join(', ')}] missing [${missing.join(', ')}] dismissed=${w3.dismissed}`);
    }

    // ── W4 · approving a leave moves it between the two tables ────────────
    await open('leave-approvals');
    const w4 = await read(`
      const heads = Array.from(document.querySelectorAll('[data-admin-panel] .ap-dash__heading'))
        .map((h) => h.textContent.trim());
      const num = (label) => {
        const h = heads.find((x) => x.startsWith(label));
        const m = h ? /\\((\\d+)\\)/.exec(h) : null;
        return m ? Number(m[1]) : -1;
      };
      const before = { pending: num('Pending'), decided: num('Decided') };
      Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => b.textContent.trim() === 'Approve').click();
      await new Promise((r) => setTimeout(r, 1500));
      const after2 = Array.from(document.querySelectorAll('[data-admin-panel] .ap-dash__heading'))
        .map((h) => h.textContent.trim());
      const num2 = (label) => {
        const h = after2.find((x) => x.startsWith(label));
        const m = h ? /\\((\\d+)\\)/.exec(h) : null;
        return m ? Number(m[1]) : -1;
      };
      const banner = document.querySelector('.ap-banner');
      return { before, after: { pending: num2('Pending'), decided: num2('Decided') },
        banner: banner ? banner.textContent.replace(/×$/, '').trim() : '' };
    `);
    if (w4.after.pending === w4.before.pending - 1 && w4.after.decided === w4.before.decided + 1) {
      pass('W4', 'leave-approvals: Approve moves a request from Pending to Decided',
        `Pending ${w4.before.pending} → ${w4.after.pending}, Decided ${w4.before.decided} → ${w4.after.decided}, banner "${w4.banner}"`);
    } else {
      fail('W4', 'leave-approvals: Approve moves a request from Pending to Decided',
        `before ${JSON.stringify(w4.before)} after ${JSON.stringify(w4.after)}`);
    }

    // ── W5 · leave-form validation, verbatim from the deployed source ─────
    await open('leave');
    const w5 = await read(`
      Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /Apply for Leave/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 400));
      const dlg = document.querySelector('[role="dialog"]');
      const submit = () => Array.from(dlg.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Submit request');
      submit().click();
      await new Promise((r) => setTimeout(r, 400));
      /* Read the message now, not later: the error lives in a v-if paragraph that
         Vue patches in place, so holding the node and reading its text after the
         next submit reports the SECOND message twice. */
      const emptyNode = dlg.querySelector('.ap-form__error');
      const empty = emptyNode ? emptyNode.textContent.trim() : '';

      const fill = (type, index, value) => {
        const el = dlg.querySelectorAll(type)[index];
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const select = dlg.querySelector('select');
      select.value = select.querySelectorAll('option')[1].value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      fill('input[type="date"]', 0, '2026-03-10');
      fill('input[type="date"]', 1, '2026-03-01');
      /* The leave-type control carries no "type" attribute, so a
         type="text" selector matches nothing — selected by absence instead. */
      const typed = Array.from(dlg.querySelectorAll('input'))
        .filter((i) => !i.getAttribute('type'))[0];
      const typedSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      typedSetter.call(typed, 'Annual Leave');
      typed.dispatchEvent(new Event('input', { bubbles: true }));
      const ta = dlg.querySelector('textarea');
      const taSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      taSetter.call(ta, 'Verification request.');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      submit().click();
      await new Promise((r) => setTimeout(r, 500));
      const back = dlg.querySelector('.ap-form__error');
      return {
        empty,
        back: back ? back.textContent.trim() : '',
      };
    `);
    const w5a = /select the staff member/i.test(w5.empty);
    const w5b = /end date must be after the start date/i.test(w5.back);
    if (w5a && w5b) {
      pass('W5', 'leave: both validation rules refuse with the deployed source wording',
        `"${w5.empty}" then "${w5.back}"`);
    } else {
      fail('W5', 'leave: both validation rules refuse with the deployed source wording',
        `empty="${w5.empty}" back="${w5.back}"`);
    }

    // ── W6 · general settings required field ─────────────────────────────
    await open('general-settings');
    const w6 = await read(`
      for (const label of document.querySelectorAll('[data-admin-panel] label')) {
        const span = label.querySelector('span');
        if (!span || !/^school name/i.test(span.textContent.trim())) continue;
        const input = label.querySelector('input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
      Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /Save changes/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 600));
      const err = document.querySelector('[data-admin-panel] .ap-form__error');
      const banner = document.querySelector('.ap-banner');
      return { err: err ? err.textContent.trim() : '', banner: banner ? banner.textContent.trim() : '' };
    `);
    if (/school name is required/i.test(w6.err) && !w6.banner) {
      pass('W6', 'general-settings: blanking School name refuses the save with no write issued',
        `refused with "${w6.err}"`);
    } else {
      fail('W6', 'general-settings: blanking School name refuses the save with no write issued',
        `err="${w6.err}" banner="${w6.banner}"`);
    }

    // ── W7 · system configuration's floor of 8 ───────────────────────────
    await open('system-configuration');
    const w7 = await read(`
      const section = Array.from(document.querySelectorAll('[data-admin-panel] .ap-sys__section'))
        .find((s) => /Security/.test(s.textContent));
      for (const label of section.querySelectorAll('label')) {
        const span = label.querySelector('span');
        if (!span || !/^minimum password length/i.test(span.textContent.trim())) continue;
        const input = label.querySelector('input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, '4');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
      Array.from(section.querySelectorAll('button')).find((b) => /Save changes/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 600));
      const err = section.querySelector('.ap-form__error');
      const banner = document.querySelector('.ap-banner');
      return { err: err ? err.textContent.trim() : '', banner: banner ? banner.textContent.trim() : '' };
    `);
    if (/at least 8/i.test(w7.err) && !w7.banner) {
      pass('W7', 'system-configuration: a minimum password length below 8 is refused',
        `refused with "${w7.err}"`);
    } else {
      fail('W7', 'system-configuration: a minimum password length below 8 is refused',
        `err="${w7.err}" banner="${w7.banner}"`);
    }

    // ── W8 · grading refuses an inverted band ────────────────────────────
    await open('grading');
    const w8 = await read(`
      const inputs = document.querySelectorAll('[data-admin-panel] table tbody input[type="number"]');
      const set = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(inputs[0], '95');
      set(inputs[1], '30');
      Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /Save changes/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 600));
      const err = document.querySelector('[data-admin-panel] .ap-form__error');
      const banner = document.querySelector('.ap-banner');
      return { err: err ? err.textContent.trim() : '', banner: banner ? banner.textContent.trim() : '' };
    `);
    if (/minimum score at or below its maximum/i.test(w8.err) && !w8.banner) {
      pass('W8', 'grading: a band whose min exceeds its max is refused before any save',
        `refused with "${w8.err}"`);
    } else {
      fail('W8', 'grading: a band whose min exceeds its max is refused before any save',
        `err="${w8.err}" banner="${w8.banner}"`);
    }

    // ── W9 · results entry computes TOTAL and GRADE ───────────────────────
    await open('enter-results');
    const w9 = await read(`
      const row = document.querySelector('[data-admin-panel] table tbody tr');
      const cells = () => Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim());
      const before = { total: cells()[10], grade: cells()[12] };
      const marks = row.querySelectorAll('input[type="number"]');
      const set = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(marks[0], '18'); set(marks[1], '9'); set(marks[2], '8'); set(marks[3], '57');
      await new Promise((r) => setTimeout(r, 500));
      const after = { total: cells()[10], grade: cells()[12] };
      const submit = Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /Submit Results/.test(b.textContent));
      return { before, after, submitDisabled: submit ? submit.disabled : null };
    `);
    if (w9.after.total === '92' && w9.after.grade && w9.submitDisabled === true) {
      pass('W9', 'enter-results: TOTAL and GRADE recompute from the four marks; submit is gated on a class',
        `18+9+8+57 = ${w9.after.total}, grade ${w9.before.grade} → ${w9.after.grade}, submit disabled without a class`);
    } else {
      fail('W9', 'enter-results: TOTAL and GRADE recompute from the four marks; submit is gated on a class',
        `total "${w9.before.total}" → "${w9.after.total}", grade "${w9.after.grade}", disabled=${w9.submitDisabled}`);
    }

    // ── W10 · a wallet top-up moves the balance ──────────────────────────
    await open('wallets');
    const w10 = await read(`
      /* Rows are re-read fresh each time. Capturing the tr before the write and
         reading it afterwards reads a node Vue has already replaced, because
         load() swaps the records array — a stale element reports the pre-write
         value and looks exactly like a write that did not land. */
      const readRows = () => Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
        .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()));
      const rows0 = readRows();
      const row = document.querySelector('[data-admin-panel] table tbody tr');
      const before = { who: rows0[0][0], balance: rows0[0][3] };
      Array.from(row.querySelectorAll('button')).find((b) => /Actions/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 400));
      Array.from(document.querySelectorAll('[role="menu"] button'))
        .find((b) => /Top up/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 500));
      const dlg = document.querySelector('[role="dialog"]');
      const title = dlg.querySelector('.ap-dialog__title').textContent.trim();
      let amountLabel = null;
      for (const label of dlg.querySelectorAll('label')) {
        const span = label.querySelector('span');
        if (!span) continue;
        if (span.textContent.replace(/\\*\\s*$/, '').trim().toLowerCase() === 'amount (ngn)') {
          amountLabel = label;
          break;
        }
      }
      if (!amountLabel) return { before, opened: true, filled: false };
      const input = amountLabel.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '5000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const confirmLabel = Array.from(dlg.querySelectorAll('button'))
        .find((b) => /Credit wallet/.test(b.textContent)).textContent.trim();
      Array.from(dlg.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === confirmLabel).click();
      await new Promise((r) => setTimeout(r, 1400));
      const banner = document.querySelector('.ap-banner');
      return {
        before, opened: true, filled: true, title, confirmLabel,
        after: { balance: readRows()[0][3] },
        banner: banner ? banner.textContent.replace(/×$/, '').trim() : '',
      };
    `);
    const money = (s) => Number(String(s).replace(/[^0-9.]/g, ''));
    if (w10.filled && money(w10.after.balance) === money(w10.before.balance) + 5000) {
      pass('W10', 'wallets: a Top up of 5,000 moves the balance',
        `${w10.title} / "${w10.confirmLabel}": ${w10.before.balance} → ${w10.after.balance}, banner "${w10.banner}"`);
    } else {
      fail('W10', 'wallets: a Top up of 5,000 moves the balance',
        `filled=${w10.filled} ${w10.before.balance} → ${w10.after ? w10.after.balance : '?'}, ` +
        `title="${w10.title}" confirm="${w10.confirmLabel}" banner="${w10.banner}"`);
    }

    // ── W10b · a zero top-up is refused ─────────────────────────────────
    await open('wallets');
    const w10b = await read(`
      const row = document.querySelector('[data-admin-panel] table tbody tr');
      Array.from(row.querySelectorAll('button')).find((b) => /Actions/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 400));
      Array.from(document.querySelectorAll('[role="menu"] button'))
        .find((b) => /Top up/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 500));
      const dlg = document.querySelector('[role="dialog"]');
      for (const label of dlg.querySelectorAll('label')) {
        const span = label.querySelector('span');
        if (!span) continue;
        if (span.textContent.replace(/\\*\\s*$/, '').trim().toLowerCase() !== 'amount (ngn)') continue;
        const input = label.querySelector('input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, '0');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
      Array.from(dlg.querySelectorAll('button')).find((b) => /Credit wallet/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 600));
      const err = dlg.querySelector('.ap-form__error');
      return { err: err ? err.textContent.trim() : '', stillOpen: !!document.querySelector('[role="dialog"]') };
    `);
    if (/greater than zero/i.test(w10b.err) && w10b.stillOpen) {
      pass('W10b', 'wallets: an amount of zero is refused with the origin wording',
        `refused with "${w10b.err}" and the dialog stayed open`);
    } else {
      fail('W10b', 'wallets: an amount of zero is refused with the origin wording',
        `err="${w10b.err}" stillOpen=${w10b.stillOpen}`);
    }

    // ── W11 · a permission grant is saved ────────────────────────────────
    await open('permissions');
    const w11 = await read(`
      const role = document.querySelector('[data-admin-panel] .ap-identity__name').textContent.trim();
      /* The Edit button by text: the first button in this panel is the
         "View by role" tab, and clicking it re-renders the same panel. */
      Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => b.textContent.trim() === 'Edit').click();
      await new Promise((r) => setTimeout(r, 500));
      const dlg = document.querySelector('[role="dialog"]');
      /* The live selection count is now a pill in the dialog toolbar that reads
         "N selected", not the prose line "N permission(s) selected." that the
         old markup put above the matrix. What is asserted is unchanged — toggling
         one permission moves this number by exactly one, and only the source of
         the number moved. */
      const count = () => {
        const pill = dlg.querySelector('.ap-perm__pill');
        if (!pill) return -1;
        const m = /(\\d+)/.exec(pill.textContent);
        return m ? Number(m[1]) : -1;
      };
      const before = count();
      const boxes = dlg.querySelectorAll('.ap-roles__item input[type="checkbox"]');
      let target = -1;
      boxes.forEach((b, i) => { if (target < 0 && !b.checked) target = i; });
      if (target < 0) return { role, before, after: before, note: 'nothing unchecked' };
      boxes[target].click();
      await new Promise((r) => setTimeout(r, 400));
      const after = count();
      /* The confirm button by position in the dialog footer, not by its label. The
         permissions dialog labels it "Save changes"; a check that hard-codes the
         string breaks every time the wording improves, and the wording is the
         part an operator actually reads. */
      Array.from(dlg.querySelectorAll('.ap-dialog__foot button')).pop().click();
      await new Promise((r) => setTimeout(r, 1400));
      const banner = document.querySelector('.ap-banner');
      return { role, before, after,
        closed: !document.querySelector('[role="dialog"]'),
        banner: banner ? banner.textContent.replace(/×$/, '').trim() : '' };
    `);
    if (w11.after === w11.before + 1 && w11.closed && /saved/i.test(w11.banner)) {
      pass('W11', 'permissions: adding a grant changes the in-dialog count and saves',
        `${w11.role}: selection ${w11.before} → ${w11.after}, banner "${w11.banner}"`);
    } else {
      fail('W11', 'permissions: adding a grant changes the in-dialog count and saves',
        `${w11.role}: ${w11.before} → ${w11.after}, closed=${w11.closed}, banner="${w11.banner}"`);
    }

    // ── W12 · attendance marking persists ────────────────────────────────
    await open('staff-attendance');
    const w12 = await read(`
      const open = Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /mark attendance/i.test(b.textContent));
      open.click();
      await new Promise((r) => setTimeout(r, 900));
      let dlg = document.querySelector('[role="dialog"]');
      const rows = dlg.querySelectorAll('table tbody tr').length;
      if (!rows) return { rows, opened: false };
      const row = dlg.querySelector('table tbody tr');
      const who = row.querySelector('td').textContent.trim();
      const mark = Array.from(row.querySelectorAll('button')).find((b) => /present/i.test(b.textContent));
      mark.click();
      await new Promise((r) => setTimeout(r, 300));
      const pressed = mark.getAttribute('aria-pressed');
      Array.from(dlg.querySelectorAll('button')).find((b) => /Save attendance/i.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 1500));
      const banner = document.querySelector('.ap-banner');
      const bannerText = banner ? banner.textContent.replace(/×$/, '').trim() : '';
      // Close and reopen: a write that did not land comes back unmarked.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 600));
      const closedByEscape = !document.querySelector('[role="dialog"]');
      open.click();
      await new Promise((r) => setTimeout(r, 900));
      dlg = document.querySelector('[role="dialog"]');
      const row2 = dlg.querySelector('table tbody tr');
      const mark2 = Array.from(row2.querySelectorAll('button')).find((b) => /present/i.test(b.textContent));
      return { rows, opened: true, who, pressed, bannerText, closedByEscape,
        persisted: mark2.getAttribute('aria-pressed') === 'true' };
    `);
    if (w12.opened && w12.pressed === 'true' && w12.persisted && /saved/i.test(w12.bannerText)) {
      pass('W12', 'staff-attendance: a mark survives a save, a close and a reopen',
        `${w12.who} in a ${w12.rows}-row register; banner "${w12.bannerText}"; Escape closed it (${w12.closedByEscape}); still present after reopening`);
    } else {
      fail('W12', 'staff-attendance: a mark survives a save, a close and a reopen',
        `opened=${w12.opened} pressed=${w12.pressed} persisted=${w12.persisted} banner="${w12.bannerText}"`);
    }

    // ── W13 · pagination ─────────────────────────────────────────────────
    await open('permissions');
    const w13 = await read(`
      Array.from(document.querySelectorAll('[data-admin-panel] .ap-tab'))
        .find((t) => /all users/i.test(t.textContent)).click();
      await new Promise((r) => setTimeout(r, 1200));
      const line = () => {
        const p = document.querySelector('[data-admin-panel] .ap-pager');
        return p ? p.textContent.replace(/\\s+/g, ' ').trim() : '';
      };
      const before = line();
      const prev = Array.from(document.querySelectorAll('.ap-pager button')).find((b) => /Prev/.test(b.textContent));
      const prevDisabled = prev.disabled;
      Array.from(document.querySelectorAll('.ap-pager button')).find((b) => /Next/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 1200));
      return { before, after: line(), prevDisabled };
    `);
    if (/Showing 1[–-]\d+ of \d+/i.test(w13.before) && w13.before !== w13.after && w13.prevDisabled) {
      pass('W13', 'permissions: the users view paginates and reports its range',
        `"${w13.before}" → "${w13.after}", Prev disabled on page 1`);
    } else {
      fail('W13', 'permissions: the users view paginates and reports its range',
        `"${w13.before}" → "${w13.after}", prevDisabled=${w13.prevDisabled}`);
    }

    // ── W14 · CSV export ─────────────────────────────────────────────────
    await open('staff');
    const w14 = await read(`
      const btn = Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => b.textContent.trim() === 'Export');
      if (!btn) return { present: false };
      /* Both ends of the export are intercepted, not just the download: the blob
         is held at creation so its text can be read, and the anchor click is
         swallowed so no file dialog appears. Reading the blob after the fact
         would race URL.revokeObjectURL, which is why the row count came back -1
         on the first run of this check. */
      let blob = null;
      let captured = null;
      const realCreate = URL.createObjectURL;
      const realClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = function (b) { blob = b; return realCreate.call(URL, b); };
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) { captured = { name: this.download, href: this.href }; return; }
        return realClick.apply(this, arguments);
      };
      btn.click();
      await new Promise((r) => setTimeout(r, 500));
      URL.createObjectURL = realCreate;
      HTMLAnchorElement.prototype.click = realClick;
      const banner = document.querySelector('.ap-banner');
      let lines = 0;
      let header = '';
      if (blob) {
        const text = await blob.text();
        const parts = text.split('\\n');
        lines = parts.length - 1;
        header = parts[0];
      }
      return { present: true, captured, lines, header,
        banner: banner ? banner.textContent.replace(/×$/, '').trim() : '' };
    `);
    if (w14.present && w14.captured && w14.lines > 0 && w14.header) {
      pass('W14', 'staff: Export writes a CSV whose header is the module column set',
        `${w14.captured.name}: "${w14.header}" + ${w14.lines} data row(s); banner "${w14.banner}"`);
    } else {
      fail('W14', 'staff: Export writes a CSV whose header is the module column set',
        `present=${w14.present} captured=${JSON.stringify(w14.captured)} lines=${w14.lines} header="${w14.header}"`);
    }

    // ── W15 · a tab filter narrows ───────────────────────────────────────
    await open('leave');
    const w15 = await read(`
      const rows = () => document.querySelectorAll('[data-admin-panel] tbody tr').length;
      const caption = () => {
        const c = document.querySelector('[data-admin-panel] .ap-table__caption');
        return c ? c.textContent.trim() : '';
      };
      const before = { rows: rows(), caption: caption() };
      Array.from(document.querySelectorAll('[data-admin-panel] .ap-tab'))
        .find((t) => /Pending/.test(t.textContent)).click();
      await new Promise((r) => setTimeout(r, 800));
      const on = document.querySelector('[data-admin-panel] .ap-tab--on');
      return { before, after: { rows: rows(), caption: caption() },
        on: on ? on.textContent.trim() : '' };
    `);
    if (w15.on === 'Pending' && w15.after.rows < w15.before.rows) {
      pass('W15', 'leave: the status tabs filter the table',
        `"${w15.before.caption}" → "${w15.after.caption}"`);
    } else {
      fail('W15', 'leave: the status tabs filter the table',
        `tab="${w15.on}" rows ${w15.before.rows} → ${w15.after.rows}`);
    }

    // ── W16 · a missing permission removes the CONTROL ───────────────────
    await open('leave-approvals');
    const w16 = await read(`
      const count = (text) => Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .filter((b) => new RegExp(text, 'i').test(b.textContent)).length;
      const before = { approve: count('^Approve'), reject: count('^Reject'), view: count('^View') };
      // The store is a module only Vite can serve; on a built bundle this import
      // fails and the check reports SKIPPED rather than passing.
      let reachable = true;
      try {
        const m = await import('/src/stores/session.ts');
        const store = m.useSessionStore();
        window.__auditGrants = store.permissions;
        store.permissions = store.permissions.filter((p) => !/^leave\\./.test(p));
      } catch (e) {
        reachable = false;
      }
      await new Promise((r) => setTimeout(r, 900));
      const after = { approve: count('^Approve'), reject: count('^Reject'), view: count('^View') };
      let restored = null;
      if (reachable) {
        const m = await import('/src/stores/session.ts');
        m.useSessionStore().permissions = window.__auditGrants || [];
        await new Promise((r) => setTimeout(r, 900));
        restored = count('^Approve');
      }
      return { reachable, before, after, restored };
    `);
    if (!w16.reachable) {
      results.push({
        id: 'W16', name: 'leave-approvals: without leave.approve the decision buttons are not rendered',
        verdict: 'SKIPPED', detail: 'the session store is not importable here — run against `npm run dev`',
      });
    } else if (w16.before.approve > 0 && w16.after.approve === 0 && w16.after.reject === 0 && w16.after.view > w16.before.view && w16.restored > 0) {
      pass('W16', 'leave-approvals: without leave.approve the decision buttons are not rendered',
        `Approve/Reject ${w16.before.approve}/${w16.before.reject} → ${w16.after.approve}/${w16.after.reject}, View rose ${w16.before.view} → ${w16.after.view}, and restoring the grants brought Approve back (${w16.restored}) — gated, not disabled`);
    } else {
      fail('W16', 'leave-approvals: without leave.approve the decision buttons are not rendered',
        `before ${JSON.stringify(w16.before)} after ${JSON.stringify(w16.after)} restored=${w16.restored}`);
    }

    // ── W16c · another claim cannot reach /admin/ ────────────────────────
    await read(`localStorage.clear(); return true;`);
    await goto('/login/school/', 1800);
    await browser.evaluate(`
      const set = (id, v) => {
        const el = document.getElementById(id);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('username', 'mockschool');
      set('password', ${JSON.stringify(PASS)});
      Array.from(document.querySelectorAll('button'))
        .find((b) => /AUTHORIZE SESSION/i.test(b.textContent)).click();
      return true;
    `);
    await sleep(4000);
    await goto('/admin/?panel=leave-approvals', 1800);
    const w16c = await read(`
      return { path: location.pathname, role: localStorage.getItem('AdminRole'),
        panel: (document.querySelector('[data-admin-panel]') || {}).getAttribute ?
          document.querySelector('[data-admin-panel]').getAttribute('data-admin-panel') : null };
    `);
    if (w16c.path === '/control/' && w16c.panel === null) {
      pass('W16c', '/admin/ refuses a SCHOOL_ADMIN claim and returns it to /control/',
        `asked for /admin/?panel=leave-approvals as ${w16c.role}; landed on ${w16c.path} with no module mounted`);
    } else {
      fail('W16c', '/admin/ refuses a SCHOOL_ADMIN claim and returns it to /control/',
        `landed on ${w16c.path}, panel ${w16c.panel}, role ${w16c.role}`);
    }

    // Back to the super-admin fixture for the remaining checks.
    await read(`localStorage.clear(); return true;`);
    await goto('/login/super/', 1800);
    await browser.evaluate(`
      const set = (id, v) => {
        const el = document.getElementById(id);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('username', ${JSON.stringify(USER)});
      set('password', ${JSON.stringify(PASS)});
      Array.from(document.querySelectorAll('button'))
        .find((b) => /AUTHORIZE SESSION/i.test(b.textContent)).click();
      return true;
    `);
    await sleep(4000);

    // ── W17 · the three broken live settings pages stay broken ───────────
    const w17 = [];
    for (const [panel, expected] of [
      ['academic-settings', "Couldn't load academic settings"],
      ['branding', "Couldn't load branding settings"],
      ['notification-settings', "Couldn't load notification settings"],
    ]) {
      await open(panel);
      const rec = await read(`
        const alert = document.querySelector('[data-admin-panel] [role="alert"]');
        return {
          alert: alert ? alert.textContent.trim() : '',
          inputs: document.querySelectorAll('[data-admin-panel] input, [data-admin-panel] select').length,
        };
      `);
      w17.push({ panel, ...rec, expected });
    }
    const w17ok = w17.every((r) => r.alert === r.expected && r.inputs === 0);
    if (w17ok) {
      pass('W17', 'the three settings pages that fail on the live deployment fail here too, with no invented form',
        w17.map((r) => `${r.panel} → "${r.alert}", 0 fields`).join('; '));
    } else {
      fail('W17', 'the three settings pages that fail on the live deployment fail here too, with no invented form',
        w17.map((r) => `${r.panel}: alert="${r.alert}" inputs=${r.inputs}`).join('; '));
    }

    // ── W18 · responsive reflow ──────────────────────────────────────────
    await browser.setViewport(390, 844, true);
    await open('students', 1800);
    const w18 = await read(`
      const el = document.querySelector('[data-admin-panel]');
      const doc = document.documentElement;
      return {
        pageScroll: doc.scrollWidth, pageClient: doc.clientWidth,
        panelScroll: el.scrollWidth, panelClient: el.clientWidth,
      };
    `);
    await browser.clearViewport();
    if (w18.pageScroll <= w18.pageClient + 2) {
      pass('W18', 'students: the panel reflows at 390px without the page scrolling sideways',
        `page ${w18.pageScroll} <= viewport ${w18.pageClient}; panel ${w18.panelScroll} <= ${w18.panelClient}`);
    } else {
      fail('W18', 'students: the panel reflows at 390px without the page scrolling sideways',
        `page ${w18.pageScroll} > ${w18.pageClient}`);
    }

    // ── W19 · a dashboard tile deep-link opens its module with the form ──
    const w19 = await read(`
      const before = location.href;
      // The fee panel's "New Payment" link carries ?action=create.
      document.querySelector('[data-admin-panel] a[href*="fee-payments"]');
      return before;
    `).catch(() => '');
    await open('fee-breakdown', 1600);
    const w19b = await read(`
      const link = document.querySelector('[data-admin-panel] a[href*="fee-payments"]');
      if (!link) return { present: false };
      link.click();
      await new Promise((r) => setTimeout(r, 1800));
      const dlg = document.querySelector('[role="dialog"]');
      return {
        present: true,
        url: location.href,
        panel: (document.querySelector('[data-admin-panel]') || {}).getAttribute ?
          document.querySelector('[data-admin-panel]').getAttribute('data-admin-panel') : null,
        title: dlg ? dlg.querySelector('.ap-dialog__title').textContent.trim() : '',
      };
    `);
    if (w19b.present && w19b.panel === 'fee-payments' && w19b.title) {
      pass('W19', 'a dashboard deep-link lands on its module with the create dialog already open',
        `${w19b.url} → panel "${w19b.panel}", dialog "${w19b.title}"`);
    } else {
      fail('W19', 'a dashboard deep-link lands on its module with the create dialog already open',
        JSON.stringify(w19b));
    }

    // ── W20 · checkout places a real order ─────────────────────────────
    /* This is the check that matters most for the store, because the thing it
       replaces reported "Order placed" while placing nothing. It asserts on the
       ORDER the queue gains, not on a banner: a banner is a claim, the queue
       row is evidence. */
    await step('W20', 'store: Checkout places a real order and the bursary queue gains it', async () => {
      await open('queue');
      const queueBefore = await read(`
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);

      await open('store');
      const added = await read(`
        /* Two different items, so the order has more than one line and a total
           that is not just one number copied twice. */
        const cards = Array.from(document.querySelectorAll('[data-admin-panel] .ap-card'));
        const usable = cards.filter((c) => {
          const btn = c.querySelector('button');
          return btn && !btn.disabled;
        });
        if (usable.length < 2) return { added: 0, usable: usable.length };
        for (const card of usable.slice(0, 2)) {
          card.querySelector('button').click();
          await new Promise((r) => setTimeout(r, 900));
        }
        const badge = Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => /^Cart \\(/.test(b.textContent.trim()));
        return { added: 2, cartBadge: badge ? badge.textContent.trim() : '(no badge)' };
      `);

      if (added.added !== 2) {
        fail('W20', 'store: Checkout places a real order and the bursary queue gains it',
          `only ${added.usable} item(s) were in stock`);
        return;
      }

      const checkedOut = await read(`
        const badge = Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => /^Cart \\(/.test(b.textContent.trim()));
        if (!badge) return { error: 'no Cart button on the store panel' };
        badge.click();
        await new Promise((r) => setTimeout(r, 1200));
        const rows = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'));
        if (!rows.length) return { error: 'the cart opened with no lines in it' };
        const caption = document.querySelector('.ap-table__caption');
        /* Raise the first line, so the order's total cannot be mistaken for a
           sum of the same items bought once each. */
        const up = rows[0].querySelector('button[aria-label^="Increase"]');
        if (!up) return { error: 'no quantity control on the first cart line' };
        up.click();
        await new Promise((r) => setTimeout(r, 1000));
        const rows2 = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'));
        const qtyEl = rows2[0].querySelector('.ap-qty__value');
        const checkout = Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => b.textContent.trim() === 'Checkout');
        if (!checkout) return { error: 'no Checkout button on the cart panel' };
        checkout.click();
        await new Promise((r) => setTimeout(r, 1600));
        const banner = document.querySelector('.ap-banner');
        return {
          lineCount: rows.length,
          qty: qtyEl ? qtyEl.textContent.trim() : '?',
          captionBefore: caption ? caption.textContent.trim() : '',
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '(no banner)',
        };
      `);
      if (checkedOut.error) {
        fail('W20', 'store: Checkout places a real order and the bursary queue gains it', checkedOut.error);
        return;
      }

      /* Reach the queue the way a user does — through the rail, in the same
         document. Navigating by URL would reload the page, and the mock's data
         lives in the page's memory, so a reloaded queue would show the seed
         again and the check would pass or fail for the wrong reason. */
      const queueAfter = await read(`
        /* The rail calls it "Confirmation Queue"; "Bursary Confirmation Queue" is the
           panel's own heading, and matching the wrong one is how this check came
           to report a missing rail entry that was there all along. */
        const link = Array.from(document.querySelectorAll('.rail-item'))
          .find((a) => /Confirmation Queue/i.test(a.textContent));
        if (!link) return { error: 'no rail entry for the confirmation queue' };
        link.click();
        for (let i = 0; i < 40; i += 1) {
          const el = document.querySelector('[data-admin-panel]');
          if (el && el.getAttribute('data-admin-panel') === 'queue' && !el.querySelector('.ap-loading')) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        const el = document.querySelector('[data-admin-panel]');
        return {
          panel: el ? el.getAttribute('data-admin-panel') : null,
          rows: Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
            .map((tr) => tr.querySelector('td').textContent.trim()),
        };
      `);
      if (queueAfter.error) {
        fail('W20', 'store: Checkout places a real order and the bursary queue gains it', queueAfter.error);
        return;
      }
      const gained = queueAfter.rows.filter((o) => !queueBefore.includes(o));
      if (gained.length === 1 && /awaiting bursary|pay at the bursary/i.test(checkedOut.banner)) {
        pass('W20', 'store: Checkout places a real order and the bursary queue gains it',
          `cart had ${checkedOut.lineCount} line(s) ("${checkedOut.captionBefore}"), first line raised to ` +
          `qty ${checkedOut.qty}; banner "${checkedOut.banner}"; queue ${queueBefore.length} → ` +
          `${queueAfter.rows.length} with new ${gained[0]}`);
      } else {
        fail('W20', 'store: Checkout places a real order and the bursary queue gains it',
          `banner "${checkedOut.banner}"; queue ${queueBefore.length} → ${queueAfter.rows.length}, ` +
          `new rows ${JSON.stringify(gained)}`);
      }
    });

    // ── W20b · the bursary cannot confirm without a payment reference ────
    /* The live queue detail's own refusal. It is enforced in the mock, not in
       the panel, so this passes because the server said no — a panel that merely
       disabled the button would satisfy a weaker check and prove nothing about
       the mock. */
    await step('W20b', 'store queue: confirming with a blank payment reference is refused', async () => {
      await open('queue');
      const refused = await read(`
        const row = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .find((tr) => /Confirm/.test(tr.textContent));
        if (!row) return { found: false };
        const orderNo = row.querySelector('td').textContent.trim();
        Array.from(row.querySelectorAll('button')).find((b) => /Confirm/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 700));
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return { found: true, opened: false };
        const title = dlg.querySelector('.ap-dialog__title').textContent.trim();
        Array.from(dlg.querySelectorAll('button'))
          .find((b) => b.textContent.trim() === 'Confirm order').click();
        await new Promise((r) => setTimeout(r, 1200));
        const after = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .find((tr) => tr.querySelector('td').textContent.trim() === orderNo);
        return {
          found: true, opened: true, title, orderNo,
          stillOpen: !!document.querySelector('[role="dialog"]'),
          status: after ? after.innerText.replace(/\\s+/g, ' ').trim() : '(row gone)',
        };
      `);
      if (refused.opened && refused.stillOpen && /awaiting/i.test(refused.status)) {
        pass('W20b', 'store queue: confirming with a blank payment reference is refused',
          `the "${refused.title}" dialog refused an empty reference, stayed open, and ${refused.orderNo} ` +
          `is still "${refused.status}"`);
      } else {
        fail('W20b', 'store queue: confirming with a blank payment reference is refused',
          `found=${refused.found} opened=${refused.opened} stillOpen=${refused.stillOpen} ` +
          `status="${refused.status}"`);
      }
    });

    // ── W20c · a reference lets the confirmation through ────────────────
    /* Same dialog as W20b, opposite outcome, so the refusal there is the mock
       refusing rather than the dialog merely being unusable. */
    await step('W20c', 'store queue: a reference of RCPT-4417 confirms the order', async () => {
      await open('queue');
      const done = await read(`
        const row = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .find((tr) => /Confirm/.test(tr.textContent));
        if (!row) return { found: false };
        const orderNo = row.querySelector('td').textContent.trim();
        Array.from(row.querySelectorAll('button')).find((b) => /Confirm/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 700));
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return { found: true, opened: false };
        const ref = dlg.querySelector('input[type="text"]');
        if (!ref) return { found: true, opened: true, noRefField: true };
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(ref, 'RCPT-4417');
        ref.dispatchEvent(new Event('input', { bubbles: true }));
        Array.from(dlg.querySelectorAll('button'))
          .find((b) => b.textContent.trim() === 'Confirm order').click();
        await new Promise((r) => setTimeout(r, 1600));
        const banner = document.querySelector('.ap-banner');
        const rowNow = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .find((tr) => tr.querySelector('td').textContent.trim() === orderNo);
        return {
          found: true, opened: true, orderNo,
          closed: !document.querySelector('[role="dialog"]'),
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '',
          status: rowNow ? rowNow.innerText.replace(/\\s+/g, ' ').trim() : '(row gone)',
        };
      `);
      if (done.found && done.closed && /confirmed/i.test(done.status)) {
        pass('W20c', 'store queue: a reference of RCPT-4417 confirms the order',
          `${done.orderNo} → "${done.status}", banner "${done.banner}"`);
      } else {
        fail('W20c', 'store queue: a reference of RCPT-4417 confirms the order',
          `found=${done.found} opened=${done.opened} closed=${done.closed} ` +
          `banner="${done.banner}" status="${done.status}"`);
      }
    });

    // ── W21 · the incident catalogue is the school's rule book ─────────
    /* Nine of the live 33 entries, verbatim, sanction text and all. This asserts
       the panel is reading the real catalogue rather than a lookup table of short
       labels, which is the failure mode a summary description would produce. */
    await step('W21', 'disciplinary: the incident catalogue carries the sanction text verbatim', async () => {
      await open('disciplinary-incidents');
      const cat = await read(`
        const rows = Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'));
        const first = rows.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()));
        return {
          count: rows.length,
          first: first[0] || null,
          hasRoman: rows.some((tr) => /^i\\. /.test(tr.querySelectorAll('td')[1].textContent.trim())),
        };
      `);
      if (
        cat.count === 9 &&
        cat.hasRoman &&
        /community service/i.test(cat.first[1]) &&
        /debagged/i.test(cat.first[1])
      ) {
        pass('W21', 'disciplinary: the incident catalogue carries the sanction text verbatim',
          `${cat.count} entries; first is "${cat.first[0]}" → "${cat.first[1].slice(0, 70)}…"`);
      } else {
        fail('W21', 'disciplinary: the incident catalogue carries the sanction text verbatim',
          `count=${cat.count} hasRoman=${cat.hasRoman} first=${JSON.stringify(cat.first)}`);
      }
    });

    // ── W22 · launching a case puts it in the reports list ───────────
    /* Read back out of Case Reports rather than off a banner, for the same
       reason as W20: the banner is a claim, the list row is evidence. Reached
       through the rail, because the mock's data lives in the page and a reload
       would reset it to the seed. */
    await step('W22', 'disciplinary: Launch Case creates a case that Case Reports lists', async () => {
      await open('disciplinary-reports');
      const before = await read(`
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);

      const launched = await read(`
        const go = (label) => {
          const item = Array.from(document.querySelectorAll('.rail-item'))
            .find((a) => a.textContent.trim() === label);
          if (!item) throw new Error('no rail entry "' + label + '"');
          item.click();
        };
        const settled = async (panel) => {
          for (let i = 0; i < 40; i += 1) {
            const el = document.querySelector('[data-admin-panel]');
            if (el && el.getAttribute('data-admin-panel') === panel && !el.querySelector('.ap-loading')) return;
            await new Promise((r) => setTimeout(r, 250));
          }
          throw new Error('panel ' + panel + ' did not settle');
        };
        go('Launch Case');
        await settled('disciplinary-launch-case');
        /* The live form requires a student, an incident type and a date. */
        const selects = Array.from(document.querySelectorAll('[data-admin-panel] select'));
        const student = selects[0];
        const studentOption = Array.from(student.options).find((o) => o.value);
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(student, studentOption.value);
        student.dispatchEvent(new Event('change', { bubbles: true }));
        const type = Array.from(document.querySelectorAll('[data-admin-panel] select'))
          .find((s) => Array.from(s.options).some((o) => /school prefect|chapel|Burglary/i.test(o.textContent)));
        if (!type) {
          return {
            error: 'no incident type on the launch form',
            offered: Array.from(document.querySelectorAll('[data-admin-panel] select'))
              .map((s) => Array.from(s.options).map((o) => o.textContent.trim()).slice(0, 3)),
          };
        }
        const typeOption = Array.from(type.options).find((o) => o.value);
        setter.call(type, typeOption.value);
        type.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        const submit = Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => b.textContent.trim() === 'Launch Case');
        const wasDisabled = submit.disabled;
        submit.click();
        await new Promise((r) => setTimeout(r, 1800));
        const banner = document.querySelector('.ap-banner');
        return {
          wasDisabled,
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '(no banner)',
        };
      `);
      if (launched.error) {
        fail('W22', 'disciplinary: Launch Case creates a case that Case Reports lists',
          `${launched.error}; selects offered ${JSON.stringify(launched.offered)}`);
        return;
      }
      const after = await read(`
        const item = Array.from(document.querySelectorAll('.rail-item'))
          .find((a) => a.textContent.trim() === 'Case Reports');
        item.click();
        for (let i = 0; i < 40; i += 1) {
          const el = document.querySelector('[data-admin-panel]');
          if (el && el.getAttribute('data-admin-panel') === 'disciplinary-reports' && !el.querySelector('.ap-loading')) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);
      const gained = after.filter((c) => !before.includes(c));
      if (gained.length === 1) {
        pass('W22', 'disciplinary: Launch Case creates a case that Case Reports lists',
          `submit was ${launched.wasDisabled ? 'disabled' : 'enabled'} once filled; banner "${launched.banner}"; ` +
          `reports ${before.length} → ${after.length} with new ${gained[0]}`);
      } else {
        fail('W22', 'disciplinary: Launch Case creates a case that Case Reports lists',
          `banner "${launched.banner}"; reports ${before.length} → ${after.length}, new ${JSON.stringify(gained)}`);
      }
    });

    // ── W23 · the status control offers every state but the current one ──
    await step('W23', 'disciplinary: the case detail offers every status except the current one', async () => {
      await open('disciplinary-reports');
      const detail = await read(`
        const row = document.querySelector('[data-admin-panel] table tbody tr');
        const caseNo = row.querySelector('td').textContent.trim();
        const current = Array.from(row.querySelectorAll('td'))
          .map((td) => td.textContent.trim())
          .find((t) => /^(OPEN|PENDING|UNDER_REVIEW|DISMISSED|RESOLVED|APPEALED)$/.test(t));
        Array.from(row.querySelectorAll('button')).find((b) => /View/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 700));
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return { caseNo, current, opened: false };
        const statusSelect = Array.from(dlg.querySelectorAll('select'))
          .find((s) => Array.from(s.options).some((o) => /UNDER REVIEW/i.test(o.textContent)));
        const choices = Array.from(statusSelect.options).map((o) => o.textContent.trim()).filter((t) => t !== 'Select new status');
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        const target = Array.from(statusSelect.options).find((o) => o.value && o.value !== current);
        setter.call(statusSelect, target.value);
        statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
        /* A tick before reading the button. Vue re-renders on the microtask
           queue, so a disabled-state read immediately after the change event
           still reports the pre-change value, which reads as a control that
           never enables itself. */
        await new Promise((r) => setTimeout(r, 400));
        const clicked = Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Update status');
        if (!clicked) return { caseNo, current, opened: true, choices, noUpdateButton: true };
        const wasDisabled = clicked.disabled;
        clicked.click();
        await new Promise((r) => setTimeout(r, 1800));
        const banner = document.querySelector('.ap-banner');
        return {
          caseNo, current, opened: true, choices, wasDisabled,
          picked: target.value,
          detailError: ((dlg.querySelector('.ap-form__error') || {}).textContent || '').trim(),
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '(no banner)',
          stillOpen: !!document.querySelector('[role="dialog"]'),
        };
      `);
      const offersCurrent = detail.current && detail.choices.includes(detail.current);
      if (detail.opened && detail.choices.length === 5 && !offersCurrent && /moved to/i.test(detail.banner)) {
        pass('W23', 'disciplinary: the case detail offers every status except the current one',
          `${detail.caseNo} was ${detail.current}; the control offered ${detail.choices.join(', ')} ` +
          `(5 of the 6, its own state absent); banner "${detail.banner}"`);
      } else {
        fail('W23', 'disciplinary: the case detail offers every status except the current one',
          `opened=${detail.opened} current=${detail.current} choices=${JSON.stringify(detail.choices)} ` +
          `offersCurrent=${offersCurrent} picked=${detail.picked} disabled=${detail.wasDisabled} ` +
          `detailError="${detail.detailError}" banner="${detail.banner}"`);
      }
    });

    // ── W24 · booking a counselling session lands in View Cases ─────
    await step('W24', 'counselling: Book Session creates a referral that View Cases lists', async () => {
      await open('counselling-cases');
      const before = await read(`
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);
      const booked = await read(`
        const go = (label) => {
          const item = Array.from(document.querySelectorAll('.rail-item'))
            .find((a) => a.textContent.trim() === label);
          if (!item) throw new Error('no rail entry "' + label + '"');
          item.click();
        };
        const settled = async (panel) => {
          for (let i = 0; i < 40; i += 1) {
            const el = document.querySelector('[data-admin-panel]');
            if (el && el.getAttribute('data-admin-panel') === panel && !el.querySelector('.ap-loading')) return;
            await new Promise((r) => setTimeout(r, 250));
          }
          throw new Error('panel ' + panel + ' did not settle');
        };
        go('Book Session');
        await settled('counselling-book-session');
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        const setterText = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        const student = document.querySelector('[data-admin-panel] select');
        setter.call(student, Array.from(student.options).find((o) => o.value).value);
        student.dispatchEvent(new Event('change', { bubbles: true }));
        const reason = document.querySelector('[data-admin-panel] textarea');
        setterText.call(reason, 'Needs a careers conversation before the placement round.');
        reason.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        const submit = Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => b.textContent.trim() === 'Save Referral');
        const wasDisabled = submit.disabled;
        const stillNeeded = (document.querySelector('[data-admin-panel] .ap-field__hint') || {}).textContent || '';
        submit.click();
        await new Promise((r) => setTimeout(r, 1800));
        const banner = document.querySelector('.ap-banner');
        return {
          wasDisabled,
          stillNeeded: stillNeeded.trim().slice(0, 60),
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '(no banner)',
        };
      `);
      const after = await read(`
        Array.from(document.querySelectorAll('.rail-item'))
          .find((a) => a.textContent.trim() === 'View Cases').click();
        for (let i = 0; i < 40; i += 1) {
          const el = document.querySelector('[data-admin-panel]');
          if (el && el.getAttribute('data-admin-panel') === 'counselling-cases' && !el.querySelector('.ap-loading')) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);
      const gained = after.filter((c) => !before.includes(c));
      if (gained.length === 1) {
        pass('W24', 'counselling: Book Session creates a referral that View Cases lists',
          `submit was ${booked.wasDisabled ? 'disabled' : 'enabled'} once filled; banner "${booked.banner}"; ` +
          `cases ${before.length} → ${after.length} with new ${gained[0]}`);
      } else {
        fail('W24', 'counselling: Book Session creates a referral that View Cases lists',
          `submit disabled=${booked.wasDisabled} banner "${booked.banner}"; ` +
          `cases ${before.length} → ${after.length}, new ${JSON.stringify(gained)}`);
      }
    });

    // ── W25 · a committee is saved with a named chair ───────────────
    await step('W25', 'counselling: a committee with one chair is created and lists it', async () => {
      await open('counselling-committee');
      const before = await read(`
        return document.querySelectorAll('[data-admin-panel] .ap-card').length;
      `);
      const saved = await read(`
        Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => b.textContent.trim() === 'New Committee').click();
        await new Promise((r) => setTimeout(r, 600));
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return { opened: false };
        /* An unnamed committee is refused, so the refusal is asserted first. */
        Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Create committee').click();
        await new Promise((r) => setTimeout(r, 500));
        const refusal = (dlg.querySelector('.ap-form__error') || {}).textContent || '';
        const setterText = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const nameInput = dlg.querySelector('input[type="text"]');
        setterText.call(nameInput, 'Careers and Placement Committee');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Add member').click();
        await new Promise((r) => setTimeout(r, 400));
        const memberRow = dlg.querySelector('.ap-seat-row');
        const inputs = memberRow.querySelectorAll('input');
        setterText.call(inputs[0], 'MOCK PRINCIPAL');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        const seatSelect = memberRow.querySelector('select');
        const setterSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setterSelect.call(seatSelect, 'CHAIR');
        seatSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 300));
        Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Create committee').click();
        await new Promise((r) => setTimeout(r, 1800));
        const banner = document.querySelector('.ap-banner');
        return {
          opened: true,
          refusal: refusal.trim(),
          closed: !document.querySelector('[role="dialog"]'),
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '(no banner)',
        };
      `);
      const after = await read(`
        const cards = Array.from(document.querySelectorAll('[data-admin-panel] .ap-card'));
        return {
          count: cards.length,
          chairs: cards.filter((c) => /Chair/.test(c.textContent)).map((c) => c.querySelector('.ap-card__title').textContent.trim()),
        };
      `);
      if (
        saved.opened &&
        /Enter a committee name/.test(saved.refusal) &&
        saved.closed &&
        after.count === before + 1 &&
        after.chairs.some((n) => /Careers and Placement/.test(n))
      ) {
        pass('W25', 'counselling: a committee with one chair is created and lists it',
          `an unnamed committee was refused with "${saved.refusal}"; the named one saved ("${saved.banner}") ` +
          `and appears as card ${after.count}, chair of ${after.chairs.join(', ')}`);
      } else {
        fail('W25', 'counselling: a committee with one chair is created and lists it',
          `opened=${saved.opened} refusal="${saved.refusal}" closed=${saved.closed} ` +
          `cards ${before} → ${after.count} chairs ${JSON.stringify(after.chairs)}`);
      }
    });

    // ── W26 · a school role is a real second axis ─────────────────────
    /* Two halves, because the honest behaviour splits in two:
       HOLDING a role extends the session's effective permission set, and cannot
       narrow the rail — `/admin/` is SUPER_ADMIN-only and a super administrator
       holds a superset by design, so a Bursary grant has nothing left to remove.
       PREVIEWING a role narrows the rail to that role alone, and is marked as a
       preview so it cannot be mistaken for a change of authorisation.
       Asserting only the second would hide the first; asserting only the first
       would read as "the role did nothing". */
    await step('W26', 'roles: holding extends the effective set, previewing narrows the rail', async () => {
      await open('roles');
      const before = await read(`
        return {
          rail: Array.from(document.querySelectorAll('.rail-item')).map((a) => a.textContent.trim()).filter(Boolean),
          roles: JSON.parse(localStorage.getItem('AdminSchoolRoles') || '[]'),
        };
      `);

      const held = await read(`
        /* Matched on the name element rather than the cell's text, which also
           carries the role's description and any "Held" badge. */
        const rowOf = (name) => Array.from(document.querySelectorAll('[data-admin-panel] tbody tr'))
          .find((tr) => {
            const el = tr.querySelector('.ap-identity__name');
            return el && el.textContent.trim().startsWith(name);
          });
        const row = rowOf('Bursary');
        if (!row) {
          return {
            error: 'no Bursary row on the roles page',
            names: Array.from(document.querySelectorAll('.ap-identity__name'))
              .map((el) => el.textContent.trim()).slice(0, 8),
          };
        }
        const name = row.querySelector('.ap-identity__name').textContent.trim();
        Array.from(row.querySelectorAll('button'))
          .find((b) => /Hold this role/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 900));
        return {
          name,
          roles: JSON.parse(localStorage.getItem('AdminSchoolRoles') || '[]'),
          rail: Array.from(document.querySelectorAll('.rail-item')).map((a) => a.textContent.trim()).filter(Boolean),
          banner: (document.querySelector('.ap-banner') || {}).textContent?.replace(/×$/, '').trim() || '',
        };
      `);
      if (held.error) {
        fail('W26', 'roles: holding extends the effective set, previewing narrows the rail',
          `${held.error}; names seen ${JSON.stringify(held.names)}`);
        return;
      }

      const previewed = await read(`
        const row = Array.from(document.querySelectorAll('[data-admin-panel] tbody tr'))
          .find((tr) => {
            const el = tr.querySelector('.ap-identity__name');
            return el && el.textContent.trim().startsWith('Bursary');
          });
        Array.from(row.querySelectorAll('button'))
          .find((b) => /Preview this role|Clear preview/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 900));
        const callout = document.querySelector('[data-admin-panel] .ap-callout');
        return {
          rail: Array.from(document.querySelectorAll('.rail-item')).map((a) => a.textContent.trim()).filter(Boolean),
          callout: callout ? callout.textContent.replace(/\\s+/g, ' ').trim() : '',
          stillHeld: JSON.parse(localStorage.getItem('AdminSchoolRoles') || '[]'),
        };
      `);

      const droppedOnHold = before.rail.filter((l) => !held.rail.includes(l));
      const droppedOnPreview = before.rail.filter((l) => !previewed.rail.includes(l));
      const keptBursary = previewed.rail.includes('Browse Store');
      const lostDisciplinary = !previewed.rail.includes('Case Reports');

      if (
        held.roles.includes('Bursary') &&
        droppedOnHold.length === 0 &&
        droppedOnPreview.length > 0 &&
        keptBursary &&
        lostDisciplinary &&
        /still governs every action/i.test(previewed.callout) &&
        previewed.stillHeld.includes('Bursary')
      ) {
        pass('W26', 'roles: holding extends the effective set, previewing narrows the rail',
          `holding ${held.name} added it to storage ${JSON.stringify(held.roles)} and left all ` +
          `${before.rail.length} rail entries in place (a super admin holds a superset, so there is ` +
          `nothing to remove); previewing it cut the rail to ${previewed.rail.length} — keeping ` +
          `"Browse Store", dropping "Case Reports" — while the hold persisted`);
      } else {
        fail('W26', 'roles: holding extends the effective set, previewing narrows the rail',
          `held=${JSON.stringify(held.roles)} droppedOnHold=${droppedOnHold.length} ` +
          `rail ${before.rail.length} → preview ${previewed.rail.length} dropped=${droppedOnPreview.length} ` +
          `keepsStore=${keptBursary} keepsDisciplinary=${!lostDisciplinary} ` +
          `callout="${previewed.callout.slice(0, 60)}"`);
      }
    });

    // ── W27 · Create Sale reserves stock ──────────────────────────────
    /* The console's one dead control, found by `tools/find-dead-controls.py`:
       a button that rendered, looked primary, and had no handler at all. Now a
       real dialog, asserted on the two things the live sheet promises — the
       validation wording, and that the sale holds its stock. The second is why
       the Release and Cancel row actions mean anything. */
    await step('W27', 'inventory/sales: Create Sale validates, then reserves its stock', async () => {
      await open('sales');
      const before = await read(`
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);

      const opened = await read(`
        const btn = Array.from(document.querySelectorAll('[data-admin-panel] button'))
          .find((b) => b.textContent.trim() === 'Create Sale');
        if (!btn) return { error: 'no Create Sale button' };
        btn.click();
        await new Promise((r) => setTimeout(r, 700));
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return { error: 'the dialog did not open' };
        return {
          opened: true,
          title: dlg.querySelector('.ap-dialog__title').textContent.trim(),
          hasBuyer: !!dlg.querySelector('input[placeholder*="John Doe"]'),
          hasContact: !!dlg.querySelector('input[placeholder*="Phone"]'),
          hasSupplier: !!dlg.querySelector('select'),
          hasAddItem: Array.from(dlg.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Add Item'),
          hasTotal: !!dlg.querySelector('.ap-total'),
        };
      `);
      if (opened.error) {
        fail('W27', 'inventory/sales: Create Sale validates, then reserves its stock', opened.error);
        return;
      }

      /* Empty submit — the live sheet's first refusal, verbatim. */
      const refused = await read(`
        const dlg = document.querySelector('[role="dialog"]');
        Array.from(dlg.querySelectorAll('button'))
          .find((b) => b.textContent.trim() === 'Create Sale').click();
        await new Promise((r) => setTimeout(r, 500));
        return { err: (dlg.querySelector('.ap-form__error') || {}).textContent?.trim() || '',
                 stillOpen: !!document.querySelector('[role="dialog"]') };
      `);

      /* Zero quantity — the live sheet's second refusal, verbatim.
         The item select is addressed by position among the dialog's selects:
         index 0 is the supplier, index 1 the stock item. Matching on text or on
         "the first select with options" picked the supplier, which has options
         of its own, and made the whole check pass against a sale of nothing. */
      const zeroQty = await read(`
        const dlg = document.querySelector('[role="dialog"]');
        const selects = Array.from(dlg.querySelectorAll('select'));
        const itemSel = selects[1];
        if (!itemSel) return { err: '(no stock item select in the dialog)' };
        const options = Array.from(itemSel.options).filter((o) => o.value);
        if (!options.length) return { err: '(the stock item select offered no items)' };
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(itemSel, options[0].value);
        itemSel.dispatchEvent(new Event('change', { bubbles: true }));
        const qty = dlg.querySelector('input[type="number"]');
        const setterText = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setterText.call(qty, '0');
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        Array.from(dlg.querySelectorAll('button'))
          .find((b) => b.textContent.trim() === 'Create Sale').click();
        await new Promise((r) => setTimeout(r, 500));
        return {
          picked: options[0].textContent.trim(),
          err: (dlg.querySelector('.ap-form__error') || {}).textContent?.trim() || '',
        };
      `);

      /* Now a valid sale. The total is read AFTER a tick: it is a computed
         re-render, and reading it in the same task that changed the quantity
         reports the pre-change figure — which read as "the total never moves". */
      const created = await read(`
        const dlg = document.querySelector('[role="dialog"]');
        const qty = dlg.querySelector('input[type="number"]');
        const setterText = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const atZero = dlg.querySelector('.ap-total strong').textContent.trim();
        setterText.call(qty, '2');
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 500));
        const total = dlg.querySelector('.ap-total strong').textContent.trim();
        Array.from(dlg.querySelectorAll('button'))
          .find((b) => b.textContent.trim() === 'Create Sale').click();
        await new Promise((r) => setTimeout(r, 1800));
        const banner = document.querySelector('.ap-banner');
        return {
          atZero, total,
          closed: !document.querySelector('[role="dialog"]'),
          banner: banner ? banner.textContent.replace(/×$/, '').trim() : '',
        };
      `);
      const after = await read(`
        return Array.from(document.querySelectorAll('[data-admin-panel] table tbody tr'))
          .map((tr) => tr.querySelector('td').textContent.trim());
      `);

      const naira = (s) => Number(String(s).replace(/[^0-9.]/g, ''));
      const gained = after.filter((r) => !before.includes(r));
      if (
        opened.opened &&
        opened.hasBuyer && opened.hasContact && opened.hasSupplier &&
        opened.hasAddItem && opened.hasTotal &&
        /Add at least one stock item to the sale\./.test(refused.err) && refused.stillOpen &&
        /Quantities must be greater than zero\./.test(zeroQty.err) &&
        naira(created.atZero) === 0 &&
        naira(created.total) > 0 &&
        created.closed && /created\. Stock reserved\./.test(created.banner) &&
        gained.length === 1
      ) {
        pass('W27', 'inventory/sales: Create Sale validates, then reserves its stock',
          `"${opened.title}" with buyer/contact/supplier/items/total; refused "${refused.err}" then ` +
          `"${zeroQty.err}" for ${zeroQty.picked}; the running total moved ` +
          `${created.atZero} → ${created.total} as quantity went 1 → 2; created ${gained[0]} — ` +
          `"${created.banner}"`);
      } else {
        fail('W27', 'inventory/sales: Create Sale validates, then reserves its stock',
          `opened=${JSON.stringify(opened)} empty="${refused.err}" zero="${zeroQty.err}" ` +
          `picked=${zeroQty.picked} total ${created.atZero} → ${created.total} ` +
          `closed=${created.closed} banner="${created.banner}" gained=${JSON.stringify(gained)}`);
      }
    });

    // ── report ──────────────────────────────────────────────────────────
    const tally = { PASS: 0, FAIL: 0, SKIPPED: 0 };
    for (const r of results) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
    console.log(
      `workflow checks: ${results.length}  PASS ${tally.PASS}  FAIL ${tally.FAIL}  SKIPPED ${tally.SKIPPED}`,
    );
    for (const r of results) {
      console.log(`  ${r.verdict.padEnd(8)}${r.id.padEnd(5)}${r.name}`);
      console.log(`      ${r.verdict === 'PASS' ? '✓' : '→'} ${r.detail}`);
    }
    console.log(
      tally.FAIL === 0
        ? '\nPASS — every workflow check held.'
        : `\nFAIL — ${tally.FAIL} check(s) did not hold.`,
    );
    process.exitCode = tally.FAIL === 0 ? 0 : 1;
  } catch (e) {
    /*
     * An abort used to print only the error's first line, which is how this file
     * managed to abort at W11 with "Cannot read properties of undefined (reading
     * 'click')" and no way to tell whether the panel had failed to load, whether
     * the wrong panel was mounted, or whether the page had thrown. Every abort
     * now dumps the state a probe would have read, so the next one is
     * diagnosable from the log alone.
     */
    console.error('ABORTED:', String(e).split('\n')[0]);
    try {
      const state = await browser.evaluate(`
        const p = document.querySelector('[data-admin-panel]');
        return {
          url: location.href.slice(-60),
          panelAttr: p ? p.getAttribute('data-admin-panel') : null,
          loading: !!(p && p.querySelector('.ap-loading')),
          errorShown: p ? ((p.querySelector('.ap-error') || {}).textContent || null) : null,
          rows: p ? p.querySelectorAll('tbody tr, .ap-card').length : 0,
          buttons: p ? Array.from(p.querySelectorAll('button')).map((x) => x.textContent.trim()).slice(0, 12) : [],
          dialogOpen: !!document.querySelector('[role="dialog"]'),
          dialogTitle: (document.querySelector('[role="dialog"] .ap-dialog__title') || {}).textContent || null,
        };
      `);
      console.error('ABORT STATE:', JSON.stringify(state, null, 2));
    } catch (probeError) {
      console.error('ABORT STATE unavailable:', String(probeError).split('\n')[0]);
    }
    const consoleErrs = browser.consoleErrors || [];
    const pageErrs = browser.pageErrors || [];
    if (consoleErrs.length) console.error('CONSOLE ERRORS:', consoleErrs.slice(0, 5));
    if (pageErrs.length) console.error('PAGE ERRORS:', pageErrs.slice(0, 5));
    for (const r of results) {
      console.log(`  ${r.verdict.padEnd(8)}${r.id.padEnd(5)}${r.name}`);
      console.log(`      ${r.verdict === 'PASS' ? '✓' : '→'} ${r.detail}`);
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();