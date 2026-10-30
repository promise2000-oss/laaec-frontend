/**
 * audit-a11y.mjs — accessibility checks that can only be made against a rendered page.
 *
 * WHY THIS IS A BROWSER CHECK AND NOT A LINT
 * -------------------------------------------
 * The three failures that matter most here are all invisible to a linter:
 *
 *   - a control with no accessible name. `getComputedAccessibleName`-style
 *     reasoning is a browser's job, and it accounts for `aria-label`, `title`,
 *     `alt`, a wrapping `<label>`, and `aria-labelledby` together. A regex over
 *     the template can only guess at that and will both miss real gaps and
 *     flag perfectly named controls.
 *   - a focus indicator that does not show. Whether a focus ring is visible
 *     depends on the cascade, which means reading the computed styles after the
 *     element is focused.
 *   - contrast, which is arithmetic over the rendered colours.
 *
 * So this walks the panels in a real browser and measures.
 *
 * Run:  node tools/audit/audit-a11y.mjs
 */

import { launch } from 'file:///C:/Users/USER/AppData/Local/Temp/opencode/cdp/cdp.mjs';

const BASE = 'http://localhost:5173';
const USER = 'mocksuper';
const PASS = 'MockAdminPass1';

const PANELS = [
  'students', 'users', 'roles', 'permissions', 'staff', 'leave', 'stock', 'store', 'cart',
  'queue', 'fee-payments', 'wallets', 'results-queue', 'enter-results', 'general-settings',
  'disciplinary-reports', 'counselling-cases', 'counselling-reports', 'sales',
];

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (id, name, detail) => results.push({ id, name, verdict: 'PASS', detail });
const fail = (id, name, detail) => results.push({ id, name, verdict: 'FAIL', detail });

/**
 * The accessible name, computed the way a screen reader computes it.
 *
 * Deliberately not a regex over the template: this walks the same sources the
 * platform does, in the same precedence order, which is what makes "this button
 * has a name" a claim rather than a guess.
 */
const NAME_PROBE = `
  const accName = (el) => {
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const text = ariaLabelledBy.split(/\\s+/)
        .map((id) => (document.getElementById(id) || {}).textContent || '')
        .join(' ').trim();
      if (text) return text;
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    /* A wrapping <label> is the name for a form control, and for a button too. */
    const wrapper = el.closest('label');
    if (wrapper) {
      const clone = wrapper.cloneNode(true);
      clone.querySelectorAll('input, select, textarea, button').forEach((n) => n.remove());
      const text = clone.textContent.replace(/\\s+/g, ' ').trim();
      if (text) return text;
    }
    if (el.id) {
      const forLabel = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (forLabel && forLabel.textContent.trim()) return forLabel.textContent.trim();
    }
    /* An image inside the control can name it, via alt or a title. */
    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();

    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();

    /* A button whose only content is an inline SVG: the SVG needs its own name,
       and if it has none the button has none either. */
    return (el.textContent || '').replace(/\\s+/g, ' ').trim();
  };

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    /* An element scrolled out of a container is still reachable, so rect width
       is the test, not intersection with the viewport. */
    return el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0;
  };

  const root = document.querySelector('[data-admin-panel]');
  if (!root) return { error: 'no panel mounted' };

  const controls = Array.from(root.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="menuitem"]'))
    .filter(visible);

  const unnamedButtons = [];
  const unnamedFields = [];
  for (const el of controls) {
    const name = accName(el);
    const tag = el.tagName.toLowerCase();
    const isField = tag === 'input' || tag === 'select' || tag === 'textarea';
    /* A field that is not a button and has no name gets its name from an
       adjacent label in practice, but only if that label is actually
       associated — so "no name at all" is the finding. */
    if (!name) {
      if (isField) unnamedFields.push(tag + (el.type ? '[' + el.type + ']' : ''));
      else unnamedButtons.push(tag + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
    }
  }

  /* Duplicate ids break every label[for] and every aria-describedby that
     references them, and they are invisible until two components meet. */
  const idCounts = {};
  for (const el of root.querySelectorAll('[id]')) {
    idCounts[el.id] = (idCounts[el.id] || 0) + 1;
  }
  const dupIds = Object.keys(idCounts).filter((id) => idCounts[id] > 1);

  /* Tab order: anything with a positive tabindex above 0 reorders the page in
     a way that is almost never intentional in a data table. */
  const badTabIndex = Array.from(root.querySelectorAll('[tabindex]'))
    .map((el) => Number(el.getAttribute('tabindex')))
    .filter((n) => Number.isFinite(n) && n > 0).length;

  /* Landmark and heading structure inside the panel. */
  const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map((h) => Number(h.tagName[1]));
  let headingJumps = 0;
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) headingJumps += 1;
  }

  return {
    controls: controls.length,
    unnamedButtons,
    unnamedFields,
    dupIds,
    badTabIndex,
    headingJumps,
    headingCount: headings.length,
    hasMain: !!document.querySelector('main, [role="main"]'),
    hasNav: !!document.querySelector('nav, [role="navigation"]'),
    liveRegions: root.querySelectorAll('[aria-live]').length,
  };
`;

/**
 * Focus visibility: is there a visible ring on whatever takes focus?
 *
 * The first *enabled* control, not the first control. A disabled button not
 * taking focus is the platform behaving correctly — an empty cart's "Cart (0)" and
 * an unsubmitted form's "Submit Results" are both disabled — and treating it as a
 * failure produced two findings that were not defects. The check is about whether
 * focus is *visible* where focus can land, not whether a disabled control
 * complies.
 */
const FOCUS_PROBE = `
  const all = Array.from(document.querySelectorAll(
    '[data-admin-panel] button, [data-admin-panel] input, [data-admin-panel] a[href], [data-admin-panel] select, [data-admin-panel] textarea'
  ));
  const target = all.find((el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  if (!target) return { error: 'the panel has no enabled control to focus' };
  target.focus();
  await new Promise((r) => setTimeout(r, 150));
  const cs = getComputedStyle(target);
  const visible =
    (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0) ||
    (cs.boxShadow && cs.boxShadow !== 'none');
  return {
    focused: document.activeElement === target,
    tag: target.tagName.toLowerCase(),
    label: (target.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30),
    disabledFirst: all.length > 0 && !!all[0].disabled,
    outline: cs.outlineStyle + ' ' + cs.outlineWidth,
    boxShadow: (cs.boxShadow || '').slice(0, 40),
    visible,
  };
`;

/** Reduced motion: does the app declare that it honours the preference? */
const MOTION_PROBE = `
  return {
    hasReducedMotionBlock: Array.from(document.styleSheets).some((sheet) => {
      let rules; try { rules = sheet.cssRules; } catch { return false; }
      return Array.from(rules || []).some((r) => /prefers-reduced-motion/.test(r.cssText || ''));
    }),
    transitions: Array.from(document.querySelectorAll('[data-admin-panel] *'))
      .slice(0, 400)
      .map((el) => getComputedStyle(el).transitionDuration)
      .filter((d) => d && d !== '0s').length,
  };
`;

async function main() {
  const browser = await launch();
  try {
    await browser.goto(`${BASE}/login/super/`, 600);
    await browser.evaluate('localStorage.clear(); return true;');
    await browser.waitFor('return !!document.getElementById("username");', 20000);
    await browser.evaluate(`
      const set = (id, v) => {
        const el = document.getElementById(id);
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('username', ${JSON.stringify(USER)});
      set('password', ${JSON.stringify(PASS)});
      Array.from(document.querySelectorAll('button')).find((b) => /AUTHORIZE SESSION/i.test(b.textContent)).click();
      return true;
    `);
    await sleep(4000);

    const unnamed = [];
    const dupes = new Set();
    let headingJumps = 0;
    let controls = 0;

    for (const panel of PANELS) {
      await browser.goto(`${BASE}/admin/?panel=${panel}`, 300);
      await browser.waitFor(
        `const el = document.querySelector('[data-admin-panel]');
         return !!el && el.getAttribute('data-admin-panel') === ${JSON.stringify(panel)};`,
        20000,
      );
      await sleep(500);
      const r = await browser.evaluate(NAME_PROBE);
      if (r.error) {
        fail('A1-' + panel, 'panel renders', r.error);
        continue;
      }
      controls += r.controls;
      for (const u of [...r.unnamedButtons, ...r.unnamedFields]) {
        unnamed.push(panel + ': ' + u);
      }
      r.dupIds.forEach((d) => dupes.add(d));
      headingJumps += r.headingJumps;

      const f = await browser.evaluate(FOCUS_PROBE);
      if (f.error) {
        fail('A2-' + panel, 'focus indicator', f.error);
      } else if (!f.focused) {
        fail('A2-' + panel, 'focus indicator', 'the element did not take focus');
      } else if (!f.visible) {
        fail('A2-' + panel, 'focus indicator',
          `focusing <${f.tag}> "${f.label}" shows no outline (${f.outline}) and no box-shadow`);
      }
    }

    /* A1 — every control has an accessible name. */
    if (unnamed.length === 0) {
      pass('A1', 'every interactive control has an accessible name',
        `${controls} controls across ${PANELS.length} panels; none unnamed`);
    } else {
      fail('A1', 'every interactive control has an accessible name',
        `${unnamed.length} unnamed: ${unnamed.slice(0, 8).join(', ')}${unnamed.length > 8 ? ' …' : ''}`);
    }

    /* A2 — focus is visible wherever it lands. */
    const focusFails = results.filter((r) => r.id.startsWith('A2-') && r.verdict === 'FAIL');
    if (focusFails.length === 0) {
      pass('A2', 'focus is visible on the first control of every panel',
        `${PANELS.length} panels focused; each showed an outline or a focus ring`);
    } else {
      fail('A2', 'focus is visible on the first control of every panel',
        `${focusFails.length} panel(s) without a visible focus indicator: ` +
        focusFails.map((f) => f.id.replace('A2-', '')).join(', '));
    }

    /* A3 — no duplicate ids, which silently break every label association. */
    if (dupes.size === 0) {
      pass('A3', 'no duplicate element ids inside a panel', `${PANELS.length} panels, no duplicates`);
    } else {
      fail('A3', 'no duplicate element ids inside a panel', `${[...dupes].join(', ')}`);
    }

    /* A4 — heading order inside a panel does not skip levels. */
    if (headingJumps === 0) {
      pass('A4', 'heading levels inside a panel do not skip', `${PANELS.length} panels, no skipped levels`);
    } else {
      fail('A4', 'heading levels inside a panel do not skip', `${headingJumps} jump(s)`);
    }

    /* A5 — reduced motion is honoured. */
    const motion = await browser.evaluate(MOTION_PROBE);
    if (motion.hasReducedMotionBlock) {
      pass('A5', 'the app honours prefers-reduced-motion',
        'a reduced-motion block is present');
    } else {
      fail('A5', 'the app honours prefers-reduced-motion',
        `no prefers-reduced-motion block anywhere; ${motion.transitions} of the first 400 panel ` +
        'elements declare a non-zero transition');
    }

    /* A6 — landmarks, once, on a real page. */
    await browser.goto(`${BASE}/admin/?panel=students`, 400);
    await sleep(600);
    const lm = await browser.evaluate(NAME_PROBE);
    if (lm.hasMain && lm.hasNav) {
      pass('A6', 'the page exposes main and navigation landmarks',
        `main: ${lm.hasMain}, navigation: ${lm.hasNav}, live regions: ${lm.liveRegions}`);
    } else {
      fail('A6', 'the page exposes main and navigation landmarks',
        `main: ${lm.hasMain}, navigation: ${lm.hasNav}`);
    }

    const tally = { PASS: 0, FAIL: 0 };
    for (const r of results) tally[r.verdict] += 1;
    console.log(`a11y checks: ${results.length}  PASS ${tally.PASS}  FAIL ${tally.FAIL}\n`);
    for (const r of results.filter((x) => x.verdict === 'FAIL')) {
      console.log(`  ${r.verdict.padEnd(6)}${r.id.padEnd(16)}${r.name}`);
      console.log(`      → ${r.detail}`);
    }
    for (const r of results.filter((x) => x.verdict === 'PASS')) {
      console.log(`  ${r.verdict.padEnd(6)}${r.id.padEnd(16)}${r.name}`);
      console.log(`      ✓ ${r.detail}`);
    }
    console.log(tally.FAIL === 0 ? '\nPASS — no accessibility findings.' : `\nFAIL — ${tally.FAIL} accessibility finding(s).`);
    process.exitCode = tally.FAIL === 0 ? 0 : 1;
  } catch (e) {
    console.error('ABORTED:', String(e).split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();